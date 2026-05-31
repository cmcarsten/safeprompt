# SafePrompt — LLM Prompt Firewall

A lightweight Chrome extension that intercepts prompts before they reach AI chat tools, checking them against a local rules engine to prevent sensitive data leakage and prompt injection attacks.

**No backend required. No data leaves your browser. Free to use.**

---

## The Problem

Employees and professionals are increasingly using AI chat tools for everyday work. In doing so, they often inadvertently include sensitive information in their prompts — client SSNs, API keys, privileged legal content, credentials — without realizing the risk. SafePrompt sits between the user and the AI, quietly checking every prompt before it's sent.

---

## How It Works

```
User types prompt → hits Send
        ↓
SafePrompt intercepts before anything leaves the browser
        ↓
Local rules engine checks the prompt — nothing sent anywhere
        ↓
PASS  →  prompt goes through silently, no interruption
WARN  →  overlay shows which rules fired, user can edit or send anyway
BLOCK →  hard block with explanation, user must edit before sending
```

---

## Supported AI Tools

| Tool | Status |
|------|--------|
| ChatGPT (chatgpt.com) | ✅ Supported |
| Claude (claude.ai) | ✅ Supported |
| Others (Gemini, Copilot, Perplexity, etc.) | ⚙️ Configurable — see [Adding More AI Tools](#adding-more-ai-tools) |

---

## Installation

### Step 1 — Download

Clone this repo or download and unzip it:

```bash
git clone https://github.com/cmcarsten/safeprompt
```

### Step 2 — Load into Chrome

1. Open Chrome and navigate to **`chrome://extensions`**
2. Enable **Developer mode** using the toggle in the top-right corner
3. Click **Load unpacked**
4. Select the **`extension`** folder inside the repo

The SafePrompt icon (purple **SP**) will appear in your Chrome toolbar. If you don't see it, click the puzzle piece (Extensions) icon and pin SafePrompt.

### Step 3 — Enable in Incognito (recommended)

By default Chrome disables extensions in Incognito windows. To enable SafePrompt there:

1. Go to **`chrome://extensions`**
2. Find SafePrompt and click **Details**
3. Scroll down to **Allow in Incognito** and toggle it on

> ⚠️ Without this step SafePrompt will not intercept prompts in Incognito windows.

### Step 4 — Test it

Navigate to [ChatGPT](https://chatgpt.com) or [Claude](https://claude.ai) and try:

```
My SSN is 123-45-6789
```

You should see the SafePrompt block overlay appear before the message sends.

---

## What Gets Detected

SafePrompt ships with a baseline ruleset covering several common risks. However, the baseline rules are intended as a starting point rather than a comprehensive policy. Every organization is different and risks evolve, so the rules are designed to be easy to update and extend so you can tailor them to your specific use cases.

| Rule | What it catches | Score |
|------|----------------|-------|
| `pii_ssn` | Social Security Numbers | 70 |
| `pii_credit_card` | Credit card numbers | 70 |
| `pii_email` | Email addresses | 40 |
| `pii_api_key` | API keys and credentials | 70 |
| `pii_private_key` | Private keys / certificates | 70 |
| `prompt_injection` | Jailbreak and injection attempts | 40 |
| `legal_privilege` | Attorney-client privileged content | 70 |
| `sensitive_topic` | Sensitive legal topics | 30 |

**Scoring thresholds:**
- **Warn** (yellow): total score ≥ 40 — overlay shown, user can override
- **Block** (red): total score ≥ 70 — hard block, no override

Scores are additive. A prompt matching two rules scoring 40 each totals 80 and is hard blocked.

---

## Customizing Rules

All rules live in `extension/rules.js`. The file is heavily commented to guide you through adding your own.

### Adding a keyword rule

```javascript
{
  id:          "hipaa_phi",
  description: "Potential HIPAA protected health information",
  score:       70,
  enabled:     true,
  keywords: [
    "patient name",
    "date of birth",
    "medical record",
    "diagnosis",
  ],
},
```

### Adding a pattern rule

```javascript
{
  id:          "pii_phone",
  description: "Phone number detected",
  score:       30,
  enabled:     true,
  pattern:     /\b(\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/,
},
```

### Adjusting thresholds

At the top of `rules.js`:

```javascript
const THRESHOLDS = {
  warn: 40,   // lower to warn on more prompts
  deny: 70,   // lower to block more prompts
};
```

After any changes reload the extension at `chrome://extensions` then refresh your ChatGPT or Claude tab.

---

## Adding More AI Tools

**1. Add the URL to `manifest.json`:**

```json
"matches": [
  "https://chatgpt.com/*",
  "https://claude.ai/*",
  "https://gemini.google.com/*"
]
```

**2. Add selectors to `content.js`** in `getPromptText()` and `findSubmitButton()`. You can find the right selectors by right-clicking the input field on the page and choosing Inspect in Chrome DevTools.

---

## Privacy

- Prompts are evaluated entirely in your browser
- No data is sent to any SafePrompt server
- The audit log is stored locally in browser extension storage only

---

## What's Next

If there's interest from the community, a **v2 cloud edition** is planned that would add:

- 📄 **Document scanning** — detect sensitive content in files before they are uploaded to AI tools
- 🏢 **Team dashboard** — centralized visibility across an organization
- 📋 **Compliance reporting** — audit logs formatted for HIPAA, SOC2, and legal review
- 🔔 **Admin alerts** — notify security teams when high-risk prompts are blocked
- ⚙️ **Centralized rule management** — manage rules across all users from one place

If any of these features would be useful to you, open an issue or leave a star — it helps gauge interest.

---

## Contributing

Contributions welcome, particularly:
- Rule additions for specific industries or compliance frameworks
- Selector support for additional AI chat tools
- Bug reports and edge cases

---

## License

MIT — see `LICENSE` for details.

---

## Disclaimer

SafePrompt is a best-effort tool designed to reduce the risk of accidental data exposure. It is not a substitute for organizational data governance policies, employee training, or legal advice.
