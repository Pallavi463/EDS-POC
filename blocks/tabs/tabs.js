/**
 * Tabs block.
 * Authoring: one row per tab → | tab label | tab content (any content, incl. images) |
 * @param {Element} block
 */
let tabsCount = 0;

export default function decorate(block) {
  tabsCount += 1;
  const id = `tabs-${tabsCount}`;
  const list = document.createElement('div');
  list.className = 'tabs-list';
  list.setAttribute('role', 'tablist');
  const panels = [];

  [...block.children].forEach((row, i) => {
    const [labelCell, contentCell] = row.children;
    if (!labelCell) return;
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'tabs-tab';
    tab.id = `${id}-tab-${i}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', `${id}-panel-${i}`);
    tab.textContent = labelCell.textContent.trim();

    const panel = contentCell || document.createElement('div');
    panel.className = 'tabs-panel';
    panel.id = `${id}-panel-${i}`;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tab.id);
    // logos authored as a run of images get laid out as a grid
    if (panel.querySelectorAll('picture').length > 1) panel.classList.add('tabs-panel-logos');

    list.append(tab);
    panels.push(panel);
  });

  const select = (idx) => {
    [...list.children].forEach((t, n) => {
      t.setAttribute('aria-selected', n === idx);
      t.tabIndex = n === idx ? 0 : -1;
    });
    panels.forEach((p, n) => { p.hidden = n !== idx; });
  };

  list.addEventListener('click', (e) => {
    const tab = e.target.closest('.tabs-tab');
    if (tab) select([...list.children].indexOf(tab));
  });
  list.addEventListener('keydown', (e) => {
    const tabs = [...list.children];
    const idx = tabs.indexOf(document.activeElement);
    if (idx < 0) return;
    let next;
    if (e.key === 'ArrowRight') next = (idx + 1) % tabs.length;
    if (e.key === 'ArrowLeft') next = (idx - 1 + tabs.length) % tabs.length;
    if (next !== undefined) { select(next); tabs[next].focus(); }
  });

  block.replaceChildren(list, ...panels);
  select(0);
}
