/**
 * Press releases: list rendered from a spreadsheet (JSON endpoint).
 * Authoring: | Source | link to the sheet, e.g. /press-releases.json |
 *            | Limit  | 3 |  (optional)
 * The sheet needs columns: title, date, path, category.
 * Demonstrates EDS "spreadsheets as data": business edits rows, the site updates on publish.
 * @param {Element} block
 */
function readConfig(block) {
  const config = {};
  [...block.children].forEach((row) => {
    const [k, v] = row.children;
    if (!k || !v) return;
    const a = v.querySelector('a');
    config[k.textContent.trim().toLowerCase()] = a ? a.getAttribute('href') : v.textContent.trim();
  });
  return config;
}

export default async function decorate(block) {
  const config = readConfig(block);
  const limit = parseInt(config.limit, 10) || 3;
  block.textContent = '';
  if (!config.source) return;

  try {
    const resp = await fetch(config.source);
    if (!resp.ok) throw new Error(resp.status);
    const json = await resp.json();
    const rows = (json.data || [])
      .slice()
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, limit);

    const ul = document.createElement('ul');
    rows.forEach((item) => {
      const li = document.createElement('li');
      const meta = document.createElement('p');
      meta.className = 'press-releases-meta';
      const date = new Date(item.date);
      meta.textContent = [
        item.category,
        Number.isNaN(date.getTime()) ? item.date : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      ].filter(Boolean).join(' · ');
      const h3 = document.createElement('h3');
      const a = document.createElement('a');
      a.href = item.path || '#';
      a.textContent = item.title;
      h3.append(a);
      li.append(meta, h3);
      ul.append(li);
    });
    block.append(ul);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('press-releases: could not load', config.source, e);
  }
}
