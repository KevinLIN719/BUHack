# Policy Lens — Read the Policy Before You Pay

Policy Lens is a document-reading assistant for insurance policies. You upload a policy wording PDF, and it produces a plain-language reading in which **every statement is traceable to a verbatim quote, on a specific page, of a specific document** — or it is explicitly marked as unknown.

## The problem

A travel or health policy is 20–60 pages of defined terms, exclusions, schedules and endorsements. In practice almost nobody reads it, and the reading is outsourced to three unreliable sources: a broker's WhatsApp message, a marketing flyer, and a vague memory of what "comprehensive" means. The failure mode is not that people cannot find the exclusions — it is that they do not know what was never answered at all. A missing schedule page and a genuinely absent exclusion look identical to a reader.

Existing chat assistants make this worse: they paraphrase confidently, invent benefit amounts, and cannot show where a sentence came from.

## What the product does

1. **Upload** — one or more PDFs, each tagged by role: contract wording, schedule / table of benefits, endorsement, marketing material. Broker conversations can be pasted as text instead of a PDF, with source, timestamp and the original words preserved.
2. **Read with evidence** — the agent searches and reads page blocks with tools, then writes conclusions. Each conclusion carries its evidence status (`document_supported`, `interpretation`, `unknown`) and clickable citations that jump to the page image.
3. **One-page summary** — the three findings that most change a decision, then the full detail, the benefit limits, what is still unknown, and what material is missing.
4. **Follow-up with new material** — when a schedule or endorsement is added, a successor run re-examines only what the new material can affect, and reports each previous conclusion as unchanged, strengthened, weakened, reversed or withdrawn.
5. **Scenario testing** — "what if my flight is delayed 8 hours?" is compared against the literal threshold in the wording by server-side arithmetic, not by model guesswork; anything the wording does not settle is returned as insufficient information.
6. **Marketing vs contract** — every claim in a flyer or plan summary is matched against the wording and classified as supported with conditions, an apparent conflict, or not enough basis.
7. **Broker promise check** — what the agent or broker said is compared line by line with the contract: supported, overstated, not in the contract, contradicted.
8. **Question list** — the open questions, missing documents and unverified points are exported as a message to send to the broker, with clause references.

## Trust design (the actual product)

The differentiator is not the language model; it is the constraint layer around it.

- **No citation, no conclusion.** A conclusion without a source is dropped before publication.
- **Verbatim enforcement.** Every quote is validated server-side as an exact substring of the extracted page text. Quoted text that the model paraphrased fails validation.
- **Server-side arithmetic.** Comparisons with thresholds and benefit limits are computed in code from parsed numbers; the model may only copy the result.
- **Independent second pass.** A separate model call re-reads each cited conclusion against its quotes and flags unsupported or misquoted ones.
- **Explicit degradation.** Unverifiable items are dropped and counted ("N comparisons hidden because their wording could not be verified"); review failure marks the report `unavailable` rather than blocking it.
- **Version-bound reports.** A published report is tied to the material revision it was built from; a late-finishing run cannot overwrite a newer version, and citations to deleted material become visibly `missing`.
- **Honest limits in the text.** Every report states that it compares uploaded material only, that "not found" does not mean "does not exist", and that it is not advice.

## Architecture

- **Backend**: Node.js 24, TypeScript, Express 5, built-in `node:sqlite` (no ORM), session-isolated reviews via anonymous cookies.
- **Ingestion**: `pdfjs-dist` with layout-aware extraction — header/footer removal, two-column reading order, table rows reassembled on a shared baseline, paragraph boundaries from spacing and indentation, hyphen rejoining. No OCR: scanned pages are marked `needs_ocr` rather than guessed.
- **Agent**: AI SDK v7 with DeepSeek, tool loop (`listDocuments`, `searchSources`, `readSource`, `evaluateScenario`) under step, tool-call and 120-second budgets, with six classified stop reasons.
- **Delivery**: Server-sent events for live run progress; the frontend falls back to polling if the stream goes silent.
- **Frontend**: dependency-free HTML/CSS/JS. The demo shell (`v3/`) runs the full seven-screen flow against the real backend on a single port; the materials page exposes each capability individually.

## State today

34 automated tests cover citation validation, version ordering, resumption, scenario arithmetic, prompt-check validation and event streaming. The pipeline has been exercised end-to-end against a real public policy — QBE Hong Kong's annual travel wording, nine pages — where a ski-injury question produced seven conclusions with thirteen verified citations, correctly identifying that extreme sports are excluded except where skiing is carved back in, and that the benefit table itself was missing.

Known limits: no OCR for scanned documents, single instance and local-only deployment, partial three-language coverage (report text follows the page language; static labels are still being moved into the dictionary), and the older five-step onboarding screen still runs on mock data.

## Why it matters

Insurance disputes are rarely about hidden clauses. They are about documents nobody finished reading, promises nobody checked, and gaps nobody noticed. Policy Lens does not tell you what is covered — it shows you what the document actually says, where it says it, and what it does not say at all.
