# Policy Lens

**Read the policy before you pay.**

Policy Lens is a document-reading assistant for insurance policies. Upload the wording, its schedules and endorsements, the marketing flyer and the messages a broker sent you, and it produces a plain-language reading in which **every statement is backed by a verbatim quote from a named page — or is explicitly marked as unknown.**

This is not a chatbot wrapped around a PDF. The language model is the cheap part; the product is the constraint layer around it. Quotes are validated server-side as exact substrings of the extracted page text, threshold comparisons are computed in code, a second independent model call re-reads every conclusion, and anything that cannot be verified is dropped and counted instead of being published.

## The problem

A travel or health policy is 20–60 pages of defined terms, exclusions, schedules and endorsements. Almost nobody reads it, so the reading gets outsourced to three unreliable sources: a broker's WhatsApp message, a marketing flyer, and a vague memory of what "comprehensive" means.

The failure mode is not only that people cannot find the exclusions. It is that they do not know what was never answered at all: a missing schedule page and a genuinely absent exclusion look identical to a reader. General-purpose chat assistants make this worse — they paraphrase confidently, invent benefit amounts, and cannot show where a sentence came from.

## What it does

1. **Upload with roles** — contract wording, schedule / table of benefits, endorsement, or marketing material, up to 8 materials per review. Broker conversations can be pasted as text, keeping the source, timestamp and original words. PDFs up to 10 MB / 120 pages are parsed locally.
2. **Read with evidence** — the agent searches and reads page blocks with tools, then writes conclusions. Each conclusion carries an evidence status (`document_supported`, `interpretation`, `unknown`) and clickable citations that jump to the page in the original PDF.
3. **One-page summary** — six cells (what is covered, what is not, the maximum benefit, when it pays, what documents are needed, what the wording leaves unclear), each expandable to its source quotes, plus the single number most easily misread between the benefit table and the detailed wording.
4. **Ask for what is missing** — when a schedule or endorsement is referenced but absent, the run stops with a list of missing material instead of guessing.
5. **Follow up with new material** — adding a document starts a successor run that re-examines only what the new material can affect, and reports every earlier conclusion as unchanged, strengthened, weakened, reversed or withdrawn.
6. **Test scenarios** — "my flight is delayed 8 hours" is compared against the literal threshold in the wording by server-side arithmetic, not model guesswork; anything the wording does not settle is returned as insufficient information.
7. **Marketing vs contract** — each claim in a flyer or plan summary is matched against the wording and classified as supported with conditions, apparently conflicting, or not enough basis.
8. **Broker promise check** — what the agent or broker said is compared line by line with the contract: supported, overstated, not in the contract, contradicted.
9. **Question list** — open questions, missing documents and unverified points are exported as a message to send to the broker, with clause references and the broker's own words.

The interface is available in Traditional Chinese (Hong Kong) and English. Report text follows the browser language; quoted policy text is never translated.

## Architecture

- **Backend** — Node.js 24, TypeScript, Express 5, built-in `node:sqlite` (no ORM), anonymous cookie sessions that isolate every review.
- **Ingestion** — `pdfjs-dist` in a worker thread with layout-aware extraction: header/footer removal, two-column reading order, table rows reassembled on a shared baseline, paragraphs from spacing and indentation, hyphen rejoining. No OCR: scanned pages are marked `needs_ocr` rather than guessed.
- **Agent** — AI SDK v7 (`@ai-sdk/deepseek`) `ToolLoopAgent` with `listDocuments`, `searchSources`, `readSource`, `evaluateScenario` and `testBoundary`, bounded by step and time budgets and a classified stop reason.
- **Validation** — Zod schemas, verbatim citation binding, server-side recomputation and an independent semantic second pass (see below).
- **Delivery** — server-sent events for live run progress, with replay, heartbeat, reconnect and polling fallback. A report is bound to the material revision it was built from.
- **Frontend** — dependency-free HTML/CSS/JS, no framework and no build step required at runtime.

## Trust design

- **No citation, no conclusion.** A conclusion without a resolvable source is dropped before publication.
- **Verbatim enforcement.** Every quote is checked server-side as an exact substring of the extracted page text (after whitespace normalisation). A paraphrased "quote" fails validation.
- **Server-side arithmetic.** Threshold and benefit comparisons are computed in code from parsed numbers; the model may only copy the result.
- **Independent second pass.** A separate model call re-reads each cited conclusion against its quotes and flags unsupported or misquoted items.
- **Explicit degradation.** Unverifiable items are dropped and counted ("N comparisons hidden because their wording could not be verified"); a failed review marks the report `unavailable` instead of blocking it.
- **Version-bound reports.** A late-finishing run cannot overwrite a newer report, and citations to deleted material become visibly `missing`.
- **Honest limits in the text.** Every report states that it only compares the uploaded material, that "not found" does not mean "does not exist", and that it is not advice.

## Quick start

Requires **Node.js >= 24.14** (the backend uses the built-in `node:sqlite` module).

```sh
npm ci
cp .env.example .env      # then set DEEPSEEK_API_KEY (never commit .env)
npm run start:v3          # single-port app: frontend + API
```

The single-port app listens on `PORT` if set, otherwise `POLICY_LENS_PORT`, otherwise **4185**. The stock `.env.example` sets `PORT=3001` for the two-process mode below, so remove or change that line if you want the default port; the app then opens at <http://localhost:4185>. Data is stored in `.data/policy-lens-v3.sqlite`; `POLICY_LENS_HOST` and `POLICY_LENS_DATABASE_PATH` change the bind address and database location.

Without an API key, upload and page-by-page reading still work, but starting a run returns `503 AGENT_NOT_CONNECTED`.

To try the flow without a real policy, generate a fictional PDF and upload it:

```sh
npm run sample:pdf        # writes .data/demo-contract.pdf
```

### Two-process development mode

The original materials workbench runs the frontend and API separately, with the dev server proxying `/api` to the backend:

```sh
npm run dev:api           # API on http://localhost:3001
npm run dev               # dev server on http://localhost:4173
```

Open <http://localhost:4173/materials.html>. Set `API_PORT` before starting the dev server if the API runs elsewhere.

### Deploy

`Dockerfile` builds a single-port container (`npm run start:v3`, default 4185); `render.yaml` is a Render blueprint with a health check on `/api/health`. Set `DEEPSEEK_API_KEY` in the platform dashboard — it is never read from Git.

## Verify

```sh
npm run check       # syntax check for every frontend script
npm run check:api   # TypeScript type check for the server
npm run test:api    # 41 backend tests (mock model, no API spend)
npm run build       # static build of the design pages into dist/
```

All 41 backend tests pass on this branch. They cover citation validation, version ordering, resumption, scenario arithmetic, broker-claim validation, prompt-check validation and event streaming.

The pipeline has also been exercised end-to-end against a real public policy — QBE Hong Kong's annual travel wording, nine pages — where a ski-injury question produced seven conclusions with thirteen verified citations, correctly identifying that extreme sports are excluded except where skiing is carved back in, and that the benefit table itself was missing. Details: [docs/REAL-CONTRACT-TEST.md](docs/REAL-CONTRACT-TEST.md).

## Repository layout

| Path | Contents |
| --- | --- |
| `server/` | Express app, SQLite store, agent, report validation, overview, export, scenario and boundary logic |
| `server/ingest/` | Layout-aware PDF extraction in a worker thread |
| `server/tests/` | 41 backend tests with a local mock model |
| `v3/` | Seven-step single-port app (`index.html`, `js/`, `css/`, `server.mjs`) |
| `materials.html`, `report.js`, `report.css` | Materials workbench: upload, page reader and the investigation panel |
| `experience.html`, `showcase.html` | Design delivery: connected mock experience and component notebook (fictional data, no model calls) |
| `scripts/` | Dev server, static build, sample PDF generator |
| `docs/` | Plan, design notes and test reports — start with [docs/PLAN.md](docs/PLAN.md) |
| `render.yaml`, `Dockerfile` | One-port deployment |

`dist/` (built design pages), `.data/` (SQLite databases and uploaded bytes) and `.env` are git-ignored.

## Main API surface

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/reviews` | Create a review with an anonymous session cookie |
| `GET` | `/api/reviews/:id` | Restore materials, revision, runs and `currentReport` |
| `POST` | `/api/reviews/:id/documents` | Upload a PDF with a role; parsing is queued |
| `GET` | `/api/reviews/:id/documents/:docId/pages/:pageIndex` | Page text plus citable source IDs |
| `POST` | `/api/reviews/:id/runs` | Start an investigation or scenario run (optional `resumeFromRunId`) |
| `GET` | `/api/reviews/:id/runs/:runId/events` | SSE progress stream with replay and reconnect |
| `GET` | `/api/reviews/:id/questions/export?format=md` | Export the question list as Markdown |
| `POST` | `/api/reviews/:id/runs/:runId/cancel` | Cancel a running investigation |

The v3 shell adds `POST /api/reviews/:id/intake`, `/v3-stream`, `/v3-claims` and `/v3-whatif`. Full request and response contracts are in [docs/PLAN.md](docs/PLAN.md) §6–7 and [v3/docs/API.md](v3/docs/API.md).

## Boundaries

- Policy Lens compares only the material you upload. "Not found" does not mean a clause does not exist.
- It does not give advice, judge whether a term is lawful, decide whether a claim will be paid, or verify who wrote a pasted message.
- No OCR: scanned documents are marked `needs_ocr` instead of being guessed at.
- Single local instance; not hardened for public multi-user deployment (HTTPS, secure cookies, rate and capacity limits are listed in `docs/PLAN.md` §11).
- The bundled sample policies are fictional, and the design pages (`experience.html`, `showcase.html`) call no model.
- English localisation is partial: report text follows the page language, but some static section labels are still Traditional Chinese.

## Documentation

| Document | What it covers |
| --- | --- |
| [docs/PLAN.md](docs/PLAN.md) | Single source of truth: capabilities, progress, architecture, API, limits |
| [docs/PROJECT-DESCRIPTION.md](docs/PROJECT-DESCRIPTION.md) | Product narrative and trust design |
| [docs/REAL-CONTRACT-TEST.md](docs/REAL-CONTRACT-TEST.md) | End-to-end run against a real public policy |
| [docs/AGENT_V2_PLAN.md](docs/AGENT_V2_PLAN.md) | Agent design appendix and acceptance criteria |
| [v3/README.md](v3/README.md) | The seven-step app, screen by screen |
| [design/](design/) | Frontend module contracts, motion and visual acceptance notes |
