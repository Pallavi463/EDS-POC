/**
 * Stats block: big numbers with labels.
 * Authoring: one row per stat → | 70% | LED-based share of total sales |
 * Numbers count up when the block scrolls into view.
 * @param {Element} block
 */
export default function decorate(block) {
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const [num, label] = row.children;
    if (!num) return;
    const li = document.createElement('li');
    const value = document.createElement('strong');
    value.className = 'stats-value';
    value.textContent = num.textContent.trim();
    li.append(value);
    if (label) {
      const span = document.createElement('span');
      span.className = 'stats-label';
      span.textContent = label.textContent.trim();
      li.append(span);
    }
    ul.append(li);
  });
  block.replaceChildren(ul);

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const animate = (el) => {
    const match = el.textContent.match(/^([^\d]*)([\d,.]+)(.*)$/);
    if (!match) return;
    const [, pre, digits, post] = match;
    const target = parseFloat(digits.replace(/,/g, ''));
    const useComma = digits.includes(',');
    const start = performance.now();
    const step = (now) => {
      const p = Math.min((now - start) / 1200, 1);
      const v = Math.round(target * (1 - (1 - p) ** 3));
      el.textContent = `${pre}${useComma ? v.toLocaleString('en-US') : v}${post}`;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      block.querySelectorAll('.stats-value').forEach(animate);
      io.disconnect();
    }
  }, { threshold: 0.4 });
  io.observe(block);
}
