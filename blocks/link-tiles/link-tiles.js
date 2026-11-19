/**
 * Link tiles: turns a list of links into clickable tiles.
 * Authoring: a single cell containing a bulleted list of links.
 * @param {Element} block
 */
export default function decorate(block) {
  const links = [...block.querySelectorAll('a')];
  const ul = document.createElement('ul');
  links.forEach((a) => {
    const li = document.createElement('li');
    a.className = 'link-tiles-tile';
    a.removeAttribute('title');
    li.append(a);
    ul.append(li);
  });
  block.replaceChildren(ul);
}
