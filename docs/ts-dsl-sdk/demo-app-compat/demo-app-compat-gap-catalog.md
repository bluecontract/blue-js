# Demo-app compatibility gap catalog

This catalog lists concrete compatibility/ergonomic surfaces used by the local demo-app SDK and adjacent `myos-js` code.

## High-priority gaps
| Surface | Status | Notes |
| --- | --- | --- |
| `BasicBlueTypes` | Covered | Exported as a thin constant map of common repo type aliases. |
| `toOfficialJson(...)` | Covered | Compatibility name over the existing alias-style JSON export path. |
| `JsonObject` / `JsonValue` exports | Covered | Exported for external authoring helpers and bootstrap/document input typing. |
| `sessionInteraction(...)` | Covered | Thin marker-contract wrapper over `contract(...)`. |
| `participantsOrchestration(...)` | Covered | Thin marker-contract wrapper over `contract(...)`. |
| `workerAgency(...)` | Covered | Thin marker-contract wrapper over `contract(...)`. |
| `documentAnchors(...)` | Covered | Thin alias over `anchors(...)`; also supports function-style object filling for migration convenience. |
| `documentLinks(...)` | Covered | Thin alias over `links(...)`; also supports function-style object filling for migration convenience. |
| `sessionLink(...)` | Covered | Cumulative convenience insertion into the `links` contract. |
| `documentLink(...)` | Covered | Cumulative convenience insertion into the `links` contract. |
| `documentTypeLink(...)` | Covered | Cumulative convenience insertion into the `links` contract using `documentType.blueId`. |
| `onAIResponseForTask(...)` | Covered | Thin alias over `onAIResponse(...)` task-filtered matching. |
| `onAINamedResponse(...)` | Covered | Thin alias over `onAIResponse(...)` named-event matching. |
| `onSessionCreated(...)` | Covered | Compatibility alias for `MyOS/Subscription to Session Initiated` listeners after access config validation. |
| `onLinkedDocGranted(...)` | Covered | Concrete linked-document notification helper for `MyOS/Single Document Permission Granted`. |
| `MyOsPermissions` | Covered | Thin authored-permission helper; `.write(...)` maps to runtime-confirmed `share`. |
| `steps.myOs().subscribeToSessionWithMatchers(...)` | Covered | Thin alias over `subscribeToSessionRequested(...)` with matcher arrays. It intentionally does not accept `onBehalfOf`. |

## Additional compatibility aliases delivered in the follow-up pass
| Surface | Status | Notes |
| --- | --- | --- |
| `onLinkedDocRejected(...)` | Covered | Optional compatibility alias over linked-documents permission lifecycle rejection. |
| `onLinkedDocRevoked(...)` | Covered | Optional compatibility alias over linked-documents permission lifecycle revocation. |

## Notes
- These are primarily ergonomics / compatibility items, not new runtime mappings.
- Implement as thin wrappers or aliases over current mainline behavior whenever possible.
- `requestBackwardPayment(...)` is intentionally excluded from this pass and remains deferred/runtime-guarded.
- Subscribe helpers intentionally differ from the legacy demo-app call shape by
  omitting `onBehalfOf`, because the final runtime event shape does not support
  it.
- `onChannelEvent(...)` timeline-channel matcher wrapping under `event.message`
  is correct on the current runtime and not treated as a limitation.
