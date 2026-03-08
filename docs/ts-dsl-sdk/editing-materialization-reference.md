# Editing materialization reference

## Purpose

This document defines how the stage-7 editing pipeline should materialize document inspection, patching, and BLUE-aware change planning.

It complements:
- `final-dsl-sdk-mapping-reference.md` — document/contract/event shapes,
- `complex-flow-materialization-reference.md` — how macro-flow builders expand into multiple contracts/workflows.

## 1. Editing model layers

There are three distinct layers.

### 1.1 Structure extraction layer
Input:
- existing `BlueNode`

Output:
- stable structure summary suitable for:
  - humans,
  - coding agents,
  - patch/change planning,
  - optional DSL regeneration

This is `DocStructure`.

### 1.2 Generic patch layer
Input:
- original document
- modified document or a sequence of generic mutations

Output:
- ordered generic patch ops

This is `DocPatch`.

This layer is deliberately **not BLUE-aware**.

Generic patch values use a stable Stage-7 editing JSON representation:
- plain objects/lists stay plain when a node has no explicit BLUE metadata,
- metadata-bearing nodes are wrapped in a reserved envelope:
  - `$sdkDslEnvelope`
  - `$sdkDslNode`
  - `$sdkDslItems`

The representation is collision-safe:
- plain user objects using `$sdkDslNode` or `$sdkDslItems` remain plain user data,
- actual internal envelopes are identified by the dedicated `$sdkDslEnvelope` marker,
- user keys that collide with internal envelope-only keys are escaped internally and
  unescaped during deserialization.

This keeps root-field patch paths human-meaningful like `/counter` while still
preserving typed scalar nodes and step payloads losslessly.

### 1.3 BLUE-aware change planning layer
Input:
- original and modified documents or summaries

Output:
- change plan split into:
  - root field changes,
  - contract changes,
  - section-aware grouping metadata

This is `BlueChangeCompiler`.

## 2. DocStructure materialization rules

### 2.1 Root metadata
Always extract, if present:
- `name`
- `description`
- `type`

### 2.2 Root fields
Include all non-structural root fields.
At minimum, exclude:
- `/contracts`
- internal preprocessed metadata if any

Each field entry should include:
- `path`
- `kind`: `primitive | object | array | typed-node-like`
- `preview`: short deterministic preview
- optionally `rawValue` in machine-readable summary JSON

### 2.3 Contract inventory
Each contract entry should include:
- `key`
- `type`
- `kind`
- compact summary properties where available

Expected `kind` values:
- `channel`
- `operation`
- `operationImpl`
- `workflow`
- `section`
- `policy`
- `other`

Useful summary fields when present:
- `channel`
- `operation`
- `requestType`
- `eventType`
- `subscriptionId`
- `paths`
- `relatedFields`
- `relatedContracts`

Unknown contracts:
- must not break extraction
- remain in output as `kind: other`

### 2.4 Sections
For section contracts, preserve:
- `key`
- `title`
- `summary`
- `relatedFields`
- `relatedContracts`

### 2.5 Policies
Policies should be surfaced separately if recognizable.
At minimum:
- contracts of policy-like known types
- otherwise leave them in contracts inventory as `other`

### 2.6 Stable ordering
Ordering rules:
1. root fields by path
2. contracts by key
3. sections by key
4. related fields and contracts in source order when reliable, otherwise stable lexicographic order

## 3. DocPatch materialization rules

### 3.1 Scope
`DocPatch` is generic.
It may:
- mutate a JSON clone,
- compute generic patch ops,
- apply them in tests.

It must not:
- infer BLUE semantics,
- decide section buckets,
- rewrite contract internals specially.

It should preserve explicit typed scalar nodes in `value` payloads when the
source document carries them. The path model remains field-oriented even when
the payload itself is represented through the Stage-7 envelope.

### 3.2 Deterministic patch ordering
Recommended ordering:
1. removals
2. replacements
3. additions

Within each class:
- stable path order

### 3.3 Contract paths
`DocPatch` may patch inside `/contracts/...` generically.
The BLUE-aware restriction of “whole-contract replacement only” belongs to `BlueChangeCompiler`, not `DocPatch`.

## 4. BlueChangeCompiler materialization rules

## 4.1 Output model
`BlueChangePlan` should separate:
- root changes
- contract additions
- contract replacements
- contract removals
- grouping metadata
- notes/warnings

### 4.2 Root changes
Root changes cover:
- non-contract root fields
- metadata changes like `name`, `description`, `type`

### 4.3 Contract changes are atomic
This is the most important rule.

If `/contracts/<key>` differs at all:
- treat it as an atomic unit

Allowed compiled actions:
- add whole contract
- replace whole contract
- remove whole contract

Disallowed compiled action:
- partial in-contract patch planning

### 4.4 Section-aware grouping
If a changed contract belongs to a known section:
- preserve that section association in the compiled plan

If no section is known:
- infer a stable fallback bucket:
  - `participants`
  - `logic`
  - `ai`
  - `payments`
  - `paynote`
  - `misc`

### 4.5 Multi-contract macro flows
Macro-flow builders may expand into several contracts/workflows.
`BlueChangeCompiler` should treat each materialized contract atomically.
It does **not** need to reverse-infer the original high-level DSL helper call.
That inference belongs only to optional generator/stub helpers.

## 5. Regeneration helper rules

### 5.1 DslStubGenerator
Purpose:
- generate concise TS-first scaffolding for editing tasks

It should prefer:
- explicit `.field(...)`
- explicit `.channel(...)`
- explicit `.operation(...)`
- explicit `.on...(...)`
over clever reconstruction guesses.

### 5.2 DslGenerator
Purpose:
- produce fuller TS DSL output when feasible

It may be imperfect.
If perfect regeneration is not possible:
- generate a stable, documented approximation
- annotate or document information loss

### 5.3 Generators must not invent behavior
They may summarize or stub.
They must not invent contracts, steps, or semantics not present in the document.

## 6. Required test pipelines

For each representative document:
1. build base doc with SDK
2. extract structure
3. build modified target doc with SDK
4. compute generic patch and/or BLUE-aware change plan
5. apply patch or compare compiled output
6. assert canonical final equality
7. assert structure equivalence where appropriate

## 7. Acceptance standard

Stage 7 editing materialization is correct when:
- structure extraction is deterministic and resilient,
- generic patching is deterministic,
- BLUE-aware changes respect atomic contract replacement,
- grouping is stable,
- generators are either stable and documented or explicitly deferred.
