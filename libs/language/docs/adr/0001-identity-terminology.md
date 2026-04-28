### ADR 0001: Identity terminology

**Status:** Accepted for phase 0 guardrails.

**Context**

The current code and docs use `canonical` for several different ideas:
official wrapped shape, RFC 8785 JSON, and sometimes minimal authoring output.
The specification reserves canonical language for wrapped representation and
RFC 8785 canonical JSON.

**Decision**

Use these terms consistently:

- `official` or `wrapped` for the specification shape using `value` and `items`.
- `minimal` or `minimal overlay` for minimized authoring output.
- `resolved tree` for the current mutable `ResolvedBlueNode` form.
- `resolved snapshot` for the future immutable runtime artifact.
- `semantic BlueId` for public content identity.

`canonical` must only describe the official wrapped shape or RFC 8785 canonical
JSON.

**Consequences**

Future code and docs should rename ambiguous uses before changing behavior. This
ADR does not rename public APIs in phase 0.
