/**
 * SafePrompt — content.js
 *
 * Injected into ChatGPT and Claude.ai. Intercepts prompt submission,
 * runs the local rules engine, then passes, warns, or blocks the prompt.
 * All evaluation happens in the browser — no data is sent anywhere.
 */

// ── Utilities ─────────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function broadcastResult(payload) {
  chrome.storage.local.get('auditLog', ({ auditLog }) => {
    const log = auditLog || [];
    log.push({ ...payload, ts: Date.now() });
    if (log.length > 100) log.splice(0, log.length - 100);
    chrome.storage.local.set({
      auditLog: log,
      lastFirewallResult: { ...payload, ts: Date.now() },
    });
  });
}

// ── Firewall check ────────────────────────────────────────────────────────────

async function checkPrompt(promptText) {
  const start    = Date.now();
  const result   = evaluate(promptText); // from rules.js
  const elapsed  = Date.now() - start;
  return {
    decision:       result.decision,
    score:          result.score,
    triggeredRules: result.triggeredRules,
    elapsed,
  };
}

// ── Overlay UI ────────────────────────────────────────────────────────────────

function removeOverlay() {
  const el = document.getElementById('safeprompt-overlay');
  if (el) el.remove();
}

function showOverlay({ decision, score, triggeredRules, elapsed, source, prompt, onProceed }) {
  removeOverlay();

  const isWarn = decision === 'warn';
  const colors = {
    warn: { bg: '#3a2a0a', border: '#5a4010', text: '#fbbf24', label: '⚠ Warning'  },
    deny: { bg: '#3a0a0a', border: '#5a1a1a', text: '#f87171', label: '✗ Blocked'  },
  };
  const c = colors[decision];

  const rulesHtml = triggeredRules.length
    ? triggeredRules.map(r => `
        <div style="
          display:flex; justify-content:space-between; align-items:center;
          background:#18181f; border:1px solid #2a2a35; border-radius:4px;
          padding:7px 10px; margin-bottom:5px;
        ">
          <span style="font-size:12px; color:#e8e8f0;">${escHtml(r.description || r.id)}</span>
          <span style="font-size:11px; color:#f87171; font-weight:500; margin-left:12px; flex-shrink:0;">
            +${r.score}
          </span>
        </div>`).join('')
    : '<div style="font-size:11px;color:#6b6b80;font-style:italic;">No rules triggered</div>';

  const overlay = document.createElement('div');
  overlay.id = 'safeprompt-overlay';
  overlay.style.cssText = `
    position:fixed; inset:0; background:rgba(0,0,0,0.65);
    display:flex; align-items:center; justify-content:center;
    z-index:999999; font-family:'DM Mono',ui-monospace,monospace;
  `;

  overlay.innerHTML = `
    <div style="
      background:#111118; border:1px solid ${c.border}; border-radius:10px;
      width:440px; max-width:92vw; overflow:hidden;
      box-shadow:0 20px 60px rgba(0,0,0,0.6);
    ">
      <div style="
        background:${c.bg}; padding:13px 18px;
        display:flex; align-items:center; justify-content:space-between;
      ">
        <div style="display:flex; align-items:center; gap:12px;">
          <span style="font-size:10px;letter-spacing:2px;text-transform:uppercase;font-weight:600;color:${c.text};">
            ${c.label}
          </span>
          <span style="font-size:11px;color:#6b6b80;">score: ${score}</span>
          <span style="font-size:10px;color:#6b6b80;letter-spacing:1px;">${elapsed}ms</span>
        </div>
        <span style="font-size:10px;color:#6b6b80;letter-spacing:1px;text-transform:uppercase;">
          SafePrompt
        </span>
      </div>

      <div style="padding:16px 18px;">
        <div style="font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:#6b6b80;margin-bottom:5px;">
          prompt
        </div>
        <div style="
          font-size:12px;color:#e8e8f0;background:#18181f;
          border:1px solid #2a2a35;border-radius:5px;
          padding:9px 12px;margin-bottom:14px;
          max-height:70px;overflow-y:auto;line-height:1.5;word-break:break-word;
        ">${escHtml(prompt)}</div>

        <div style="font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:#6b6b80;margin-bottom:8px;">
          triggered rules
        </div>
        ${rulesHtml}

        <div style="
          font-size:11px;color:${c.text};margin-top:14px;line-height:1.6;
          padding:10px 12px;background:${c.bg};border-radius:5px;
        ">
          ${decision === 'deny'
            ? 'This prompt has been <strong>blocked</strong> by your firewall policy. Please edit your prompt and try again.'
            : 'This prompt triggered one or more firewall rules. You may edit your prompt or proceed anyway.'}
        </div>

        <div style="display:flex;gap:10px;margin-top:16px;justify-content:flex-end;">
          <button id="sp-cancel-btn" style="
            background:#18181f;color:#e8e8f0;border:1px solid #3a3a48;
            border-radius:6px;padding:9px 18px;font-size:12px;
            font-family:inherit;cursor:pointer;
          ">Edit Prompt</button>
          ${isWarn ? `
          <button id="sp-proceed-btn" style="
            background:#6c63ff;color:#fff;border:none;
            border-radius:6px;padding:9px 18px;font-size:12px;
            font-family:inherit;cursor:pointer;
          ">Send Anyway</button>` : ''}
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  document.getElementById('sp-cancel-btn').onclick = removeOverlay;
  if (isWarn && onProceed) {
    document.getElementById('sp-proceed-btn').onclick = () => {
      removeOverlay();
      onProceed();
    };
  }
}

function showCheckingBadge() {
  removeBadge();
  if (!document.getElementById('sp-keyframes')) {
    const s = document.createElement('style');
    s.id = 'sp-keyframes';
    s.textContent = `@keyframes sp-spin { to { transform:rotate(360deg); } }`;
    document.head.appendChild(s);
  }
  const badge = document.createElement('div');
  badge.id = 'safeprompt-badge';
  badge.style.cssText = `
    position:fixed; bottom:90px; left:50%; transform:translateX(-50%);
    background:#111118; border:1px solid #2a2a35; border-radius:20px;
    padding:7px 16px; font-family:'DM Mono',ui-monospace,monospace;
    font-size:11px; color:#6b6b80; z-index:999998;
    display:flex; align-items:center; gap:8px; pointer-events:none;
  `;
  badge.innerHTML = `
    <span style="
      display:inline-block;width:10px;height:10px;
      border:2px solid #3a3a48;border-top-color:#6c63ff;
      border-radius:50%;animation:sp-spin 0.6s linear infinite;
    "></span>
    SafePrompt checking…
  `;
  document.body.appendChild(badge);
}

function removeBadge() {
  const b = document.getElementById('safeprompt-badge');
  if (b) b.remove();
}

// ── DOM helpers — ChatGPT + Claude ────────────────────────────────────────────

function getPromptText() {
  // ChatGPT
  const chatgpt = document.querySelector('#prompt-textarea');
  if (chatgpt) return chatgpt.innerText.trim();

  // Claude
  const claude = document.querySelector('.ProseMirror[contenteditable="true"]');
  if (claude) return claude.innerText.trim();

  return '';
}

function findSubmitButton() {
  // ChatGPT
  const chatgpt =
    document.querySelector('[data-testid="send-button"]') ||
    document.querySelector('button[aria-label="Send prompt"]');
  if (chatgpt) return chatgpt;

  // Claude
  const claude =
    document.querySelector('button[aria-label="Send Message"]') ||
    document.querySelector('button[aria-label="Send message"]');
  if (claude) return claude;

  return null;
}

// ── Interception ──────────────────────────────────────────────────────────────

let intercepting = false;

function triggerNativeSubmit() {
  intercepting = true;
  const btn = findSubmitButton();
  if (btn) btn.click();
  setTimeout(() => { intercepting = false; }, 200);
}

async function handleInterception(e) {
  if (intercepting) return;

  const promptText = getPromptText();
  if (!promptText) return;

  e.preventDefault();
  e.stopImmediatePropagation();

  showCheckingBadge();

  try {
    const result = await checkPrompt(promptText);
    removeBadge();

    broadcastResult({ ...result, prompt: promptText });

    if (result.decision === 'pass') {
      triggerNativeSubmit();
      return;
    }

    showOverlay({
      ...result,
      prompt:    promptText,
      onProceed: result.decision === 'warn' ? triggerNativeSubmit : null,
    });

  } catch (err) {
    removeBadge();
    console.error('[SafePrompt] Check failed:', err);
    // Fail open — show warning but allow user to proceed
    showOverlay({
      decision:       'warn',
      score:          0,
      triggeredRules: [{ id: 'error', description: `Check failed: ${err.message}`, score: 0 }],
      elapsed:        0,
      source:         'error',
      prompt:         promptText,
      onProceed:      triggerNativeSubmit,
    });
  }
}

// ── Keyboard interception ─────────────────────────────────────────────────────

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || e.shiftKey) return;
  const el = document.activeElement;
  if (!el) return;
  const isComposer =
    el.id === 'prompt-textarea' ||
    el.classList.contains('ProseMirror') ||
    el.getAttribute('contenteditable') === 'true';
  if (isComposer) handleInterception(e);
}, true);

// ── Button interception (MutationObserver for SPA re-renders) ─────────────────

let attachedBtn = null;

function attachToSubmitButton() {
  const btn = findSubmitButton();
  if (!btn || btn === attachedBtn) return;
  if (attachedBtn) attachedBtn.removeEventListener('click', handleInterception, true);
  btn.addEventListener('click', handleInterception, true);
  attachedBtn = btn;
}

new MutationObserver(attachToSubmitButton)
  .observe(document.body, { childList: true, subtree: true });

attachToSubmitButton();
