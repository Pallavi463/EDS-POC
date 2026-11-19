import { createOptimizedPicture } from '../../scripts/aem.js';

/**
 * Carousel block.
 * Authoring: one row per slide → | image | heading, text, CTA links |
 * Variants: (autoplay) rotates every 6s, paused on hover/focus.
 * @param {Element} block
 */
export default function decorate(block) {
  const slides = [...block.children];
  const track = document.createElement('ul');
  track.className = 'carousel-track';

  slides.forEach((row, i) => {
    const li = document.createElement('li');
    li.className = 'carousel-slide';
    li.setAttribute('role', 'group');
    li.setAttribute('aria-roledescription', 'slide');
    li.setAttribute('aria-label', `${i + 1} of ${slides.length}`);
    [...row.children].forEach((cell) => {
      const hasText = cell.textContent.trim() !== '';
      const pic = cell.querySelector('picture');
      if (pic && !hasText) {
        cell.className = 'carousel-slide-image';
        const img = pic.querySelector('img');
        // first slide is the LCP candidate: keep it eager
        pic.replaceWith(createOptimizedPicture(img.src, img.alt, i === 0, [{ media: '(min-width: 900px)', width: '2000' }, { width: '900' }]));
        li.append(cell);
      } else if (hasText) {
        cell.className = 'carousel-slide-content';
        li.append(cell);
      }
    });
    if (i !== 0) li.setAttribute('aria-hidden', 'true');
    track.append(li);
  });

  block.replaceChildren(track);
  block.setAttribute('role', 'region');
  block.setAttribute('aria-roledescription', 'carousel');
  if (slides.length < 2) return;

  let current = 0;
  const dots = document.createElement('div');
  dots.className = 'carousel-dots';

  const show = (idx) => {
    current = (idx + slides.length) % slides.length;
    track.style.transform = `translateX(-${current * 100}%)`;
    [...track.children].forEach((s, n) => {
      if (n === current) s.removeAttribute('aria-hidden');
      else s.setAttribute('aria-hidden', 'true');
      s.querySelectorAll('a').forEach((a) => { a.tabIndex = n === current ? 0 : -1; });
    });
    [...dots.children].forEach((d, n) => d.setAttribute('aria-current', n === current));
  };

  slides.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.setAttribute('aria-label', `Show slide ${i + 1}`);
    dot.addEventListener('click', () => show(i));
    dots.append(dot);
  });

  const nav = document.createElement('div');
  nav.className = 'carousel-nav';
  [['prev', 'Previous slide', -1], ['next', 'Next slide', 1]].forEach(([cls, label, dir]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `carousel-${cls}`;
    btn.setAttribute('aria-label', label);
    btn.addEventListener('click', () => show(current + dir));
    nav.append(btn);
  });

  block.append(nav, dots);
  show(0);

  // touch swipe for mobile, where the arrow buttons are hidden
  let touchX = null;
  block.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  block.addEventListener('touchend', (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 40) show(current + (dx < 0 ? 1 : -1));
    touchX = null;
  });

  if (block.classList.contains('autoplay') && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    let timer;
    const start = () => { timer = setInterval(() => show(current + 1), 6000); };
    const stop = () => clearInterval(timer);
    block.addEventListener('mouseenter', stop);
    block.addEventListener('mouseleave', start);
    block.addEventListener('focusin', stop);
    block.addEventListener('focusout', start);
    start();
  }
}
