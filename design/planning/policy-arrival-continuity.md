# Policy paper arrival → wording reveal

The user points to the carried thumbnail sitting over an already-sharp new heading. The intended order is acquisition, travel, arrival, then transformation and a blur reveal. This shared change applies to both the mock experience and component notebook.

PolicyPull retains its five phases. Its exported timings are the sole duration source; landing now includes a finite release/reveal interval. An optional per-request onLanding(progress) reports 0–1 progress on the existing RAF, with a reentrancy guard.

Workbench reserves the latest exact wording in its final geometry, marks it aria-busy, and masks its ink during travel. Close and Escape remain usable. The target is never hidden/inert or transformed. At landing, the paper opens slightly, gains blur and retires with its thread/bookmark. The heading, excerpt and priority rows then resolve on the same clock, with no competing Surface entrance. Idle removes all progress attributes and filters.

Latest requests use generation guards, including same-policy replay. Selection, pointer manipulation, reorder, close, resize/scroll, hidden page, preferences, missing RAF and teardown settle the correct readable/closed state. Closing before reveal creates no sharp exit snapshot. Cancellation also commits a stable visible/live status.

Validation: 20 arrival-specific checks, 56 policy interaction checks (the old hardcoded completion wait now derives from exported timing), boundary and resize/scroll checks, 17 component checks, 16 built mock-flow checks, final built-page regression, syntax/build and six-artifact audit all pass. Fresh read-only review found a P2 stale loading announcement after cancel; root fixed it and reproduced pointer/reorder/same-select settlement.

Actual browser checks: 1100px carry has heading/body opacity zero and blur8px; 390px landing has retired clone and separately resolving text layers; 728px end has target movement [0,0], opacity one, filter none, and zero owned frames/clones. No overflow; clone/bookmark stay inside bounds. Inspection clocks are temporary, not in production.

Production changes: policy-pull.js, policy-workbench.js, policy-deck.css. Policy data, paper reordering, other effects, orange entrance and text branding stay as delivered.
