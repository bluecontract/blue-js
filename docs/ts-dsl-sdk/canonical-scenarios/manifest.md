# Canonical scenario manifest

This manifest is the single index of the public canonical scenario corpus.

See also:
- `overview.md`
- `manifest.json`
- the individual scenario-group files

## Scenario groups

| Group | Stages | Kind | Primary test files | Status |
|---|---|---|---|---|
| `seed-blueprints` | 3–4 | compact document corpus | `CanonicalSeedBlueprints.test.ts` | Active |
| `myos-foundations` | 3 | runtime acceptance | `CanonicalMyOsFoundations.test.ts` | Active |
| `permissions-and-orchestration` | 4 | runtime acceptance | `CanonicalMyOsPermissionsAndOrchestration.test.ts` | Active |
| `ai-provider-patterns` | 5 | planned acceptance | none yet | Planned |
| `paynote-business` | 6 | planned acceptance | none yet | Planned |

## Key policy

Use the corpus incrementally:
- harden Stage 3 and 4 against the canonical MyOS groups before treating later stages as finished,
- then use the AI group for Stage 5,
- then use the PayNote group for Stage 6.

Do not postpone scenario hardening to a final end-stage.
