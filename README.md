# Signify EDS POC

A proof of concept that rebuilds the **signify.com homepage** on **AEM Edge Delivery Services (EDS)** with **document-based authoring**: authors write in Word (SharePoint) or Google Docs, developers ship blocks from GitHub, and pages are served from Adobe's edge.

The aim is to show the business three things:

1. **Authoring speed**: a page is a Word document. Edit, preview, publish. No AEM training needed.
2. **Performance**: EDS sites are built to score close to 100 on Lighthouse by default.
3. **Developer velocity**: plain JS/CSS blocks, no Maven build, every Git branch gets its own preview URL.

---

## What's in the repo

| Path | What it is |
| --- | --- |
| `blocks/carousel` | News carousel (homepage hero). Variant `autoplay`. Keyboard, swipe and reduced-motion aware |
| `blocks/teaser` | Image + text + CTA. Variants `reverse`, `dark`, `banner` |
| `blocks/tabs` | Accessible tabs. A run of images in a tab becomes a logo grid ("Our brands") |
| `blocks/stats` | Big-number facts with count-up animation |
| `blocks/link-tiles` | A bulleted list of links rendered as tiles |
| `blocks/press-releases` | **Spreadsheet-driven** list: reads a sheet published as JSON |
| `blocks/ai-assistant` | **"Ask Signify" AI assistant**. Mock mode by default; swap in a real model with one config row. Variant `floating` |
| `llms.txt` | Guide for AI assistants and LLM crawlers to the key pages |
| `blocks/header`, `footer`, `columns`, `cards`, `hero`, `fragment` | Boilerplate blocks (header/footer load `nav` and `footer` documents) |
| `styles/styles.css` | Brand tokens (POC approximations, swap for official values) plus `dark`, `light`, `center` section styles |
| `scripts/scripts.js` | Boilerplate plus client-side Section Metadata handling (see Risks) |
| `authoring/` | **Ready-to-upload content source**: `index.docx`, `nav.docx`, `footer.docx`, `press-releases.xlsx`, `ai-knowledge.xlsx` |
| `drafts/` | The same content as local HTML for offline development (`aem up --html-folder drafts`) |

`authoring/` and `drafts/` are in `.hlxignore`, so they are never served from the code bus.

---

## Run it locally (no Adobe setup needed)

```sh
npm i
npm i -g @adobe/aem-cli
aem up --html-folder drafts
# open http://localhost:3000/drafts/index
```

`npm run lint` runs ESLint and Stylelint.

---

## Stand it up on aem.live (about 1 hour)

1. **GitHub repo**: push this repo to a GitHub org (e.g. `signify-poc/signify-eds-poc`). The aem.live org name must match the GitHub owner.
2. **AEM Code Sync app**: install https://github.com/apps/aem-code-sync on the repo.
3. **Content source**: create a SharePoint (or Google Drive) folder and upload everything from `authoring/`. Rename `index.docx` → `index`, keep `nav`, `footer`, `press-releases`.
   - SharePoint needs the AEM Content Integration app consented by a Signify M365 admin (see https://www.aem.live/docs/setup-customer-sharepoint). **Start this early; it is the usual blocker.**
   - Google Drive: share the folder with `helix@adobe.com`.
4. **Site config**: `fstab.yaml` is retired. Point the site at the folder through the Configuration Service, most easily with https://labs.aem.live/tools/site-admin/.
5. **Sidekick**: install the AEM Sidekick Chrome extension, open each document and click **Preview**, then **Publish**. Preview the spreadsheet too.
6. Open:
   - Preview: `https://main--signify-eds-poc--<owner>.aem.page/`
   - Live: `https://main--signify-eds-poc--<owner>.aem.live/`

In the uploaded homepage, the Press Releases block already points at `/press-releases.json`. Links point at `www.signify.com` paths for realism, so they leave the POC site when clicked.

---

## Authoring guide (for the demo and for business users)

- **Sections**: a line with `---` starts a new section.
- **Blocks**: a table whose first row is the block name, e.g. `Teaser (reverse, dark)`. Words in brackets are variants.
- **Buttons**: a link alone in its paragraph. **Bold** = primary, *italic* = secondary.
- **Section styling**: a `Section Metadata` table at the end of a section with `Style | dark` (also `light`, `center`; comma-separate to combine).
- **Page metadata**: a `Metadata` table at the end of the document (Title, Description, Image, etc.).
- **Navigation**: the `nav` document. Section 1 = logo, section 2 = bulleted menu (indent for dropdowns), section 3 = tools.
- **Data**: `press-releases` is a spreadsheet with columns `title | date | path | category`. Add a row, preview and publish, and the homepage list updates. No page edit, no deployment.

---

## AI features

### 1. "Ask Signify" assistant (`blocks/ai-assistant`)

Authored as a block table on the page:

| AI Assistant | |
| --- | --- |
| Title | Ask Signify |
| Intro | one line under the title |
| Knowledge | `/ai-knowledge.json` (the `ai-knowledge` spreadsheet) |
| Index | `/query-index.json` (optional, suggests matching site pages) |
| Endpoint | empty = **mock mode**; a URL = real model |
| Suggestions | bulleted starter questions |

**How mock mode works:** the block ranks rows of the `ai-knowledge` sheet (`keywords | question | answer | link | title`) against the question and answers with the best match plus source links. Rare words count more than common ones, so "price of a Hue bulb" hits the pricing row, not the brands row. Questions it can't match get an honest "I could not find that" and the contact link. No model or API key is involved, so the demo runs offline and every answer is predictable. The panel says it is in demo mode.

**Business value to show:** the comms team controls what the assistant says by editing a spreadsheet, the same publish flow as any page.

**Switching to a real model later:** put a backend URL in the `Endpoint` row. The block then POSTs:

```json
{ "question": "...", "history": [{ "role": "user|assistant", "content": "..." }],
  "context": [{ "title": "...", "url": "...", "text": "..." }], "locale": "en" }
```

and expects `{ "answer": "...", "sources": [{ "title": "...", "url": "..." }] }`. The `context` is the same retrieval the mock uses (knowledge rows + index pages), so the model answers from Signify's own content. If the endpoint fails or times out (15s), the block falls back to mock mode. The backend (Azure Function or App Builder action) holds the model key, builds the prompt, and must add rate limiting, CORS for the site origin, and prompt-injection guards. The browser never sees a key.

**Site search index:** for the `Index` row to suggest pages, create a `query-index` spreadsheet in the content root with columns `path | title | description | lastModified` and preview it once with Sidekick. EDS then fills it as pages are published. On this POC it only holds the homepage, so the knowledge sheet does most of the work.

### 2. AI-ready content (LLM visibility)

- **Server-rendered HTML:** EDS already serves the authored content as HTML, which LLM crawlers (most don't run JavaScript) can read. This is a genuine advantage over today's Vue SSR/clientlib-heavy pages and worth stating in the demo.
- **`llms.txt`** at the site root (`/llms.txt`, served from the repo) lists the authoritative pages for AI assistants. It is an emerging convention, not a standard; keep it short and current.
- **JSON-LD:** the homepage `Metadata` table has a `json-ld` row with an `Organization` schema. EDS renders this server-side as `<script type="application/ld+json">` for document authoring. In Word, **paste** the JSON rather than typing it, because autocorrect turns straight quotes into curly ones and breaks the JSON. Validate with Google's Rich Results Test after publishing.
- **Next step (licensed):** Adobe LLM Optimizer measures how often AI assistants cite the brand and suggests fixes, and supports EDS.

## Demo storyline (15 minutes)

1. **The page** (2 min): open the live URL next to today's signify.com. Same structure, same content.
2. **Performance** (3 min): run PageSpeed Insights on both URLs live in the meeting. Note: compare mobile scores; that's where EDS stands out.
3. **Authoring** (5 min): open `index` in Word, change the carousel headline, add a teaser by copying a table, change `Teaser` to `Teaser (dark)`. Sidekick → Preview → Publish. Refresh the live site.
4. **Data-driven content** (2 min): add a row to `press-releases`, publish, and show the homepage news list update.
5. **AI assistant** (3 min): ask a suggested question, then "what is the price of a Hue bulb?" (guarded answer) and "who won the football match?" (honest fallback). Edit an answer in `ai-knowledge`, publish, ask again. Explain that one config row switches it to a real model.
6. **AI visibility** (1 min): open `/llms.txt` and view-source to show the JSON-LD in the HTML.
7. **Developer flow** (3 min): open a PR changing a block's CSS. Show the automatic branch URL `https://<branch>--signify-eds-poc--<owner>.aem.page/`, the lint check in GitHub Actions, and a PageSpeed run on the branch URL.

---

## Risks and open items

- **SharePoint consent**: the M365 admin consent for the AEM Content Integration app is the critical-path item. Google Drive works as a fallback for the POC only.
- **Licensing**: confirm whether Signify's Adobe contract includes EDS entitlement before anything beyond a POC. aem.live POC sites are fine for a demo, but production needs the right SKU.
- **Section Metadata**: the latest boilerplate's `aem.js` no longer applies Section Metadata on the client. This repo adds it back in `scripts.js` so local drafts and doc content behave the same. Verify on `.aem.page` whether the pipeline now renders it server-side; if it does, the client code is a harmless no-op.
- **Brand assets**: colours are approximations, fonts are the boilerplate Roboto, and all images and logos are placeholders. Swap in the official brand kit before showing this outside the platform team.
- **Not covered by this POC**: product catalogue / CIF commerce, search, forms, personalisation, multi-language and multi-brand (MSM-style) setup, Akamai in front of aem.live, analytics/consent. Each needs its own spike, and they are the questions business will ask next.
- **Authoring model choice**: document authoring suits marketing pages. Teams that need AEM's structured authoring, workflows and DAM should also see the Universal Editor (xwalk) variant before deciding.
- **AI assistant is a mock:** answers are keyword-matched from the knowledge sheet, not generated. Say so in the demo so the business doesn't size a real rollout from it. Live mode needs a backend, a model approved by Signify security/legal, an AI-use disclaimer, logging/abuse monitoring, and multi-language handling.
- **Client-rendered blocks are invisible to LLM crawlers:** the press-releases list and the assistant are built in JavaScript. Content that must be cited by AI assistants has to be authored on the page, not fetched.
- **AI crawler policy is a business decision:** whether to allow GPTBot, ClaudeBot, PerplexityBot etc. in `robots.txt` (managed in the EDS site config) needs legal/marketing sign-off before go-live.
- **Sample data**: press-release dates, the stats figures and the knowledge-sheet answers are illustrative, taken from current signify.com pages. Confirm before any external use.
