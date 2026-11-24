/**
 * Turns an authored data link into a same-origin path.
 * Authors paste absolute links in Word (e.g. https://www.signify.com/ai-knowledge.json);
 * on aem.page / aem.live / localhost the sheet lives on the current site, and fetching
 * the absolute URL would hit another origin (CORS). Keeps the path, drops the host.
 * @param {string} href
 * @returns {string}
 */
// eslint-disable-next-line import/prefer-default-export
export function toSitePath(href) {
  if (!href) return href;
  try {
    const url = new URL(href, window.location.href);
    if (url.origin === window.location.origin) return `${url.pathname}${url.search}`;
    // only rewrite JSON data endpoints; leave real external APIs (e.g. an AI backend) alone
    if (url.pathname.endsWith('.json')) return `${url.pathname}${url.search}`;
    return url.href;
  } catch (e) {
    return href;
  }
}
