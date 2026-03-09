# Final corrections checklist

## Cycle 1 — Named Event
- [x] align to `@blue-repository/types@0.21.0`
- [x] materialize `Common/Named Event`
- [x] remove fallback to `Conversation/Event`
- [x] named-event fields at root
- [x] update Stage 2 tests
- [x] update Stage 5 tests
- [x] remove obsolete deviations

## Cycle 2 — onChannelEvent
- [x] re-audit implementation
- [x] add positive runtime proof
- [x] remove limitation wording from docs/deviations

## Cycle 3 — Unsupported compatibility options
- [x] `subscribeToCreatedSessions(true)` fail-fast
- [x] `grantSessionSubscriptionOnResult` remains unsupported
- [x] review similar silent no-ops

## Cycle 4 — PayNote operation branches
- [x] re-check generic operation-triggered branch shape
- [x] remove artificial `Boolean` / `Integer` request schemas where omission is correct
- [x] update tests/docs/deviations

## Cycle 5 — Stage 6 event-driven channels
- [x] verify default `triggeredEventChannel`
- [x] verify or add explicit-channel support
- [x] add tests for both paths

## Cycle 6 — Docs/deviations reconciliation
- [x] final mapping reference updated
- [x] materialization reference updated
- [x] stage deviations updated
- [x] only true deferred items remain

## Final
- [x] full verification green
- [x] self-review completed
- [ ] commits created per cycle
