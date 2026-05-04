import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitize rich-text HTML produced by our backstage editors before
 * rendering it via `dangerouslySetInnerHTML`. Protects against XSS
 * if a backstage admin's account is ever compromised, or if rich-text
 * editing is ever delegated to less-trusted users.
 *
 * Defaults are appropriate for our use cases (program descriptions,
 * agreement document bodies). Pass options to override per call.
 */
export function sanitizeHtml(html, options = {}) {
  if (!html) return '';
  return DOMPurify.sanitize(html, options);
}