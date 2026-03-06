# Document processor parity gaps (pinned target)

Pinned JS target:

- Repository: `bluecontract/blue-js`
- Commit: `bf9e1cfd200d35801d8237f7080895372c1572c6`
- Package: `libs/document-processor`

This document tracks the high-risk parity gaps and their current resolution status.

---

## 1) Runtime JSON patch pointer semantics

- **Status**: ✅ Resolved

- **JS references**
  - `src/__tests__/DocumentProcessingRuntimeJsonPatchTest.test.ts`
  - `src/runtime/patch-engine.ts`
- **Implemented Java behavior**
  - Patch runtime now uses JS-style patch-path traversal semantics (literal `~` segments, raw token splitting, JS-style array segment handling).
  - Pointer utility strictness remains available for non-patch utility APIs.
- **Target behavior**
  - Match JS runtime patch engine semantics for patch-path token handling and traversal.
  - Keep pointer utility strictness for non-patch APIs unless explicitly required otherwise.
- **Resolution**
  - Align `PatchEngine` patch-path traversal and tests to JS behavior.
  - Keep contract explicit in tests.

---

## 2) Sequential workflow operation request matching

- **Status**: ✅ Resolved

- **JS references**
  - `src/registry/__tests__/sequential-workflow-operation-processor.test.ts`
  - `src/registry/processors/sequential-workflow-operation-processor.ts`
  - `src/registry/processors/workflow/operation-matcher.ts`
- **Implemented Java behavior**
  - Default matcher now requires timeline-envelope operation request typing (JS-strict behavior).
  - Direct-shape matching is disabled by default.
- **Target behavior**
  - JS-strict request gating by default (timeline/envelope/type rules).
- **Resolution**
  - Default Java matcher to strict JS-compatible gate.
  - Provide explicit compatibility mode to allow direct-shape matching for legacy callers.
  - Cover both strict and compat behavior in tests.

---

## 3) Result helper API

- **Status**: ✅ Resolved

- **JS references**
  - `src/types/result.ts`
  - `src/types/__tests__/result.test.ts`
- **Implemented Java behavior**
  - Added generic functional `Result<T,E>` helper API in Java with JS-equivalent operations:
    - `ok`, `err`, `isOk`, `isErr`, `map`, `mapErr`, `andThen`, `unwrapOr`, `unwrapOrElse`, `match`.
- **Target behavior**
  - Provide full functional helpers equivalent to JS result helpers:
    - `ok`, `err`, `isOk`, `isErr`, `map`, `mapErr`, `andThen`, `unwrapOr`, `unwrapOrElse`, `match`.
- **Resolution**
  - Add generic Java Result helper type under processor types.
  - Add dedicated parity tests mirroring JS helper semantics.

---

## 4) Node canonicalizer parity suite

- **Status**: ✅ Resolved

- **JS references**
  - `src/util/node-canonicalizer.ts`
  - `src/util/__tests__/node-canonicalizer.test.ts`
- **Implemented Java behavior**
  - Added dedicated canonicalizer parity test suite.
  - Canonical signature and size now share the same utility implementation.
  - `ProcessorEngine` canonical signature flow delegates to `NodeCanonicalizer`.
- **Target behavior**
  - Dedicated Java canonicalizer parity tests for signature/size semantics.
  - Single canonicalizer utility for signature and size.
- **Resolution**
  - Add canonical signature helper to `NodeCanonicalizer`.
  - Delegate engine canonical signature generation to utility.
  - Add dedicated parity test class.

---

## 5) QuickJS runtime architecture

- **Status**: ✅ Resolved

- **JS references**
  - `src/util/expression/quickjs-evaluator.ts`
  - `src/util/expression/quickjs-expression-utils.ts`
  - `src/registry/processors/steps/javascript-code-step-executor.ts`
  - JS QuickJS tests under `src/util/expression/__tests__/*` and step executor tests.
- **Implemented Java behavior**
  - Sidecar now executes scripts with `@blue-quickjs/quickjs-runtime`.
  - Runtime fuel reporting is sourced from quickjs runtime (`gasUsed` / `gasRemaining`) and passed through protocol.
  - Sidecar protocol preserves `undefined` vs `null` result semantics and emit-envelope behavior.
  - Java evaluator/runtime integration is aligned with new protocol and covered by parity suites.
- **Target behavior**
  - Sidecar executes with `@blue-quickjs/quickjs-runtime` (same runtime family as JS).
  - Align error classification, fuel accounting, and result protocol shape with JS expectations.
- **Resolution**
  - Replace sidecar execution backend with quickjs-runtime.
  - Update Java runtime/evaluator integration and parity tests accordingly.
  - Update architecture documentation with final design decisions and constraints.
