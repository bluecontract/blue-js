# Iteration protocol

The agent must follow this cycle for **every stage**.

## Mandatory cycle

1. **Implement full stage scope**
   - do not leave the stage half-done if it can be finished coherently
   - if needed, split only into the smallest coherent sub-stage

2. **Add or expand tests**
   - unit tests
   - parity tests
   - integration/runtime tests
   - canonical scenario tests where relevant

3. **Run full verification**
   - typecheck
   - linter
   - test suite
   - build

4. **Critically review the changes**
   - inspect for API drift
   - inspect for runtime drift
   - inspect for test weakness
   - inspect for unnecessary complexity
   - inspect for doc mismatch

5. **Fix/improve issues found in review**
   - do not move on with known obvious issues if they are inside the stage scope

6. **Update docs**
   - update stage docs
   - update scorecard
   - update cherry-pick log
   - update deviations docs if needed

7. **Commit**
   - use a conventional commit message
   - subject line max 72 chars

8. **Move to the next stage**

## Commit format

Recommended forms:
- `feat(sdk-dsl): add alias json and contract helpers`
- `feat(sdk-dsl): add change lifecycle helper surface`
- `refactor(sdk-dsl): split builder internals by domain`
- `test(sdk-dsl): harden macro builders with scenarios`
- `docs(sdk-dsl): refresh scorecard and canonical docs`

## If blocked

If a true blocker appears:
- finish all unblocked work inside the stage
- document blocker in the relevant stage deviations doc
- document impact in `scorecard.md`
- continue only if the next stage is not dependent on the unresolved blocker

Do not hide blockers.
Do not silently skip stage deliverables.
