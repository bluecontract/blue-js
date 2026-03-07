# BLUE TS DSL SDK — Stage 4 mapping matrix

| Construct / helper | Primary mapping reference | Expected runtime artifact | Notes |
|---|---|---|---|
| `access(...)` | 5.2, 5.10, 8.2 | single-document permission request/control flow and related contracts | Exact fluent API shape should follow Java refs where feasible |
| `accessLinked(...)` | 5.3, 5.6, 5.10, 8.2 | linked-documents permission request/control flow and related contracts | Must respect anchors/links semantics |
| `agency(...)` | 5.8, 8.2 | worker-agency permission request/control flow and worker-session-start composition | Runtime-first if Java differs |
| access-related step helpers | 5.2, 5.4, 5.5 | request/subscription/call-operation composition helpers | Prefer Stage 3 helper composition |
| linked-access-related step helpers | 5.3, 5.6 | linked-doc request/composition helpers | Correlation by requestId where required |
| agency-related step helpers | 5.8 | worker-agency request/start-worker-session composition helpers | Keep wrappers thin |
| stage-4 regression/deviation cases | deviations doc | focused tests | Every justified mismatch must be documented |
