/**
 * AI providers for the ai-assistant block.
 *
 * Contract (same for every provider):
 *   ask(question, history) -> Promise<{ answer: string, sources: [{title, url}], mode: string }>
 *
 * - mock: answers from a business-authored knowledge sheet + the site's query index.
 *         No model, no keys, works offline. Used when no endpoint is configured.
 * - remote: POSTs the question plus retrieved context to a backend you own
 *           (Azure Function / App Builder action) that calls the LLM. The browser never
 *           holds a model key. Falls back to mock if the endpoint fails.
 */

const STOPWORDS = new Set(('a an and are as at be by can do does for from has have how i in is it '
  + 'me my of on or our that the their there this to was what when where which who why will with '
  + 'you your about tell signify').split(' '));

export function tokenize(text = '') {
  return text.toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    // naive stemming so "brands"/"brand", "lighting"/"light" match
    .map((t) => t.replace(/(ings|ing|es|s)$/, ''));
}

/**
 * Weighted keyword overlap. `idf` down-weights words that appear in many rows
 * (e.g. "lighting"), so specific words like "price" or "career" decide the match.
 * Returns { score, hits } where hits = distinct query words matched.
 */
function score(queryTokens, fields, idf = () => 1) {
  let total = 0;
  const hits = new Set();
  fields.forEach(({ text, weight }) => {
    const tokens = new Set(tokenize(text));
    queryTokens.forEach((q) => {
      if (tokens.has(q)) {
        total += weight * idf(q);
        hits.add(q);
      }
    });
  });
  return { score: total, hits: hits.size };
}

function buildIdf(rows, fieldsOf) {
  const df = new Map();
  rows.forEach((row) => {
    const unique = new Set(fieldsOf(row).flatMap((t) => tokenize(t)));
    unique.forEach((t) => df.set(t, (df.get(t) || 0) + 1));
  });
  const n = rows.length || 1;
  return (t) => Math.log(1 + n / (df.get(t) || n));
}

async function loadSheet(url) {
  if (!url) return [];
  try {
    const resp = await fetch(url);
    if (!resp.ok) return [];
    const json = await resp.json();
    return json.data || [];
  } catch (e) {
    return [];
  }
}

/**
 * Retrieval shared by both providers: rank knowledge rows and indexed pages.
 */
export async function createRetriever({ knowledgeUrl, indexUrl }) {
  const [knowledge, pages] = await Promise.all([loadSheet(knowledgeUrl), loadSheet(indexUrl)]);
  const kIdf = buildIdf(knowledge, (r) => [r.keywords, r.question]);
  const pIdf = buildIdf(pages, (p) => [p.title, p.description]);
  return {
    knowledge,
    pages,
    search(question, limit = 3) {
      const q = tokenize(question);
      const facts = knowledge
        .map((row) => ({
          row,
          ...score(q, [
            { text: row.keywords, weight: 3 },
            { text: row.question, weight: 2 },
            { text: row.answer, weight: 0.5 },
          ], kIdf),
        }))
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score);
      const docs = pages
        .map((page) => ({
          page,
          ...score(q, [
            { text: page.title, weight: 2 },
            { text: page.description, weight: 1 },
          ], pIdf),
        }))
        // a page needs at least two matching words to count as relevant
        .filter((r) => r.hits >= 2)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
      return { facts, docs, queryTokens: q };
    },
  };
}

const FALLBACK = 'I could not find that in the information I have. Our teams can help directly through the contact page.';

function mockAnswer(retriever, question) {
  const { facts, docs } = retriever.search(question);
  const best = facts[0];
  const sources = [];
  let answer;
  if (best && best.score >= 4) {
    answer = best.row.answer;
    const { row } = best;
    if (row.link) sources.push({ title: row.title || row.question, url: row.link });
    facts.slice(1, 2).forEach(({ row: other, score: s }) => {
      if (s >= best.score * 0.6 && other.link && !sources.some((x) => x.url === other.link)) {
        sources.push({ title: other.title || other.question, url: other.link });
      }
    });
  } else if (docs.length) {
    answer = 'I don\'t have a direct answer, but these pages look relevant:';
  } else {
    answer = FALLBACK;
    const contact = retriever.knowledge.find((r) => /contact/i.test(r.keywords || ''));
    if (contact?.link) sources.push({ title: contact.title || 'Contact us', url: contact.link });
  }
  docs.forEach(({ page }) => {
    if (!sources.some((s) => s.url === page.path)) {
      sources.push({ title: page.title, url: page.path });
    }
  });
  return { answer, sources: sources.slice(0, 3), mode: 'mock' };
}

export async function createProvider({ endpoint, knowledgeUrl, indexUrl }) {
  const retriever = await createRetriever({ knowledgeUrl, indexUrl });

  const mock = {
    name: 'mock',
    async ask(question) {
      // small delay so the demo feels like a model call
      await new Promise((r) => { setTimeout(r, 450 + Math.random() * 400); });
      return mockAnswer(retriever, question);
    },
  };

  if (!endpoint) return mock;

  return {
    name: 'remote',
    async ask(question, history = []) {
      const { facts, docs } = retriever.search(question, 5);
      // grounding context sent to the backend; the backend builds the prompt
      const context = [
        ...facts.slice(0, 3)
          .map(({ row }) => ({ title: row.question, url: row.link, text: row.answer })),
        ...docs.map(({ page }) => ({ title: page.title, url: page.path, text: page.description })),
      ];
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      try {
        const resp = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question,
            history: history.slice(-6),
            context,
            locale: document.documentElement.lang || 'en',
          }),
          signal: controller.signal,
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const json = await resp.json();
        return { answer: json.answer, sources: json.sources || [], mode: 'remote' };
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('ai-assistant: endpoint failed, using mock', e);
        return mock.ask(question);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
