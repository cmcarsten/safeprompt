/**
 * SafePrompt — rules.js
 *
 * Local rules engine. All rules run entirely in the browser —
 * no backend required for the default configuration.
 *
 * HOW TO ADD YOUR OWN RULES
 * ─────────────────────────
 * Each rule in LLM_RULES follows this structure:
 *
 *   {
 *     id:          "unique_rule_id",        // used in audit log + overlay
 *     description: "Human readable label",  // shown to the user on warn/block
 *     score:       50,                      // risk points this rule adds
 *     enabled:     true,                    // set false to disable without deleting
 *
 *     // Use ONE of the following match types:
 *     pattern:  /your-regex/i,             // single regex (e.g. PII patterns)
 *     patterns: [/regex1/i, /regex2/i],    // any match triggers the rule
 *     keywords: ["phrase one", "phrase2"], // case-insensitive substring match
 *   }
 *
 * THRESHOLDS
 * ──────────
 * warn_score — score at or above this shows a warning (user can override)
 * deny_score — score at or above this hard-blocks the prompt
 *
 * Scores are additive: if a prompt matches two rules scoring 40 each,
 * the total is 80. Tune scores and thresholds to match your risk tolerance.
 *
 * RULE PACKS
 * ──────────
 * Additional rule packs for HIPAA, SOC2, financial services, etc. are
 * available in the /rules directory of the SafePrompt GitHub repo.
 * Copy rules from those files into LLM_RULES below to enable them.
 */

// ── Thresholds ────────────────────────────────────────────────────────────────

const THRESHOLDS = {
  warn: 40,   // yellow warning, user can override
  deny: 70,   // hard block, no override
};

// ── LLM Policy Rules ─────────────────────────────────────────────────────────

const LLM_RULES = [

  // ── PII: Social Security Number ───────────────────────────────────────────
  {
    id:          "pii_ssn",
    description: "Social Security Number (SSN) detected",
    score:       70,
    enabled:     true,
    pattern:     /\b(?!000|666|9\d{2})\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/,
  },

  // ── PII: Credit Card Number ───────────────────────────────────────────────
  {
    id:          "pii_credit_card",
    description: "Credit card number detected",
    score:       70,
    enabled:     true,
    pattern:     /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/,
  },

  // ── PII: Email Address ────────────────────────────────────────────────────
  // Lower to 20+ if your org policy allows sharing email addresses.
  {
    id:          "pii_email",
    description: "Email address detected",
    score:       40,
    enabled:     true,
    pattern:     /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/,
  },

  // ── PII: API Key / Secret ─────────────────────────────────────────────────
  {
    id:          "pii_api_key",
    description: "API key or secret credential detected",
    score:       70,
    enabled:     true,
    pattern:     /(?:api[_\-]?key|secret|token|password|passwd|pwd)\s*[=:'"]\s*[A-Za-z0-9+/=_\-]{20,}/i,
  },

  // ── PII: Private Key / Certificate ───────────────────────────────────────
  {
    id:          "pii_private_key",
    description: "Private key or certificate detected",
    score:       70,
    enabled:     true,
    pattern:     /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  },

  // ── Prompt Injection ──────────────────────────────────────────────────────
  {
    id:          "prompt_injection",
    description: "Prompt injection attempt detected",
    score:       40,
    enabled:     true,
    patterns: [
      /ignore (previous|prior|all|above) instructions/i,
      /disregard (your|all|any) (previous |prior )?(instructions|rules|constraints|guidelines)/i,
      /disregard (previous |prior )?(instructions|rules|constraints|guidelines)/i,
      /you are now( a)?( an?)? (different|new|another)? ?(ai|model|assistant|bot|persona|character)/i,
      /do anything now/i,
      /jailbreak/i,
      /pretend you (have no|don't have any) (restrictions|limitations|rules)/i,
      /act as if you were/i,
      /roleplay as/i,
      /simulate being/i,
      /forget (you are|that you're|your) (an? )?ai/i,
      /developer mode/i,
      /\[system\]/i,
    ],
  },

  // ── Legal Privilege ───────────────────────────────────────────────────────
  // Detects content that may be protected by attorney-client privilege
  // or work product doctrine. High score — these are hard blocks by default.
  {
    id:          "legal_privilege",
    description: "Potentially privileged legal content detected",
    score:       70,
    enabled:     true,
    keywords: [
      "attorney-client privilege",
      "attorney client privilege",
      "attorney work product",
      "work product doctrine",
      "privileged and confidential",
      "privileged communication",
      "do not disclose",
      "do not distribute",
      "confidential settlement",
      "settlement agreement",
      "subject to privilege",
      "legal hold",
      "litigation hold",
      "prepared in anticipation of litigation",
      "for settlement purposes only",
    ],
  },

  // ── Sensitive Legal Topics ────────────────────────────────────────────────
  // Lower score (30) — these are common terms that warrant a warning
  // but not an automatic block. Combine with legal_privilege for context.
  {
    id:          "sensitive_topic",
    description: "Sensitive legal topic detected",
    score:       30,
    enabled:     true,
    keywords: [
      "settlement amount",
      "opposing counsel",
      "case strategy",
      "without prejudice",
      "mediation",
    ],
  },

];

// ── Evaluation Engine ─────────────────────────────────────────────────────────

/**
 * Evaluate a prompt against all enabled rules.
 * Returns { decision, score, triggeredRules }
 *
 * decision: "pass" | "warn" | "deny"
 * score:    total risk score (sum of matched rule scores)
 * triggeredRules: array of { id, description, score }
 */
function evaluate(promptText) {
  const text           = promptText || "";
  const triggeredRules = [];
  let   totalScore     = 0;

  for (const rule of LLM_RULES) {
    if (!rule.enabled) continue;

    let matched = false;

    // Single regex pattern
    if (rule.pattern) {
      matched = rule.pattern.test(text);
    }

    // Array of regex patterns — any match triggers the rule
    if (!matched && rule.patterns) {
      matched = rule.patterns.some(p => p.test(text));
    }

    // Keyword list — case-insensitive substring match
    if (!matched && rule.keywords) {
      const lower = text.toLowerCase();
      matched = rule.keywords.some(kw => lower.includes(kw.toLowerCase()));
    }

    if (matched) {
      triggeredRules.push({
        id:          rule.id,
        description: rule.description,
        score:       rule.score,
      });
      totalScore += rule.score;
    }
  }

  let decision = "pass";
  if (totalScore >= THRESHOLDS.deny) decision = "deny";
  else if (totalScore >= THRESHOLDS.warn) decision = "warn";

  return { decision, score: totalScore, triggeredRules };
}
