### ADR 0003: Node blueId is a reference field

**Status:** Accepted for phase 0 guardrails.

**Context**

The specification says a node must not store its own BlueId as authoritative
content. A document field named `blueId` is used for references, especially the
exact pure reference shape `{ blueId: "..." }`.

**Decision**

Treat the model field currently exposed as `getBlueId()` / `setBlueId()` as a
reference BlueId. Future implementation should introduce
`getReferenceBlueId()` / `setReferenceBlueId()` and keep existing methods as
deprecated compatibility aliases during migration.

**Consequences**

Code that needs computed identity must call semantic identity services instead
of reading `node.getBlueId()`.
