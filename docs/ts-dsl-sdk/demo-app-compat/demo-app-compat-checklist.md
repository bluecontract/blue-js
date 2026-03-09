# Demo-app compatibility uplift checklist

## Exports
- [x] `BasicBlueTypes`
- [x] `JsonObject`
- [x] `JsonValue`
- [x] `toOfficialJson(...)`
- [x] `toOfficialYaml(...)` (if trivial and semantically correct)

## DocBuilder wrappers
- [x] `sessionInteraction(...)`
- [x] `participantsOrchestration(...)`
- [x] `workerAgency(...)`
- [x] `documentAnchors(...)`
- [x] `documentLinks(...)`
- [x] `sessionLink(...)`
- [x] `documentLink(...)`
- [x] `documentTypeLink(...)`

## AI aliases
- [x] `onAIResponseForTask(...)`
- [x] `onAINamedResponse(...)`

## MyOS/session aliases
- [x] `onSessionCreated(...)`
- [x] `onLinkedDocGranted(...)`
- [x] `MyOsPermissions`
- [x] `steps.myOs().subscribeToSessionWithMatchers(...)`

## Tests
- [x] export/serialization compatibility tests
- [x] document wrapper equivalence tests
- [x] AI alias equivalence tests
- [x] MyOS permission helper tests
- [x] subscribe-with-matchers tests

## Verification
- [x] `npm install`
- [x] `tsc` lib
- [x] `tsc` spec
- [x] `eslint`
- [x] `vitest`
- [x] `vite build`
