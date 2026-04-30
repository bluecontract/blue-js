### ADR 0002: Public BlueId APIs mean semantic identity

**Status:** Accepted for phase 0 guardrails.

**Context**

The specification requires BlueId stability across equivalent authoring forms,
expansion, minimization, and resolution. The current implementation can hash a
particular materialization rather than the semantic content.

**Decision**

The target meaning of public `Blue.calculateBlueId*` APIs is semantic BlueId.
The future pipeline is:

- authoring or official input: preprocess, resolve, minimize, hash minimal;
- resolved input: minimize, hash minimal;
- minimal input: validate storage shape, hash minimal.

Low-level hash utilities can remain available, but they are not the public
application identity contract.

**Consequences**

Phase 0 adds opt-in contract tests for this future behavior without changing the
runtime implementation.
