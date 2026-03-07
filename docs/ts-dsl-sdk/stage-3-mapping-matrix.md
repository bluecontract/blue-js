# BLUE TS DSL SDK — Stage 3 mapping matrix

Use this file as the implementation and mapping checklist.

Primary mapping source for all rows below:
- `docs/ts-dsl-sdk/final-dsl-sdk-mapping-reference.md`

| Feature | Final mapping reference | Java reference role | TS API / helper | Expected contracts / nodes | Tests | Status | Notes |
|---|---|---|---|---|---|---|---|
| `myOsAdmin(...)` | 5.1, 4.3 | API shape + scenario discovery | `DocBuilder.myOsAdmin(...)` | `myOsAdminChannel` + `myOsAdminUpdate` + `myOsAdminUpdateImpl` | parity + runtime | TODO | Root type unchanged |
| `onTriggeredWithId(...)` | 4.5, 5.2, 5.4, 5.5 | API shape + matcher ergonomics | Java-equivalent signature | triggered workflow with id-based matcher on triggered channel | parity | TODO | |
| `onTriggeredWithMatcher(...)` | 4.5, 5.2 | API shape + matcher ergonomics | Java-equivalent signature | triggered workflow with matcher object | parity | TODO | |
| `onSubscriptionUpdate(...)` | 5.4, 4.5 | API shape + scenario discovery | Java-equivalent signature | triggered workflow matching `MyOS/Subscription Update` + subscription id | parity + runtime | TODO | |
| `onMyOsResponse(...)` | 5.5, 4.5 | API shape + scenario discovery | Java-equivalent signature | triggered workflow matching MyOS response forwarding wrapper / correlation shape | parity + runtime | TODO | |
| `steps.myOs()` / `MyOsSteps` | 8.1 | Secondary only | `steps.myOs()` | namespace entry | unit/parity | TODO | |
| SDPG request helper | 5.2 | Scenario discovery | Java-equivalent helper | `MyOS/Single Document Permission Grant Requested` event | parity + runtime | TODO | |
| subscribe-to-session helper | 5.4 | Scenario discovery | Java-equivalent helper | `MyOS/Subscribe to Session Requested` event | parity + runtime | TODO | |
| call-operation helper | 5.5 | Scenario discovery | Java-equivalent helper | `MyOS/Call Operation Requested` event | parity + runtime | TODO | |
| bootstrap-aligned interaction foundations | 3.5, 5.9 | Context only | compose with existing Stage 2 bootstrap helpers | Stage 3 helpers must not contradict bootstrap mapping | exact behavior | TODO | |
| non-admin session-interaction example | 5.1, 5.2, 5.4, 5.5, 8.1 | Scenario discovery | composed DSL scenario | root type unchanged + admin helper contracts + runtime flow | runtime | TODO | |

## Notes

- Use exact Java file paths once the relevant references are identified.
- If a Java stage-3 feature conflicts with the final mapping reference, record the deviation in `stage-3-deviations.md`.
