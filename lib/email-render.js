/**
 * lib/email-render.js
 *
 * Renders email templates with variable substitution and simple conditional blocks.
 *
 * Supported syntax:
 *   {{variable}}              — replaced with vars[variable], or '' if missing
 *   {{#if variable}}...{{/if}} — content kept if vars[variable] is truthy, removed if falsy
 *
 * Conditionals are evaluated FIRST so that {{var}} substitutions inside surviving
 * conditional blocks still work correctly.
 *
 * Truthy means: non-empty string, non-zero number, true. Empty string '', 0, null,
 * undefined, false, and the literal strings '$0.00' and '0' are treated as falsy
 * for template purposes (so a "$0.00 balance" doesn't render the balance block).
 *
 * Used by all email-sending routes for consistent rendering.
 */

function isTruthy(value) {
  if (value === null || value === undefined) return false;
  if (value === false) return false;
  if (value === '' || value === 0) return false;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '' || trimmed === '0' || trimmed === '$0.00') return false;
  }
  return true;
}

export function renderTemplate(template, vars = {}) {
  if (!template) return '';

  let output = template;

  // 1. Process {{#if var}}...{{/if}} conditional blocks first.
  //    [\s\S] matches across newlines; non-greedy *? to handle multiple if-blocks.
  output = output.replace(
    /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_match, varName, content) => (isTruthy(vars[varName]) ? content : '')
  );

  // 2. Substitute {{var}} with values. Missing vars become empty strings.
  output = output.replace(/\{\{(\w+)\}\}/g, (_match, varName) => {
    const v = vars[varName];
    return v === null || v === undefined ? '' : String(v);
  });

  return output;
}

/**
 * Convenience: render both subject and body in one call.
 * Returns { subject, html }.
 */
export function renderEmail({ subject, body_html }, vars = {}) {
  return {
    subject: renderTemplate(subject || '', vars),
    html:    renderTemplate(body_html || '', vars),
  };
}