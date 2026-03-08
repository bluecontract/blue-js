# BLUE TS DSL SDK — Stage 6 testing strategy

## Test layers

### 1. Mapping / parity tests

Use the same parity approach as earlier stages:
- preprocess both nodes,
- compare `official` JSON,
- compare BlueIds where practical.

Good Stage-6 parity subjects:
- base PayNote document
- card transaction PayNote document
- merchant-to-customer PayNote document if implemented
- paynote delivery document
- payment mandate document
- individual typed payment/conversation event helpers
- macro-style flow builders and their materialized workflow/operation graph

### 2. Runtime integration tests

Use `document-processor` to prove behavior for representative scenarios:
- delivery lifecycle behavior where feasible
- mandate authorization/settlement behavior where feasible
- conversation bootstrap/customer-action helper scenarios
- macro-style request/lock/unlock flows where runtime support exists

### 3. Materialization tests

For macro-style builders, assert the exact generated contracts:
- generated channel dependencies,
- generated operation contracts,
- generated workflow contracts,
- matcher/event shapes,
- generated step payloads.

## Coverage targets

Minimum Stage-6 targets:
- every public document builder has at least one parity test
- every typed event helper family has parity tests
- every macro-style builder that is implemented has both:
  - a materialization test
  - at least one runtime-backed test if runtime support exists

## Deviation handling

Document every unavoidable deviation in `stage-6-deviations.md`.
Protect each deviation with a focused regression test.
