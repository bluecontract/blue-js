# Rules for using the canonical scenario corpus

## Zero-drift requirement

The DSL-built document must preserve:
- document type
- contract keys
- workflow structure
- event matcher structure
- request payload structure
- runtime-visible behavior

Any deviation must be explicit and documented.

## Required test shape for each adopted scenario

For each scenario selected from the corpus, add:

1. **DSL reconstruction test**
   - rebuild the canonical authored document with DSL
   - compare against the canonical document after preprocess using `official` JSON and BlueId

2. **Runtime proof test**
   - run the canonical scenario with the DSL-built document
   - prove the same runtime-visible behavior

3. **Deviation test** only if required
   - only when runtime or schema reality forces a documented difference

## What not to do

- do not rewrite canonical scenarios into nicer but different documents
- do not simplify away branches just to make the DSL test shorter
- do not pull in unrelated REST/API assertions
