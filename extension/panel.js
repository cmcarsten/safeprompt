/**
 * SafePrompt — panel.js
 * Popup UI logic. Reads results from chrome.storage, renders
 * the decision card and audit log, handles settings.
 */

// ── Utilities ─────────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

// ── Decision card ─────────────────────────────────────────────────────────────

function renderDecision({ decision, score, triggeredRules, elapsed, prompt, ts }) {
  document.getElementById('decisionEmpty').style.display = 'none';
  const card = document.getElementById('decisionCard');
  card.style.display = 'block';

  const label = decision === 'pass' ? '✓ Passed'
              : decision === 'warn' ? '⚠ Warning'
              : '✗ Blocked';

  const rulesHtml = triggeredRules && triggeredRules.length
    ? triggeredRules.map(r => `
        <div class="rule-item">
          <span class="rule-name">${escHtml(r.description || r.id)}</span>
          <span class="rule-score">+${r.score}</span>
        </div>`).join('')
    : '<div class="no-rules">No rules triggered</div>';

  card.innerHTML = `
    <div class="decision-card ${decision}">
      <div class="decision-header">
        <span class="decision-badge">${label}</span>
        <span class="decision-score">score: ${score}</span>
      </div>
      <div class="decision-body">
        <div class="meta-label" style="margin-bottom:5px;">prompt</div>
        <div class="decision-prompt">${escHtml(prompt || '')}</div>
        <div class="decision-meta">
          <div class="meta-item">
            <span class="meta-label">Time</span>
            <span class="meta-value">${ts ? fmtTime(ts) : '—'}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Latency</span>
            <span class="meta-value">${elapsed}ms</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Rules fired</span>
            <span class="meta-value">${triggeredRules ? triggeredRules.length : 0}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Mode</span>
            <span class="meta-value">local</span>
          </div>
        </div>
        <div class="meta-label" style="margin-bottom:6px;">triggered rules</div>
        <div class="rules-list">${rulesHtml}</div>
      </div>
    </div>
  `;
}

// ── Audit log ─────────────────────────────────────────────────────────────────

function prependAuditEntry({ decision, score, triggeredRules, elapsed, prompt, ts }) {
  document.getElementById('auditEmpty').style.display = 'none';
  const item = document.createElement('div');
  item.className = 'audit-item';
  item.innerHTML = `
    <div class="audit-dot ${decision}"></div>
    <div class="audit-info">
      <div class="audit-prompt">${escHtml(prompt || '')}</div>
      <div class="audit-meta">
        ${triggeredRules && triggeredRules.length
          ? triggeredRules.map(r => r.id).join(', ')
          : 'clean'} · ${elapsed}ms${ts ? ' · ' + fmtTime(ts) : ''}
      </div>
    </div>
    <div class="audit-score">${score}</div>
  `;
  document.getElementById('auditList').prepend(item);
}

// ── Settings ──────────────────────────────────────────────────────────────────

document.getElementById('clearAuditBtn').addEventListener('click', () => {
  chrome.storage.local.set({ auditLog: [], lastFirewallResult: null }, () => {
    document.getElementById('auditList').innerHTML = '';
    document.getElementById('auditEmpty').style.display = 'block';
    document.getElementById('decisionCard').style.display = 'none';
    document.getElementById('decisionEmpty').style.display = 'block';
  });
});

// ── Load existing data + watch for updates ────────────────────────────────────

chrome.storage.local.get(['lastFirewallResult', 'auditLog'], ({ lastFirewallResult, auditLog }) => {
  if (lastFirewallResult) renderDecision(lastFirewallResult);
  if (auditLog && auditLog.length) {
    document.getElementById('auditEmpty').style.display = 'none';
    [...auditLog].reverse().forEach(entry => prependAuditEntry(entry));
  }
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.lastFirewallResult?.newValue) {
    renderDecision(changes.lastFirewallResult.newValue);
    prependAuditEntry(changes.lastFirewallResult.newValue);
  }
});
