import { createOptimizedPicture } from '../../scripts/aem.js';

/**
 * Teaser block: image beside text with CTA.
 * Authoring: | image | heading, text, CTA |  (one row, cell order is free)
 * Variants: (reverse) image on the right, (dark) navy background, (banner) full-width image.
 * @param {Element} block
 */
export default function decorate(block) {
  const row = block.firstElementChild;
  if (!row) return;
  const cells = [...row.children];
  const media = cells.find((c) => c.querySelector('picture') && c.textContent.trim() === '');
  const body = cells.find((c) => c !== media);

  if (media) {
    media.className = 'teaser-image';
    const img = media.querySelector('img');
    media.querySelector('picture').replaceWith(
      createOptimizedPicture(img.src, img.alt, false, [{ media: '(min-width: 900px)', width: '1200' }, { width: '750' }]),
    );
  }
  if (body) {
    body.className = 'teaser-content';
    // first short paragraph before the heading becomes an eyebrow label
    const first = body.firstElementChild;
    if (first && first.tagName === 'P' && first.nextElementSibling?.tagName?.match(/^H[1-6]$/)) {
      first.className = 'teaser-eyebrow';
    }
  }
  block.replaceChildren(...[media, body].filter(Boolean));
}
