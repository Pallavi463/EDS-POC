import { createProvider } from './ai-providers.js';

/**
 * AI Assistant block.
 * Authoring (two-column config table):
 *   | Title       | Ask Signify |
 *   | Intro       | Ask about our brands, products, careers or investors. |
 *   | Knowledge   | /ai-knowledge.json   (sheet: keywords, question, answer, link, title) |
 *   | Index       | /query-index.json    (optional: site pages to suggest) |
 *   | Endpoint    | (leave empty for mock mode; set to the AI backend URL later) |
 *   | Suggestions | bulleted list of starter questions |
 * Variant: (floating) renders a launcher button bottom-right instead of inline.
 */

const MAX_LEN = 400;

function readConfig(block) {
  const cfg = {};
  [...block.children].forEach((row) => {
    const [k, v] = row.children;
    if (!k || !v) return;
    const key = k.textContent.trim().toLowerCase();
    const items = [...v.querySelectorAll('li')].map((li) => li.textContent.trim());
    const a = v.querySelector('a');
    if (items.length) cfg[key] = items;
    else if (a) cfg[key] = a.getAttribute('href');
    else cfg[key] = v.textContent.trim();
  });
  return cfg;
}

function el(tag, attrs = {}, text = '') {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  if (text) node.textContent = text;
  return node;
}

function renderSources(sources) {
  if (!sources?.length) return null;
  const wrap = el('div', { class: 'ai-assistant-sources' });
  wrap.append(el('span', {}, 'Sources'));
  const ul = el('ul');
  sources.forEach(({ title, url }) => {
    if (!url) return;
    const li = el('li');
    const a = el('a', { href: url }, title || url);
    if (/^https?:/.test(url) && !url.startsWith(window.location.origin)) {
      a.target = '_blank';
      a.rel = 'noopener';
    }
    li.append(a);
    ul.append(li);
  });
  wrap.append(ul);
  return wrap;
}

async function typeOut(node, text) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    node.textContent = text;
    return;
  }
  const words = text.split(' ');
  for (let i = 0; i < words.length; i += 1) {
    node.textContent = words.slice(0, i + 1).join(' ');
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => { setTimeout(r, 18); });
  }
}

export default async function decorate(block) {
  const cfg = readConfig(block);
  const floating = block.classList.contains('floating');
  block.textContent = '';

  const panel = el('div', { class: 'ai-assistant-panel', role: 'dialog', 'aria-label': cfg.title || 'AI assistant' });
  const head = el('div', { class: 'ai-assistant-head' });
  const title = el('h2', {}, cfg.title || 'Ask Signify');
  title.append(el('span', { class: 'ai-assistant-badge' }, 'AI'));
  head.append(title);
  if (cfg.intro) head.append(el('p', {}, cfg.intro));

  const log = el('div', { class: 'ai-assistant-log', role: 'log', 'aria-live': 'polite' });
  const chips = el('div', { class: 'ai-assistant-chips' });
  const form = el('form', { class: 'ai-assistant-form' });
  const input = el('input', {
    type: 'text', name: 'q', maxlength: MAX_LEN, autocomplete: 'off', placeholder: 'Ask a question…', 'aria-label': 'Your question',
  });
  const send = el('button', { type: 'submit', class: 'button primary' }, 'Ask');
  form.append(input, send);
  const note = el('p', { class: 'ai-assistant-note' }, 'AI-generated answers can be inaccurate. Check important details on the linked pages.');
  panel.append(head, log, chips, form, note);

  const history = [];
  let busy = false;
  const providerPromise = createProvider({
    endpoint: cfg.endpoint,
    knowledgeUrl: cfg.knowledge,
    indexUrl: cfg.index,
  });
  providerPromise.then((p) => {
    panel.dataset.mode = p.name;
    if (p.name === 'mock') note.textContent = `Demo mode: answers come from a curated knowledge sheet, not a live model. ${note.textContent}`;
  });

  const addMessage = (role, text) => {
    const msg = el('div', { class: `ai-assistant-msg ${role}` });
    const body = el('p');
    body.textContent = text;
    msg.append(body);
    log.append(msg);
    log.scrollTop = log.scrollHeight;
    return { msg, body };
  };

  const ask = async (raw) => {
    const question = raw.trim().slice(0, MAX_LEN);
    if (!question || busy) return;
    busy = true;
    send.disabled = true;
    input.value = '';
    chips.hidden = true;
    addMessage('user', question);
    const { msg, body } = addMessage('bot', '');
    msg.classList.add('thinking');
    body.textContent = 'Thinking…';
    try {
      const provider = await providerPromise;
      const { answer, sources } = await provider.ask(question, history);
      msg.classList.remove('thinking');
      await typeOut(body, answer);
      const src = renderSources(sources);
      if (src) msg.append(src);
      history.push({ role: 'user', content: question }, { role: 'assistant', content: answer });
    } catch (e) {
      msg.classList.remove('thinking');
      body.textContent = 'Sorry, something went wrong. Please try again.';
    } finally {
      busy = false;
      send.disabled = false;
      log.scrollTop = log.scrollHeight;
      input.focus();
    }
  };

  (cfg.suggestions || []).forEach((s) => {
    const chip = el('button', { type: 'button', class: 'ai-assistant-chip' }, s);
    chip.addEventListener('click', () => ask(s));
    chips.append(chip);
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    ask(input.value);
  });

  if (!floating) {
    block.append(panel);
    return;
  }

  const launcher = el('button', { type: 'button', class: 'ai-assistant-launcher', 'aria-expanded': 'false' }, cfg.title || 'Ask Signify');
  panel.hidden = true;
  const close = el('button', { type: 'button', class: 'ai-assistant-close', 'aria-label': 'Close assistant' }, '×');
  head.prepend(close);
  const toggle = (open) => {
    panel.hidden = !open;
    launcher.setAttribute('aria-expanded', open);
    if (open) input.focus();
    else launcher.focus();
  };
  launcher.addEventListener('click', () => toggle(panel.hidden));
  close.addEventListener('click', () => toggle(false));
  panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') toggle(false); });
  block.append(launcher, panel);
}
