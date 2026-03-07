# Stage 4.5 Testing Strategy

## Test taxonomy

### 1. Reference shape equivalence
Goal:
prove that a DSL-authored document matches the canonical reference document.

Oracle:
- preprocess
- official JSON
- optional BlueId comparison

### 2. Runtime proof
Goal:
prove that the DSL-authored document still executes the reference flow correctly.

This may compare:
- state changes
- emitted events
- response correlation
- subscription behavior
- worker-session startup behavior

### 3. Materialization assertions for macro builders
For stage 4 macro builders (`access`, `accessLinked`, `agency`), tests should also assert the expected workflow/contract topology where useful.

## Coverage expectation
- Suite 00: at least 2 scenarios
- Suite 10: at least 3 scenarios
- Suite 20: at least 3 scenarios
