# Blue Document Processor — 100% Spec Conformance Plan

**Goal.** Bring our `libs/document-processor` to full conformance with the Blue Contracts & Processor Model (Part II), including initialization, cascades, embedded processing, checkpoints, termination, ordering, JSON Patch subset, per-scope FIFO, lifecycle, and gas accounting.

**How to use this doc.**  
We’ll complete the phases in order. After each phase:

- check off the tasks,
- write a brief “What changed / Notes”,
- run the spec tests listed in the DoD,
- then start the next phase.

> Legend: **DoD** = Definition of Done; **Spec refs** = sections in the spec this phase satisfies.

---

## Phase 1 — Preflight Checks: Must-Understand & Reserved Keys

**Intent.** Fail early if we encounter unknown contracts or malformed reserved keys; enforce read-only event payloads.

**Tasks**

- [x] On run start, scan every `contracts` map: if a contract type BlueId has no registered processor → return **capability failure** (no mutation) (§22.1).
- [x] Validate reserved keys under `contracts`: `embedded`, `initialized`, `terminated`, `checkpoint` must be compatible with their expected types; any conflict → **runtime fatal** (§15, §22.2).
- [x] Freeze/clone delivered **event payload** before giving it to processors (read-only guarantee). (§15)

**Files**

- `src/BlueDocumentProcessor.ts` (preflight)
- `src/registry/ContractRegistry.ts` (lookup helpers)
- `src/routing/EventRouter.ts` (freeze payload before dispatch)

**DoD**

- [x] Unknown contract type aborts with **must-understand failure**; no patches applied. (§22.1)
- [x] Reserved key type conflicts cause **fatal termination** at that scope. (§15, §22.2)

---

## Phase 2 — JSON Patch Subset & Boundary Enforcement

**Intent.** Enforce the spec’s deterministic JSON Patch subset and embedded boundary rules.

**Tasks**

- [ ] Create `PatchValidator`:
  - allow ops: `add | replace | remove`; **reject** `move|copy|test`. (§21.2)
  - require **absolute** pointers; forbid target `"/"` (root). (§21.2)
  - auto-materialize missing **objects** on the path; **array** index rules (insert, append with `-`, bounds). (§21.2)
- [ ] Replace `utils/document.isInside` with **strictly-inside** semantics:
  - `isStrictlyInside(target, root) = target.startsWith(root + "/")`.
  - Forbid **self-root** mutation (`patch.path === scopeRoot`) and **root** target (“/”). (§16.2, §21.2)
- [ ] Add **reserved-key** write-protection guard: any patch targeting `/…/contracts/(embedded|initialized|terminated|checkpoint)` (or descendants) → **fatal**. (§15)

**Files**

- `src/utils/document.ts` (new `isStrictlyInside`)
- `src/BlueDocumentProcessor.ts` or new `engine/PatchValidator.ts`
- `src/utils/exceptions.ts` (new error kinds if needed)

**DoD**

- [ ] All invalid ops and pointer violations are caught before mutation. (§21.2)
- [ ] Parent can patch **child root**, but not **inside** it; child cannot target its own scope root. (§16.2)

---

## Phase 3 — Centralized Patch Application + Document Update Cascade

**Intent.** One successful patch → a **bottom-up** cascade (origin → ancestors → root) with **uniform, scope-relative** payload and **no drains during cascades**.

**Tasks**

- [ ] Introduce `applyPatchWithCascade(doc, originScope, patch)` that:
  - validates with Phase 2 guards,
  - captures `before/after` snapshot at the **absolute** path,
  - applies the patch (auto-materialization),
  - for each scope in the chain: build a single **immutable** “Document Update” payload with **scope-relative** `path` and uniform `before/after`, and synchronously run matching **handlers** (no FIFO drains). (§21.1)
  - enqueue any **Triggered** emissions to that scope’s FIFO (do not deliver yet). (§17, §19)
- [ ] Remove “document update” self-emission from `UpdateDocumentExecutor` — it must only request patches; the processor emits **Document Update**. (replace current ad-hoc behavior)
- [ ] Route all `ctx.addPatch()` calls through `applyPatchWithCascade`.

**Files**

- `src/processors/SequentialWorkflowProcessor/steps/UpdateDocumentExecutor.ts` (stop emitting)
- `src/BlueDocumentProcessor.ts` (add and use `applyPatchWithCascade`)
- (Optionally) `src/engine/Cascade.ts`

**DoD**

- [ ] For a patch at `/a/b/x`, handlers at `/a/b` see `path="/x"`, at `/a` see `"/b/x"`, at root see `"/a/b/x"`. Uniform payload per scope. (§21.1, §21.3)
- [ ] Emissions during cascades are **enqueued**, not delivered. (§19, §21.1)

---

## Phase 4 — Processor-Fed Channels: Document Update / Lifecycle / Triggered

**Intent.** Implement the processor-managed channel families and their timing.

**Tasks**

- [ ] Implement internal resolvers for:
  - **Document Update Channel** — match by subtree against `ABS(scope, path)`; payload supplied by Phase 3. (§17)
  - **Lifecycle Event Channel** — delivery helper `deliverLifecycle(scope, node)`; record for bridging; no FIFO drain here. (§17, §20, §22)
  - **Triggered Event Channel** — a real channel bound to the **per-scope FIFO** (drained in Phase 7). (§17, §19)
- [ ] Ensure processor-fed families are **never checkpoint-gated**. (§23)

**Files**

- `src/processors/LifecycleEventChannelProcessor.ts` (reuse with new delivery helper)
- `src/processors/TriggeredEventChannelProcessor.ts` (bind to FIFO)
- `src/processors/DocumentUpdateChannelProcessor.ts` (subtree match + relative path)

**DoD**

- [ ] Multiple Document Update channels at a scope see the **same** payload object. (§21.1 “uniform content”)
- [ ] Lifecycle delivery uses the helper and is bridgeable (Phase 6). (§17)

---

## Phase 5 — Embedded Processing: Dynamic Traversal & Boundary

**Intent.** Implement the 5-phase behavior for **embedded** scopes (child first, dynamic re-reads, no resurrection) and boundary enforcement is already done in Phase 2.

**Tasks**

- [ ] Add `_PROCESS(doc, event, scope)` with **Phase 1–5** orchestration (see spec pseudocode):
  1. **Phase 1:** iterate `contracts/embedded.paths` dynamically; after each child finishes, **re-read** the list; process each existing child **at most once** per run (no resurrection).
  2. Skip traversal for non-existent child paths.
- [ ] Keep a `RUN.emitted_by_scope` map for bridgeable items (Triggered + lifecycle).

**Files**

- `src/BlueDocumentProcessor.ts` (introduce `_PROCESS`)
- `src/processors/EmbeddedNodeChannelProcessor.ts` (will be used in Phase 6)

**DoD**

- [ ] Changing embedded paths during a child run affects the **next** child to process; a removed child is not reprocessed within the same run. (T1)
- [ ] Boundary rule continues to hold due to Phase 2 guards. (§16)

---

## Phase 6 — Bridging Child Emissions (Embedded Node Channel)

**Intent.** After a child finishes, parent may **bridge** child emissions via _Embedded Node Channel_, **then** parent drains its FIFO later.

**Tasks**

- [ ] Implement Phase 4 of `_PROCESS`: for each processed child, if parent has _Embedded Node Channel_ for that path, deliver child’s **bridgeable** nodes to parent handlers (in `(order, key)`), enqueuing any Triggered results (no immediate drain).
- [ ] Ensure lifecycle nodes from children are also bridgeable.

**Files**

- `src/processors/CompositeTimelineChannelProcessor.ts` (no change)
- `src/processors/EmbeddedNodeChannelProcessor.ts` (ensure it just adapts; bridging happens in engine Phase 4)
- `src/BlueDocumentProcessor.ts` (Phase 4 of `_PROCESS`)

**DoD**

- [ ] Parent observes child emissions via Embedded Node after child finishes; emissions patch/emit per normal rules; parent’s FIFO still not drained. (T7, T28)

---

## Phase 7 — Per-Scope Triggered FIFO & Drain Timing

**Intent.** One **drain per scope**, at the **end** (Phase 5); never drains during cascades.

**Tasks**

- [ ] Maintain `RUN.fifo_by_scope[scope]` (queue).
- [ ] Implement `drainTriggered(scope)` to deliver to _Triggered Event Channel_ handlers in `(order, key)`, applying patches via Phase 3 and enqueuing further Triggered emissions deterministically to the tail.
- [ ] Call this **once** per scope at Phase 5 of `_PROCESS`.

**Files**

- `src/BlueDocumentProcessor.ts` (Phase 5; drain implementation)

**DoD**

- [ ] Emitted E1 then E2 are delivered in order; emissions during drain append to the tail. (T6, T16)
- [ ] No FIFO drains during cascades. (§19)

---

## Phase 8 — Initialization Semantics & Lifecycle

**Intent.** First run at a scope must publish **Document Processing Initiated** (with pre-init id) and **patch** the initialized marker (causing a cascade).

**Tasks**

- [ ] At Phase 2 of `_PROCESS`, if scope lacks `contracts/initialized`:
  - compute **pre-init BlueId** at scope,
  - `deliverLifecycle(scope, makeInitiated(documentId))`,
  - **apply patch** (not Direct Write) at `/contracts/initialized` with \*Processing Initialized Marker { documentId }` → triggers cascade. (§20)
- [ ] Ensure **no checkpoint** is created at init time. (§20)

**Files**

- `src/utils/initialized.ts` (stop auto-insertion; now driven by engine)
- `src/utils/eventFactories.ts` (ensure Initiated event includes `documentId`)

**DoD**

- [ ] First run publishes Initiated with `documentId`, then writes the initialized marker via patch; cascade occurs. (T3, T15)

---

## Phase 9 — Channel Event Checkpoint (External Channels Only)

**Intent.** Lazy creation, gating policy, and **Direct Write** of the entire event node after success.

**Tasks**

- [ ] Remove eager `ensureCheckpointContracts` from normal flow.
- [ ] During Phase 3 channel matching:
  - if matched **external** channel and checkpoint **absent** → **Direct Write** empty checkpoint (no Document Update).
  - evaluate **newness** vs `lastEvents[channelKey]`; skip stale.
  - after successful processing → **Direct Write** `lastEvents[channelKey] = <entire event node>`.
- [ ] Ensure processor-fed families (Document Update / Triggered / Lifecycle / Embedded Node) are **never gated**.

**Files**

- `src/processors/ChannelEventCheckpointProcessor.ts` (simplify or remove; gating moves to engine)
- `src/utils/CheckpointCache.ts` (replace with Direct Write path or repurpose)
- `src/BlueDocumentProcessor.ts` (Phase 3 gating)

**DoD**

- [ ] Lazy creation occurs on first external evaluation; stale events are skipped; on success the **entire** event node is stored; no Document Updates from checkpoint writes. (T18–T22)

---

## Phase 10 — Termination Semantics (Graceful & Fatal)

**Intent.** Implement deterministic runtime fatal & graceful termination with **Direct Writes**, lifecycle, and scope deactivation.

**Tasks**

- [ ] Add helpers:
  - `enterGracefulTermination(scope, reason?)`
  - `enterFatalTermination(scope, reason)`
  - Both **Direct Write** `/contracts/terminated` marker; deliver _Document Processing Terminated_ lifecycle; deactivate the scope and **drop** its FIFO. (§22.2)
  - Root fatal additionally appends _Document Processing Fatal Error_ to the **root outbox** and aborts the run. (§22.2)
- [ ] Hook these paths from: reserved-key tamper, boundary violation, patch pointer errors (fatal), explicit `terminate()` in handlers.

**Files**

- `src/BlueDocumentProcessor.ts` (helpers + wiring)
- `src/utils/eventFactories.ts` (terminated / fatal outbox builders, if needed)

**DoD**

- [ ] Fatal in non-root deactivates only that scope; parent may still bridge emissions (including _Terminated_). (T27)
- [ ] Root fatal ends the run and outboxes fatal; root graceful ends run with terminated lifecycle. (T29–T30)

---

## Phase 11 — Deterministic Ordering (Per-Scope) & Registry

**Intent.** Enforce `(order, key)` sort for channels and for handlers within a channel at each scope.

**Tasks**

- [ ] Replace global `TaskQueue`-driven ordering with per-scope deterministic sort:
  - `channels = sortBy(order, key)`,
  - for each, `handlers = sortBy(order, key)`. (§15)
- [ ] Limit adapters: adapters must **not** patch; enforce and assert.

**Files**

- `src/routing/EventRouter.ts` (simplify into per-scope selection; or move into `_PROCESS`)
- `src/registry/ContractRegistry.ts` (helper to read `order`)
- Remove/retire `TaskQueue` once engine is authoritative.

**DoD**

- [ ] Observed order matches `(order, key)` in all scopes for both channels and handlers. (§15)

---

## Phase 12 — Gas Accounting

**Intent.** Record deterministic gas at the exact points in §24.2 and return `total_gas`.

**Tasks**

- [ ] Add `RUN.total_gas` accumulator; charge:
  - scope entry/init, channel matches, handler overhead,
  - patch + cascade (boundary check, op cost, per-scope cascade cost),
  - emits, bridging, drain dequeues,
  - Direct Writes (checkpoint update, termination marker),
  - lifecycle deliveries,
  - fatal overhead. (§24.2)
- [ ] Size measurement: canonical JSON after Part I §8.2 cleaning (UTF-8 length).
- [ ] Expose in `processSpec` result.

**Files**

- `src/BlueDocumentProcessor.ts` (charges at every call site)
- `src/utils/document.ts` (canonical JSON helper if needed)

**DoD**

- [ ] Test vectors produce the expected relative gas behavior; `total_gas` is stable and deterministic for the same inputs. (§24)

---

## Phase 13 — Conformance Suite: Map to T1–T30

**Intent.** Add explicit tests for every normative behavior in §27.

**Tasks**

- [ ] Implement tests for **T1–T30**; each test exercises one behavior (embed dynamics, cascades, FIFO, checkpoints, termination, etc.).
- [ ] Wire tests to `BLUE_SPEC_MODE=true`.

**DoD**

- [ ] All **T1–T30** pass. (§27)

---

## Phase 14 — Cleanups & Migrations

**Intent.** Remove legacy code paths and update dependent processors to use the new engine semantics.

**Tasks**

- [ ] Delete `ensureCheckpointContracts` eager creation; delete or repurpose `CheckpointCache`.
- [ ] Ensure `UpdateDocumentExecutor` **never** constructs Document Update events.
- [ ] Confirm adapters never call `addPatch`; enforce with runtime check.
- [ ] Update public API docs to the new result shape `(new_doc, triggered_events, total_gas)`.

**DoD**

- [ ] No legacy path remains that can emit Document Update from a handler.
- [ ] Eager checkpoint creation is gone.

---

## Appendix — Per-Phase Notes & Risks

- **Engine refactor (Phases 3–7) is the backbone.** Do these in order.
- **Checkpoint policy** must never gate processor-fed families; enforce that in the engine (Phase 9). (§23)
- **Adapters vs handlers.** Adapters only adapt/emit; they must not patch (assert in debug builds).

---

## Running Notes (Fill after each phase)

> **Phase 1 – Preflight Checks**
>
> - Added document-wide preflight scan that returns a capability failure on unknown contract types and enforces reserved key schemas in `BlueDocumentProcessor`.
> - Introduced frozen event payload delivery (router + context) with a new regression spec in `src/__tests__/preflight.test.ts`.
> - Validation runs: `npx tsc -p tsconfig.json --noEmit`, `npx vitest run --config libs/document-processor/vite.config.ts libs/document-processor/src/__tests__/preflight.test.ts`, `npx eslint libs/document-processor/src --ignore-pattern "libs/document-processor/src/__tests__/resources/**"`.

---

### Quick Cross-walk (What each phase unlocks in the spec)

- Phases 2–3: §21 (patch subset & cascades)
- Phases 4,7: §17, §19 (processor-fed channels, FIFO & timing)
- Phase 5–6: §16–§17 (embedded traversal & bridging)
- Phase 8: §20 (initialization)
- Phase 9: §23 (checkpoints)
- Phase 10: §22 (termination)
- Phase 11: §15 (ordering)
- Phase 12: §24 (gas) — all normative charge points.

---

### Pointers to our current code (for Codex)

- Central entry: `src/BlueDocumentProcessor.ts` (add `_PROCESS`, `deliverLifecycle`, `applyPatchWithCascade`, `drainTriggered`, termination helpers).
- Routing: move away from global `TaskQueue` to per-scope selection in `_PROCESS` (`src/routing/EventRouter.ts` can be slimmed or retired).
- Processors to keep “dumb”:
  - `SequentialWorkflowProcessor/*` (Steps emit patches/events only — no document-update events),
  - `*ChannelProcessor`s (adapters must not patch; just adapt + `ctx.emitEvent`),
  - `ChannelEventCheckpointProcessor` → fold logic into engine (Phase 9).
- Utilities:
  - `utils/document.ts` (strictly-inside, canonical JSON helper),
  - `utils/initialized.ts` (stop eager insert; engine owns init),
  - `utils/eventFactories.ts` (Initiated must include `documentId`).

---
