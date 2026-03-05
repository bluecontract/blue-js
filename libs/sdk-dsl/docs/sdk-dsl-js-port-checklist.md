# SDK DSL JS Port Checklist

Legend:
- ✅ implemented + tested
- ⚠️ partial
- ❌ pending

## Core document DSL

- ✅ `DocBuilder.doc/edit/from`
- ✅ `name/description/type`
- ✅ `field(path, value)` and `field(path)` metadata builder
- ✅ `section(...)` + reopen + `endSection()`
- ✅ `channel/channels/compositeChannel`
- ✅ `operation(...)` fluent + inline overloads
- ✅ `onInit/onEvent/onChannelEvent/onDocChange`
- ✅ matcher helpers: `onTriggeredWithId`, `onTriggeredWithMatcher`, `onMyOsResponse`, `onSubscriptionUpdate`
- ✅ change lifecycle: `contractsPolicy`, `directChange`, `proposeChange`, `acceptChange`, `rejectChange`

## Steps DSL

- ✅ core steps (`jsRaw`, `updateDocument`, `updateDocumentFromExpression`, `triggerEvent`, `emit`, `emitType`, `namedEvent`, `replaceValue`, `replaceExpression`, `raw`)
- ✅ capture namespace (`lock`, `unlock`, `markLocked`, `markUnlocked`, `requestNow`, `requestPartial`, `releaseFull`)
- ✅ payment payload builder (`triggerPayment`, `requestBackwardPayment`, rail builders)
- ✅ MyOS step helpers (`request/revoke permission`, participant helpers, call, subscribe, worker agency helpers)
- ⚠️ advanced extension hooks parity with Java POC (raw-step extension hook mapped/executed; broader Java POC extension set still pending)

## AI DSL

- ✅ `ai(name)` integration builder with task templates
- ✅ permission timing modes (`onInit`, `onEvent`, `onDocChange`, `manual`)
- ✅ `steps.askAI(...)` and `steps.ai(name).requestPermission()/subscribe()`
- ✅ `onAIResponse(...)` matcher includes requester + task/name correlation helpers

## PayNote DSL

- ✅ `PayNotes.payNote(name)` + `PayNoteBuilder`
- ✅ amount/currency helpers
- ✅ capture/reserve/release action builders (including operation unlock/partial-request variants)
- ⚠️ full Java parity for all paynote operation trigger variants

## Structure + patch

- ✅ `DocStructure.from(node)`
- ✅ `DocPatch.from(node)` diff/apply roundtrip

## Interaction builders

- ✅ `access(...)` (config + permission/revoke/subscribe/call + explicit-target helper coverage, including target-override permission/revoke variants)
- ✅ `accessLinked(...)` (config + permission/revoke/subscribe/call + explicit-target helper coverage, including target-override permission/revoke variants)
- ✅ `agency(...)` (config + permission/revoke/start-worker/call/subscribe + explicit-target helper coverage, including explicit permission/revoke variants)

## Docs and parity artifacts

- ✅ `issues.md`
- ✅ `mappings_diff.md`
- ⚠️ parity matrix still expanding (current suite covers foundational scenarios; additional Java parity suites pending)
