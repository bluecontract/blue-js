# Final corrections checklist

## Cycle 1 — Named Event
- [ ] align to `@blue-repository/types@0.21.0`
- [ ] materialize `Common/Named Event`
- [ ] remove fallback to `Conversation/Event`
- [ ] named-event fields at root
- [ ] update Stage 2 tests
- [ ] update Stage 5 tests
- [ ] remove obsolete deviations

## Cycle 2 — onChannelEvent
- [ ] re-audit implementation
- [ ] add positive runtime proof
- [ ] remove limitation wording from docs/deviations

## Cycle 3 — Unsupported compatibility options
- [ ] `subscribeToCreatedSessions(true)` fail-fast
- [ ] `grantSessionSubscriptionOnResult` remains unsupported
- [ ] review similar silent no-ops

## Cycle 4 — PayNote operation branches
- [ ] re-check generic operation-triggered branch shape
- [ ] remove artificial `Boolean` / `Integer` request schemas where omission is correct
- [ ] update tests/docs/deviations

## Cycle 5 — Stage 6 event-driven channels
- [ ] verify default `triggeredEventChannel`
- [ ] verify or add explicit-channel support
- [ ] add tests for both paths

## Cycle 6 — Docs/deviations reconciliation
- [ ] final mapping reference updated
- [ ] materialization reference updated
- [ ] stage deviations updated
- [ ] only true deferred items remain

## Final
- [ ] full verification green
- [ ] self-review completed
- [ ] commits created per cycle
