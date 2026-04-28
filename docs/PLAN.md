## 1. Opis / context

Aktualnie `libs/language` miesza cztery różne pojęcia:

- **official / wrapped form** — czyli specowe `value` / `items`,
- **minimal overlay form** — wynik minimizacji,
- **resolved tree** — forma runtime’owa,
- **BlueId** — które raz liczone jest z inputu, raz z providerowego contentu, a raz z reverse/minimize.

To jest główna przyczyna obecnych problemów. Sam koszt `resolve()` jest istotny, ale pierwotny kłopot jest taki, że system nie ma jednej semantyki identity. Spec jest tu już dość jednoznaczny: official canonical shape to wrapped form, `BlueId` ma być stabilny dla równoważnych form authoringowych i dla expansion/resolution, pure reference short-circuit działa tylko dla exact `{ blueId: ... }`, puste listy są znaczące, a minimization ma zachować i snapshot, i `BlueId`. ([language.blue][1])

Dlatego nowy plan dla `language` powinien z góry założyć taki target:

- publiczne `Blue.calculateBlueId*` = **semantic BlueId**,
- providerzy zapisują **minimal overlay form** pod semantic `BlueId`,
- `resolve()` / `resolveToSnapshot()` daje **runtime snapshot**,
- spec-native list forms (`$previous`, `$pos`, `$empty`) są domykane jeszcze
  w Phase 1K, przed snapshotami,
- bezpośrednie cykle `this#k` zostają osobną końcową ścieżką konformacyjną.
  ([language.blue][1])

## 2. Design / ADR

### ADR-01 — Terminologia jest twardą częścią API

Rezerwujemy słowo **canonical** wyłącznie dla:

- specowego wrapped shape,
- albo canonical JSON z RFC 8785.

Nie używamy `canonical` dla minimal overlay.

W kodzie i docs zostają cztery terminy:

- `official` / `wrapped`,
- `minimal`,
- `resolved`,
- `semantic BlueId`.
  To jest ważne, bo spec już nazywa wrapped form „official canonical representation”. ([language.blue][1])

### ADR-02 — Publiczne `Blue.calculateBlueId*` oznacza semantic identity

Publiczne API liczy semantic `BlueId`, a nie hash chwilowej materializacji.

Docelowy pipeline:

- authoring / official input → `preprocess -> resolve -> minimize -> hash(minimal)`
- resolved input → `minimize -> hash(minimal)`
- minimal input → `validateStorageShape -> hash(minimal)`

Low-level hasher nadal istnieje, ale przestaje być „główną prawdą” dla aplikacyjnego API. Wynika to bezpośrednio z tego, że expansion nie może zmieniać `BlueId`, a minimization ma dawać ten sam snapshot i ten sam `BlueId`. ([language.blue][1])

### ADR-03 — `blueId` w modelu jest referencją, nie computed identity

Semantycznie rozdzielamy:

- `referenceBlueId`
- computed / semantic identity

Na poziomie dokumentu pole dalej nazywa się `blueId`, ale w modelu `BlueNode` przestajemy traktować je jako „własny ID noda”. Spec mówi wprost, że node nie może przechowywać własnego `BlueId` jako autorytatywnej treści; `{ blueId: ... }` jest do referencji. ([language.blue][1])

Praktycznie:

- nowy kod używa `getReferenceBlueId()` / `setReferenceBlueId()`,
- `getBlueId()` / `setBlueId()` mogą zostać tymczasowo jako deprecated aliasy, żeby nie zerwać od razu całego monorepo.

### ADR-04 — Minimization i provider/storage idą razem

To jest kluczowa zmiana względem poprzedniego planu.

`minimize()` staje się pierwszoklasowym API, a providerzy zaczynają zapisywać **minimal overlay form**, nie „preprocessed JSON” ani resolved explosion. Robimy to w tej samej fazie co semantic `BlueId`, bo spec mówi, że minimize ma odtwarzać ten sam resolved snapshot i ten sam `BlueId`. Nie ma sensu naprawiać identity bez równoczesnej zmiany storage semantics. ([language.blue][1])

Ważne zastrzeżenie: do czasu końcowej fazy list/cykli minimal overlay format dla dwóch przypadków będzie **wewnętrznie przejściowy**:

- list overlays,
- direct cyclic multi-doc sets.

Czyli po fazie 1 storage jest już „minimal-first”, ale jeszcze nie ogłaszamy jego finalnego publicznego kontraktu dla tych dwóch specjalnych rodzin przypadków.

### ADR-05 — Snapshoty są fazą drugą i mają być DP-ready

Po ustabilizowaniu identity i storage wchodzi:

- `ResolvedSnapshot`,
- freeze/finalization,
- lazy caches,
- copy-on-write po ścieżce.

To jest świadoma decyzja architektoniczna: nie domykamy jeszcze list control forms ani `this#k`, ale budujemy runtime artifact, którego później użyje `document-processor`. Spec już przy resolve mówi o finalizacji resolved snapshotu, więc ten kierunek jest naturalny. ([language.blue][1])

### ADR-06 — Spec-native listy i `this#k` zamykają program zmian

Na końcu implementujemy:

- `$previous`,
- `$pos`,
- `$empty`,
- direct-cycle combined BlueId z `this#k`.

To jest ostatnia faza, bo:

- domyka pełną zgodność ze spec,
- daje finalne optymalizacje listowe,
- finalizuje semantykę multi-doc cyclic sets. ([language.blue][1])

## 3. Plan implementacji i testów

## Faza 0 — Guardrails, glossary, red tests, benchmark baseline

### Cel

Ustawić język pojęć i mieć bezpiecznik przed dużym refaktorem.

### Implementacja

- dodać `docs/adr/` z ADR-ami powyżej,
- dodać `docs/glossary.md`,
- dodać fixture matrix do `libs/language/src/lib/__fixtures__/identity/`,
- dodać baseline benchmarków:
  - `calculate-blue-id`,
  - `resolve`,
  - nowy: `snapshot-patch` jako placeholder do późniejszej fazy.

### Fixture matrix

Minimum:

- scalar sugar vs wrapped scalar,
- list sugar vs wrapped list,
- pure ref,
- materialized ref subtree,
- mixed `blueId + payload` w authoring/storage input,
- present-empty list,
- append-only list,
- positional list,
- direct cyclic 2-doc set,
- resolved inherited-type tree.

### Testy

Na końcu fazy 0:

- fixture’y są gotowe,
- benchmark baseline zapisany,
- istnieją red tests dla docelowej semantyki.

### Naturalny podział na PR

- PR-0A: glossary + ADR
- PR-0B: fixtures + benchmark baseline

---

## Faza 1 — Semantic BlueId core + minimize + provider/storage

To jest teraz główna faza. Łączy stare „1, 2 i 3”.

### Cel

Dostarczyć **jedną semantykę identity** i od razu przepiąć storage pod minimal overlay.

### Strumień 1A — Low-level hasher zgodny z §8

#### Implementacja

Wydzielić warstwę identity, np.:

- `src/lib/identity/BlueIdHashNormalizer.ts`
- `src/lib/identity/BlueIdHasher.ts`

lub analogiczny refaktor obecnego `BlueIdCalculator`.

Zasady:

- pure-ref short-circuit tylko dla exact `{ blueId }`,
- `null` i `{}` są usuwane,
- `[]` zostaje,
- wrapper equivalence działa dla `value` i `items`,
- list hash używa `id([])` + domain-separated fold,
- scalar hash używa canonical JSON scalar,
- map hashing nie polega na publicznym serializerze JSON.
  To wszystko jest bezpośrednio opisane w §8 i §12. ([language.blue][1])

#### Pliki

- `src/lib/utils/BlueIdCalculator.ts`
- nowe `src/lib/identity/*`
- odpięcie hash path od `src/lib/utils/NodeToMapListOrValue.ts`

#### Testy

- `[] != absent`
- `[A] != A`
- `[[A,B],C] != [A,B,C]`
- `x: 1` == `x: { value: 1 }`
- `x: [a,b]` == `x: { items: [a,b] }`
- mixed `blueId + payload` nie short-circuituje

### Strumień 1B — Semantic pipeline

#### Implementacja

Dodać `SemanticIdentityService`.

Publiczne:

- `Blue.calculateBlueId*` przechodzi na semantic pipeline,
- `Blue.minimize()` staje się publicznym API,
- `Blue.reverse()` zostaje jako deprecated alias do czasu cleanupu.

#### Model

- `Node.ts`:
  - `getReferenceBlueId()`,
  - `setReferenceBlueId()`,
  - deprecated aliasy `getBlueId()/setBlueId()`.

#### Ważna walidacja

**Storage/authoring ingest** ma odrzucać niejednoznaczne inputy z mieszanym `blueId + payload`, ale **resolved/materialized runtime trees** nie są przez to blokowane. Innymi słowy:

- authoring/storage path: strict,
- internal resolved path: dozwolony materialized ref subtree, ale bez pure-ref short-circuit.

To jest ważne, bo expansion ma zachować identity, ale pure-ref short-circuit ma działać tylko dla exact reference form. ([language.blue][1])

#### Pliki

- `src/lib/Blue.ts`
- `src/lib/model/Node.ts`
- `src/lib/model/ResolvedNode.ts`
- `src/lib/utils/Nodes.ts`
- call site’y `getBlueId()/setBlueId()`

#### Testy

- authoring / resolved / minimal mają ten sam `BlueId`,
- `PathLimits` nie zmieniają `BlueId`,
- expansion nie zmienia `BlueId`,
- storage/authoring input z mixed `blueId + payload` jest odrzucany. ([language.blue][1])

### Strumień 1C — Minimizer + provider/storage

#### Implementacja

Przekształcić logikę `reverse()` w jawny `Minimizer`.

Providerzy:

- `NodeContentHandler`
- `BasicNodeProvider`
- `RepositoryBasedNodeProvider`
- `InMemoryNodeProvider`

przechodzą na:

- parse/preprocess,
- semantic identity pipeline,
- zapis `minimalOverlay + semanticBlueId`.

Jeżeli caller podaje `providedBlueId` i nie zgadza się z semantic ID:

- reject.

#### Ważne zastrzeżenie

Do końca fazy 3 minimal overlay dla:

- list overlays,
- direct cycles,

może być jeszcze w przejściowym formacie wewnętrznym. To nie blokuje sensu tej fazy, bo i tak nie wypuszczacie jeszcze major release.

#### Testy

- fetch po BlueId zwraca minimal overlay,
- `resolve(fetch(id))` daje poprawny snapshot,
- provider nie zapisuje resolved explosion,
- provider odrzuca niezgodne `providedBlueId`.

### Strumień 1D — Benchmarks i docs

#### Implementacja

- zaktualizować README,
- `docs/blue-id.md`,
- `docs/resolve.md`,
- opisać różnicę:
  - official,
  - minimal,
  - resolved,
  - semantic BlueId.

#### Testy

- benchmark `calculate-blue-id`: brak istotnej regresji,
- benchmark `resolve`: brak istotnej regresji,
- nowe golden docs / examples.

### Exit criteria fazy 1

Po tej fazie:

- dla zwykłych dokumentów `Blue.calculateBlueId*` ma już poprawną semantykę,
- providerzy zapisują minimal overlay,
- `document-processor` może jeszcze nie używać snapshotów,
- list control forms i `this#k` nie są jeszcze finalnie domknięte.

### Naturalny podział na PR

- PR-1A: hasher core
- PR-1B: semantic pipeline + model semantics
- PR-1C: minimizer + providers
- PR-1D: docs + deprecations

---

## Current status — Phase 1 stabilization

Status after implementing the 1E/1F/1G/1H stabilization block and the strict
provider cleanup: semantic storage is now the only normal provider ingest path.
Provider ingest either stores minimal content under its semantic `BlueId` or
fails immediately. `BaseContentNodeProvider` remains an audited bootstrap-only
raw-ID exception for transformation resources.

### Done

- `BasicNodeProvider`, `InMemoryNodeProvider`, and
  `RepositoryBasedNodeProvider` now use the shared semantic storage identity
  path instead of deriving storage truth without a full `resolve()`.
- `BasicNodeProvider` and `InMemoryNodeProvider` no longer have a resolve-error
  fallback to storage overlay.
- Repository `contents` keys are checked against semantic `BlueId`; historical
  package keys are no longer exposed as fetchable storage IDs.
- Repository ingest still uses constructor-local bootstrap maps so repository
  entries can resolve references to each other while loading. Those maps are
  cleared after strict semantic ID verification and are not a public
  historical-ID compatibility path.
- `providedBlueId` and repository content keys are checked against the semantic
  `BlueId`, not against the old hash of the preprocessed/minimized authoring
  form.
- `NodeContentHandler` delegates storage processing, and semantic storage runs
  preprocess, full resolve, `minimizeResolved()`, and low-level hashing of the
  minimal form.
- Root `blueId + payload` is rejected during provider ingest, the same as nested
  mixed reference payloads.
- `this` / `this#k` are special only in `blueId` fields. Ordinary scalar
  strings such as `value: this` and list item `"this#1"` remain normal content.
- Provider/storage ingest rejects `blueId: this` and `blueId: this#k` until
  Phase 3 implements direct cyclic sets.
- `StorageShapeValidator.validateStorageShape()` rejects full payload-kind
  ambiguity: `blueId + payload`, `value + items`, `value/items + child fields`,
  and document-level `properties`.
- `SemanticIdentityService` has separate internal paths:
  `minimizeResolved()`, `minimizeAuthoring()`, and `hashMinimalTrusted()`.
- The minimizer no longer exposes public materialized-reference collapse hooks
  and does not generically collapse `blueId + payload` nodes to `{ blueId }`.
- Root instance `name` and `description` are preserved by minimization even when
  they equal the referenced type's `name` / `description`.
- Resolved/runtime nodes carry the minimum completeness metadata:
  `completeness: 'full' | 'path-limited'` and `sourceSemanticBlueId`.
- Path-limited `resolve()` no longer computes a full semantic `BlueId` just to
  set metadata. `sourceSemanticBlueId` is accepted from `ResolveOptions` or from
  an exact root pure reference only.
- `ResolvedBlueNode.getMinimalNode()` and `getMinimalBlueId()` now respect the
  path-limited guard and return the source reference only when the source
  semantic ID is known.
- `resolve()` now has caches for type overlays, node hashes, list hashes,
  subtype checks, and provider fetches per `blueId`; the per-typed-node clone of
  the resolved type overlay was removed.
- A mutation-leak regression test covers exposed resolved type objects so user
  mutations do not contaminate later resolves.
- `calculateBlueId` is treated as a low-level hash benchmark, while the separate
  semantic API benchmark covers authoring, resolved, explicitly named
  minimal-shaped authoring, and provider ingest cases.
- The semantic benchmark does not expose a public trusted-minimal hash API. The
  minimal-shaped authoring scenario is named
  `public-semantic-id-on-minimal-shaped-authoring` and uses the public semantic
  identity path.
- `snapshot-patch` remains a `patch-then-full-resolve` benchmark until Phase 2.
- Resolver-invalid tests use direct/raw test providers instead of relying on
  provider fallback to ingest invalid content.
- `$previous` stale anchors are now consumed as optimization hints and the
  effective list is recomputed against the current inherited prefix instead of
  throwing or trusting the stale seed.
- Public semantic identity no longer treats arbitrary wrapped/node
  list-control authoring input as trusted minimal storage; only internal trusted
  minimal hashing can pass `$previous` directly to the low-level hasher.
- Public top-level arrays passed to `Blue.calculateBlueId*` now normalize
  through list context before hashing. Top-level `$previous`, `$pos`, and
  `$empty` can no longer bypass semantic list-control handling by being treated
  as independent root nodes.
- `document-processor` `/blueId` and external event checkpoint IDs use semantic
  calculated identity instead of `getBlueId()` fallback. Operation Request
  document pins remain explicit reference targets when a resolved/materialized
  request still carries a reference `blueId`.
- The `@blue-repository/types` bridge rewrites indexed references such as
  `OLD#1 -> NEW#1`.
- `NodeExtender.mergeNodes()` clones provider-owned content before attaching it
  to expanded runtime nodes.

### Verification run

- `nx build language --skip-nx-cache` — passed.
- `nx tsc language --skip-nx-cache` — passed.
- `nx lint language` — passed.
- `nx test language --skip-nx-cache` — passed: 574 passed, 4 skipped,
  5 todo.
- `npx tsc -p libs/document-processor/tsconfig.lib.json --noEmit` — passed.
- `npx eslint libs/document-processor --fix` — passed.
- `nx test document-processor --skip-nx-cache` — passed: 349 passed.
- Benchmark refresh on 2026-04-27, Apple M1 Pro, Node `v22.22.1`, default
  config `2` warmup / `10` measured iterations, after
  `npx nx build language --skip-nx-cache`:
  - `node scripts/benchmark/calculateBlueId.mjs`: low-level hash avg
    `11155.99 ms`, baseline delta `-2078.06 ms (-15.70%)`.
  - `node scripts/benchmark/semanticBlueId.mjs`: authoring no-type avg
    `4.81 ms`, authoring shared-type avg `1.83 ms`, resolved avg `0.07 ms`,
    public semantic ID on minimal-shaped authoring avg `1.68 ms`, provider
    ingest avg `0.57 ms`.
  - `BENCH_SAVE_BASELINE=1 node scripts/benchmark/semanticBlueId.mjs`: saved
    `scripts/benchmark/data/semantic-blue-id-baseline.json` with authoring
    no-type avg `4.75 ms`, authoring shared-type avg `1.79 ms`, resolved avg
    `0.07 ms`, public semantic ID on minimal-shaped authoring avg `1.68 ms`,
    provider ingest avg `0.57 ms`.
  - `BENCH_COMPARE_BASELINE=1 node scripts/benchmark/semanticBlueId.mjs`:
    passed against the new semantic baseline.
  - `node scripts/benchmark/resolve.mjs`: shared resolve avg `46.62 ms`,
    baseline delta `-251.04 ms (-84.34%)`; clone total avg `165019`, baseline
    delta `-369719 (-69.14%)`.
  - `BENCH_TYPE_MODE=unique node scripts/benchmark/resolve.mjs`: unique
    resolve avg `1660.62 ms`, baseline delta `+58.43 ms (+3.65%)`; clone
    total avg `528612`, baseline delta `-441599 (-45.52%)`.
  - `node scripts/benchmark/snapshotPatch.mjs`: patch-then-full-resolve avg
    `1.96 ms`, baseline delta `-0.34 ms (-14.70%)`; clone total avg `10506`,
    baseline delta `-3900 (-27.07%)`.

### Deliberate transitional behavior

1. **BaseContentNodeProvider bootstrap IDs.** Transformation resources still use
   raw bootstrap IDs. This is an explicit bootstrap-only exception, not normal
   provider/storage ingest.
2. **Path-limited resolved trees.** Partial materialization must not pretend to
   be a full resolved snapshot or become a normal hash source without
   `sourceSemanticBlueId`.
3. **External Blue Repository Types.** The installed `@blue-repository/types`
   package still ships historical/pre-semantic storage keys. `document-processor`
   uses an explicit semantic reindex adapter for that package; `language`
   remains strict and does not add a normal historical-ID provider bypass.
4. **Operation Request document pins.** A `document` field in an Operation
   Request is a version pin/reference. If a resolved or materialized request
   still carries a reference `blueId`, DP treats that reference as the pinned
   document version. Inline document payloads without a reference use semantic
   calculated identity.

### Decisions before Phase 2

- Blue Repository Types are reindexed at the `document-processor` boundary by
  an explicit adapter. Long term, the package should publish semantic IDs
  directly; the strict provider path still does not include a dual-index/alias
  adapter in `language`.
- Repository semantic reindexing must preserve `typesMeta.status`. A `dev` type
  with empty `versions` remains `dev`; reindexing must not promote it to
  `stable`.
- Path-limited nodes now have the Phase 1 public contract: no eager full
  semantic identity calculation; source identity must be supplied by caller or
  be trivially known from an exact root reference.
- Matcher/type structural identity is intentionally not changed in this Phase 1
  finalization release. `name`/`description` can still affect existing matcher
  behavior because `Common/Named Event` and downstream contracts rely on that
  pattern today. A future release may introduce matcher-neutral labels only
  after those contracts are migrated to content fields such as `kind`,
  `operation`, or `eventKind`, or to explicit exact BlueId matching.
- Public `nodeToJson()` / `nodeToYaml()` are lossless projections of the
  current `BlueNode` shape and preserve materialized `blueId + payload`
  metadata. Storage-safe content is produced by minimization and
  `SemanticStorageService`, not by the serializer.
- Direct `NodeToObjectConverter` usage must inject `calculateBlueId`; the
  default raw `BlueIdCalculator` path is removed. `Blue.nodeToSchemaOutput()`
  remains the public convenience API and injects semantic identity.
- `dsl-sdk` may continue importing `createDefaultMergingProcessor` from
  `document-processor` in this phase. That dependency is not part of the
  identity boundary cleanup.
- Big decimal hashing is intentionally unchanged in this phase. Precise numbers
  outside safe JSON-number semantics should be represented as strings until a
  separate numeric identity decision is made.
- Phase 1K owns spec-native `$previous`, `$pos`, and `$empty`. Phase 3 owns
  direct cyclic `this#k` support. Legacy inherited-list markers are not a
  normal storage format in Phase 1.
- Top-level arrays passed to public `Blue.calculateBlueId*` are semantic lists,
  not a bag of independent root nodes. They must normalize through list context
  so `BlueNode[]`, JSON arrays, and pure `items` wrappers agree for the same
  list content.
- Phase 2 snapshots should not start until Phase 1M remains green for both
  `language` and `document-processor`.

---

## Faza 1M — Top-level array list-control closure

### Cel

Domknąć ostatnią lukę publicznego semantic identity przed Phase 2: top-level
array input w `Blue.calculateBlueId*` ma być traktowany jak lista, a nie jak
zestaw osobnych root node'ów. To jest istotne dla `$previous`, `$pos` i
`$empty`, bo spec rozpoznaje te formy tylko jako elementy listy.

### Problem

Obecny publiczny pipeline dla `BlueNode[]` minimalizuje każdy element tablicy
oddzielnie, a potem `hashMinimalTrusted()` waliduje każdy element jako root
node. Przez to top-level array traci `insideItems: true`:

- `$previous` na pierwszym elemencie może dojść do low-level hashera jako
  trusted seed,
- malformed `$empty` może ominąć walidację exact list-control item,
- `$pos` może dojść do raw hashera i rzucić techniczny błąd zamiast zostać
  skonsumowany albo odrzucony w semantic list normalization.

### Implementacja

- Dodać w `SemanticIdentityService` osobną ścieżkę dla publicznych array inputs:
  - zbudować tymczasowy wrapper `new BlueNode().setItems(items)`,
  - przepuścić wrapper przez `minimizeAuthoring()` / semantic list
    normalization,
  - zwrócić `minimalWrapper.getItems() ?? []` jako minimalną listę do hasha.
- Dodać `StorageShapeValidator.validateStorageListShape(nodes)` albo równoważny
  helper i używać go w `hashMinimalTrusted()` / `hashMinimalTrustedAsync()` dla
  tablic, zamiast walidować każdy element jako root.
- Zachować internal trusted minimal behavior low-level hashera: `$previous` może
  seedować fold tylko po przejściu list-context validation.
- Nie zmieniać semantyki pure list wrappers: top-level `BlueNode[]`, JSON array
  i node z samym `items` mają mieć ten sam semantic `BlueId` dla tej samej
  efektywnej listy.

### Testy

- `Blue.calculateBlueIdSync([{ $previous: { blueId: fakePrefixId } }, 'C'])`
  daje ten sam wynik co `Blue.calculateBlueIdSync(['C'])`.
- Ten sam przypadek przechodzi dla top-level `BlueNode[]`, nie tylko JSON array.
- Malformed top-level array `$empty`, np. `{ $empty: false }` i
  `{ $empty: true, value: 'extra' }`, jest odrzucany komunikatem z `$empty`.
- Top-level array z `$pos` nie dociera do raw `BlueIdHasher`; jest skonsumowany
  albo odrzucony przez semantic list normalization.
- Async/sync parity obejmuje top-level arrays z list controls.
- Regresja równoważności: `blue.calculateBlueIdSync(['A', 'B'])` ==
  `blue.calculateBlueIdSync(new BlueNode().setItems([A, B]))`, pod warunkiem że
  wrapper nie ma dodatkowych identity-bearing pól.

### Acceptance

Phase 1 może zostać oznaczona jako final DONE, gdy:

- public top-level arrays przechodzą przez semantic list normalization,
- top-level array `$previous` nie jest ślepo trustowany,
- top-level array `$empty` jest walidowany jako exact list-control content,
- top-level array `$pos` nigdy nie dochodzi do raw `BlueIdHasher`,
- `nx test language --skip-nx-cache`,
  `npx tsc -p libs/document-processor/tsconfig.lib.json --noEmit`,
  `npx eslint libs/document-processor --fix` i
  `nx test document-processor --skip-nx-cache` są zielone albo mają jawnie
  zaakceptowane przejściowe failure wynikające z dalszych faz.

---

## Faza 1N — Repo-wide semantic BlueId migration

### Cel

Domknąć Phase 1 poza samym `libs/language`: downstream packages nie mogą już
używać historycznych/raw identity paths jako publicznej prawdy dla typów,
runtime repository ani SDK. `language` zostaje właścicielem wspólnego adaptera
semantycznego, a `document-processor` pozostaje boundary, który tymczasowo
adaptuje obecne `@blue-repository/types`.

### Decyzje

- Dodajemy w `@blue-labs/language`
  `reindexRepositoryForSemanticStorage(repository, options?)`. Adapter
  przepisuje `aliases`, `contents`, `typesMeta`, `schemas`, exact `blueId`
  references oraz indeksowane referencje `OLD#i -> NEW#i`. Nie przepisuje
  `repositoryVersions`, bo historia repozytorium pozostaje raw/version
  fingerprintiem, nie publiczną semantic type identity.
- Cache adaptera nie może być współdzielony dla różnych `mergingProcessor`.
  Domyślna ścieżka może cache'ować po repository identity; custom processor
  idzie bez cache albo przez oddzielny klucz processor identity.
- `document-processor` importuje raw `@blue-repository/types` i reindeksuje je
  przez adapter z `language` na własnym boundary, ale nie wystawia tego bridge'a
  jako shared public API. Inne biblioteki tworzą własny local bridge przez
  `reindexRepositoryForSemanticStorage()`.
- `dsl-sdk` nie konstruuje już `Blue` z raw `@blue-repository/types`.
  Runtime identity używa lokalnego semantic repository bridge'a zbudowanego
  przez `reindexRepositoryForSemanticStorage()`; raw schema imports mogą zostać
  tylko jako walidatory, nie jako źródło identity.
- `repository-generator` przechodzi na hard semantic switch. Nie dodajemy
  `allowIdentityAlgorithmMigration`; normalny guard
  `content is unchanged but BlueId differs` zostaje aktywny, żeby wykrywać
  niejawne zmiany metadata.
- Source `.blue` w `repository-generator` jest specowym Blue authoring input,
  nie osobnym DSL-em z escape hatchem na reserved field names. Atrybuty
  użytkownika nie mogą nazywać się `value`, `items`, `blueId`, `blue` ani
  `properties`; `value` pozostaje dozwolone tylko jako scalar payload węzła.
- `repoDoc.computeRepoBlueId()` pozostaje raw structural fingerprintiem wersji
  repozytorium i jest celowo oddzielony od publicznej semantic type identity.
- `SemanticIdentityService.hashMinimalTrusted*()` jest internal trusted path,
  a nie publiczne API.
- `@blueId` w schema output oznacza publiczną semantic identity: mapper dostaje
  wstrzyknięty calculator z `Blue.nodeToSchemaOutput()`.

### Implementacja

- Przenieść helpery reindexowania z `document-processor` do
  `libs/language/src/lib/repository/SemanticRepositoryReindexer.ts` i dodać
  testy konwergencji, exact/id-index rewrite, schemas/type metadata rewrite
  oraz walidację strict repository keys po reindexingu.
- Odchudzić `libs/document-processor/src/repository/semantic-repository.ts` do
  wewnętrznego boundary adaptera nad raw `@blue-repository/types`; nie
  eksportować semantic repository z publicznego `src/index.ts`.
- W `dsl-sdk` zastąpić raw repository construction i raw conversation alias
  imports własnym local semantic bridge'em opartym o
  `reindexRepositoryForSemanticStorage()`; aktualizować
  `runtime-type-support.ts`, żeby czytał aliases z lokalnego semantic
  repository.
- W `repository-generator` liczyć `typeBlueId` semantycznie, zachowując
  hardcoded primitive/core IDs. Generator buduje incremental provider keyed by
  semantic IDs w topological order, podstawia znane aliasy, zachowuje
  oficjalny JSON source content po parsowaniu/preprocessingu i rejestruje alias
  dla kolejnych typów. Primitive/core IDs nie są seedowane do providera jako
  zwykły repository content, żeby nie nadpisać built-in basic type semantics.
- Usunąć generatorowy parser/normalizer, który traktował `value: { type: ... }`
  jako nazwę atrybutu. Źródło generatora ma przechodzić przez
  `Blue.jsonValueToNode()` i `Blue.calculateBlueIdSync()`, a spec-invalid
  reserved field usage ma być odrzucane przez normalną ścieżkę języka/storage.
- Zmienić nazwę `aliasToPreprocessed` na semantic storage name, np.
  `aliasToStorageContent`, i usunąć stare `normalizeForBlueId` jako publiczną
  ścieżkę generatora.
- Zregenerować fixtures/snapshoty generatora:
  `base/BlueRepository.blue`, `non-breaking/BlueRepository.blue`,
  `dev-change/BlueRepository.blue` oraz inline snapshots.
- Posprzątać language test usage `BlueIdCalculator` w testach normalnych
  provider/repository flows. Raw calculator zostaje tylko dla low-level hashera,
  CID, bootstrap-only paths, internal structural caches i jawnie historycznych
  repository-version fixtures.

### Acceptance

Repo-wide Phase 1 jest DONE dopiero gdy:

- `repository-generator` nie używa raw `BlueIdCalculator` jako publicznej
  prawdy `typeBlueId`,
- `dsl-sdk` nie ładuje raw `@blue-repository/types` jako runtime repository,
- `document-processor` ma internal semantic repository bridge, a `dsl-sdk`
  buduje własny bridge przez `language` zamiast importować repository z DP,
- `@blueId` schema output używa semantic calculatora,
- raw `BlueIdCalculator` usages w `language` są internal/low-level albo
  udokumentowanymi historycznymi fixtures,
- przechodzą:
  - `npx tsc -p libs/language/tsconfig.lib.json --noEmit`,
  - `npx tsc -p libs/document-processor/tsconfig.lib.json --noEmit`,
  - `npx tsc -p libs/repository-generator/tsconfig.lib.json --noEmit`,
  - `npx tsc -p libs/dsl-sdk/tsconfig.lib.json --noEmit`,
  - `npx eslint libs/language libs/document-processor libs/repository-generator libs/dsl-sdk --fix`,
  - `npx nx test language --skip-nx-cache`,
  - `npx nx test document-processor --skip-nx-cache`,
  - `npx nx test repository-generator --skip-nx-cache`,
  - `npx nx test dsl-sdk --skip-nx-cache`.

---

## Faza 1E — Semantic provider/storage parity

### Cel

Domknąć fazę 1 tak, żeby providerzy i publiczne API liczyli ten sam
semantic `BlueId` dla tego samego dokumentu. To jest blokujące przed
snapshotami: storage nie może mieć własnej, krótszej ścieżki identity.

### Implementacja

- `NodeContentHandler` przestaje traktować `BlueIdCalculator` po samym
  preprocess/minimize jako storage truth.
- Provider ingest używa tej samej semantyki co `Blue.calculateBlueId*`:
  - validate authoring/storage shape,
  - preprocess,
  - `resolve(NO_LIMITS)`,
  - `minimizeResolved(fullResolved)`,
  - validate minimal storage shape,
  - low-level hash minimal form.
- `providedBlueId` jest porównywany z semantic `BlueId`, nie z hashem
  preprocessed authoring form.
- `BasicNodeProvider`, `RepositoryBasedNodeProvider` i `InMemoryNodeProvider`
  zapisują minimal overlay pod semantic `BlueId`.
- Multi-doc direct cyclic sets są do fazy 3 ścieżką przejściową:
  - albo jawnie odrzucane, jeżeli nie da się ich policzyć bez `this#k`,
  - albo oznaczone jako internal transitional, bez deklarowania pełnej
    zgodności ze specem.

### Testy

- provider zapisuje content pod tym samym ID co `Blue.calculateBlueIdSync()`,
  także przy dziedziczonych redundantnych polach,
- provider odrzuca `providedBlueId`, jeżeli nie zgadza się z semantic ID,
- fetch po semantic ID zwraca minimal overlay, który po `resolve()` daje ten
  sam snapshot,
- `resolve(fetch(id))` zachowuje semantic `BlueId`,
- multi-doc direct cycles są odrzucane albo objęte testem przejściowej ścieżki.

### Exit criteria

- Nie ma osobnego providerowego pipeline'u identity.
- Storage truth = minimal overlay keyed by semantic `BlueId`.
- Test parity provider/public API jest zielony.

---

## Faza 1F — Resolve performance hardening

### Cel

Naprawić regresję `resolve()` przed wejściem w snapshoty. Obecne wyniki
`resolve(shared): +573.28%` i `resolve(unique): +106.09%` są blockerem dla
fazy 2.

### Implementacja

- Dodać cache w `ResolutionContext`:
  - `nodeHashCache: WeakMap<BlueNode, string>`,
  - `resolvedTypeCache: Map<string, ResolvedBlueNode>`,
  - `typeOverlayCache: Map<string, BlueNode>`,
  - `subtypeCache: Map<string, boolean>`,
  - provider fetch/deserialization cache per `blueId`, jeżeli fetch jest w tym
    samym resolve context.
- Nie robić `resolvedType.clone().setType(undefined).setBlueId(undefined)` dla
  każdego typed node'a. Overlay typu bez `type` i `blueId` powinien być
  cache'owany per resolved type artifact.
- Memoizować hashe elementów list używane przy porównaniu prefixów.
- Cache'ować subtype checks `(subtypeBlueId, supertypeBlueId) -> boolean`.
- Ograniczyć deep clone przed `ResolvedBlueNode`; docelowo przejmą to snapshoty
  i structural sharing.
- Path-limited resolution nie powinien niszczyć reuse full type artifact:
  limited materialization ma być view/projection z identity anchor, a nie nową
  podstawą hashowania.

### Benchmark gate

- `resolve(shared)`: maksymalnie `+10%` vs baseline fazy 0.
- `resolve(unique)`: maksymalnie `+10%` vs baseline fazy 0.
- `calculateBlueId` benchmark zostaje przemianowany mentalnie na low-level hash
  i nie zastępuje benchmarku publicznego semantic API.

### Testy / benchmarki

- benchmark `resolve` shared i unique jako twardy gate,
- testy regresyjne dla list prefix compare bez wielokrotnego hashowania tych
  samych node'ów,
- testy path limits pokazujące stabilne identity anchor.

---

## Faza 1G — Minimizer contract hardening

### Cel

Utwierdzić kontrakt minimizera: minimalizacja ma być idempotentna, bezpieczna
dla runtime/materialized nodes i nie może usuwać niezweryfikowanego payloadu.

### API docelowe

- `blue.minimizeResolved(resolvedFullNode)`
- `blue.minimizeAuthoring(authoringNode)` jako `resolve(NO_LIMITS) -> minimizeResolved`
- internal `SemanticIdentityService.hashMinimalTrusted(minimalNode)` jako
  `validateStorageShape -> low-level hash`

Publiczne `Blue.minimize()` może delegować do tych ścieżek, ale wewnętrzny kod
nie powinien mieszać authoring, resolved i storage shape.

### Twarde reguły

- `minimize()` nie działa na partial resolved tree bez metadata kompletności.
- `minimizeResolved(fullResolved)` jest idempotentne:
  `minimize(resolve(minimize(resolve(x)))) == minimize(resolve(x))`.
- `resolve(minimize(resolve(x)))` daje ten sam resolved snapshot co `resolve(x)`.
- `calculateBlueId(x) == calculateBlueId(minimize(resolve(x)))`.
- Mixed `blueId + payload` może być collapsowane tylko w trusted materialized
  expansion path.
- Authoring/storage mixed `blueId + payload` pozostaje błędem.
- Path-limited resolved tree nie jest zwykłym inputem minimizacji; może tylko
  zwrócić source semantic identity anchor.

### Metadata

- Dodać albo zaplanować metadata resolved/runtime:
  - `completeness: 'full' | 'path-limited'`,
  - `sourceMinimal?: BlueNode`,
  - `sourceSemanticBlueId?: string`.

### Testy

- `minimize(resolve(x))` usuwa dziedziczone redundantne wartości,
- `minimize(resolve(x))` zachowuje instance overrides,
- untrusted `blueId + payload` nie jest collapsowane do `{ blueId }`,
- trusted materialized provider expansion zachowuje ten sam semantic ID,
- path-limited resolved tree nie staje się źródłem hasha bez source identity,
- minimalizacja roundtripuje przez `resolve()` bez zmiany semantic `BlueId`.

### Exit criteria fazy 1G

- Minimizer ma osobne ścieżki dla authoring/resolved/trusted minimal.
- Nie ma agresywnego collapsowania każdego node'a z `blueId + payload`.
- Golden roundtrip tests są zielone.

---

## Faza 1H — Storage shape + self-reference + minimizer guards

### Cel

Domknąć correctness fazy 1 przed snapshotami. To jest krótki stabilizujący PR,
nie nowa architektura: naprawia kontrakty, które muszą być prawdziwe zanim Phase
2 zacznie budować immutable snapshoty.

### Implementacja

- `this` i `this#k` są rozpoznawane wyłącznie jako wartości pola `blueId`.
  Zwykłe stringi `this` / `this#1` w `value`, listach i polach obiektu są
  treścią.
- `StorageShapeValidator.validateStorageShape()` waliduje pełną rozłączność
  payload kinds i odrzuca dokumentowe `properties`.
- `MergeReverser` zna root node i zachowuje root instance `name` /
  `description`, nawet gdy są równe typowi.
- `Blue.resolve(node, limits, options)` przyjmuje `sourceSemanticBlueId`, ale
  nie liczy go sam dla path-limited resolve. Exact root `{ blueId }` jest jedynym
  tanim automatycznym źródłem metadata.
- `ResolvedBlueNode.getMinimalNode()` / `getMinimalBlueId()` nie omijają guardu
  dla path-limited tree.
- Trusted minimal storage hash pozostaje wewnętrzną ścieżką storage. Benchmark
  minimal-shaped authoring input używa jawnej nazwy
  `public-semantic-id-on-minimal-shaped-authoring`, żeby nie udawać trusted
  storage path.

### Testy

- Self-reference: zwykłe scalar/list stringi `this` i `this#1` zostają treścią;
  `blueId: this` i `blueId: this#k` są odrzucane poza Phase 3.
- Storage shape: reject `blueId + payload`, `value + items`, `value + child`,
  `items + child`, oraz literalne `properties`; allow reserved metadata
  `schema`, `mergePolicy`, `contracts`.
- Minimizer: root `name` / `description` roundtripują, path-limited minimalizacja
  wymaga source identity, cached resolved type mutation nie przecieka do
  kolejnych resolve.

### Exit criteria

- Wszystkie testy `language` przechodzą pod nowym strict storage contract.
- Benchmark minimal-shaped input nie udaje trusted storage path; używa nazwy
  `public-semantic-id-on-minimal-shaped-authoring`.
- `docs/PLAN.md` zawiera aktualne liczby benchmarków dla Phase 1.

---

## Faza 1I — Final language stabilization

### Cel

Zamknąć Phase 1 jako breaking change: normalny provider/storage ingest nie ma
już transitional bypassów, a expansion nie zostawia `blueId + payload` jako
hash input.

### Implementacja

- `SemanticStorageService.preparePreprocessedStorageNode()` zawsze idzie przez
  `minimizeAuthoring() -> hashMinimalTrusted()`.
- Usunięte są `minimizeStorageOverlay()`, `prepareStorageOverlay()`,
  `useTransitionalStoragePath` i wykrywanie legacy inherited-list markerów w
  normalnej ścieżce storage.
- Provider/storage ingest odrzuca `blueId: this` oraz `blueId: this#k` do
  Phase 3.
- `MinimizerOptions` nie wystawia `allowMaterializedReferenceCollapse` ani
  `isTrustedMaterializedReference`.
- `MergeReverser` nie emituje legacy list markerów. PR-1K przenosi
  spec-native list controls do Phase 1, więc full-list overlay nie jest już
  docelowym formatem minimalizacji odziedziczonych list.
- `NodeExtender` rozszerza tylko exact pure references, po materializacji usuwa
  reference `blueId`, i nie flattenuje pierwszego pure reference w zwykłej
  liście.
- `NodeExtender.mergeNodes()` klonuje provider-owned type/items/properties
  przed przypięciem do expanded target, żeby mutacje runtime nie przeciekały do
  provider content.
- `resolve()` nie współdzieli exposed mutable `type` object między siblingami w
  jednym resolved tree.

### Testy

- Ordinary list zaczynająca się od pure `{ blueId }` przechodzi przez semantic
  storage path.
- Provider/storage odrzuca `blueId: this` i `blueId: this#k`.
- `Blue.extend()` zachowuje semantic `BlueId`.
- Mutacja expanded targetu po `Blue.extend()` nie mutuje provider-stored
  content.
- NodeExtender nie flattenuje zwykłej listy zaczynającej się od pure ref.
- Minimizer nie emituje legacy list marker.
- Sibling resolved type mutation nie przecieka w obrębie jednego `resolve()`.

---

## Faza 1J — document-processor integration cleanup

### Cel

Przygotować `document-processor` na Phase 2 snapshots przez usunięcie runtime
zależności od raw `BlueIdCalculator` i spec-invalid fallback repository shape.

### Implementacja

- Test fallback repository content używa plain Blue object shape bez pola
  `properties`.
- Fallback i derived test repositories są kluczowane semantic IDs liczonymi
  przez `seedBlue.calculateBlueIdSync(node)`, a aliases mapują nazwy testowe na
  semantic IDs.
- Zainstalowane `@blue-repository/types` jest reindeksowane w
  `document-processor` przez explicit adapter, który przepisuje content,
  aliases, schemas i metadata na semantic IDs. To nie jest normalny provider
  bypass w `language`.
- Adapter reindeksujący jest migracyjnym bridge'em dla obecnego
  `@blue-repository/types`, które nadal publikuje historyczne/pre-semantic
  storage IDs. Gdy `blue-repository-js` zacznie generować semantic IDs natywnie,
  adapter powinien zostać usunięty albo zawężony do explicit legacy migration
  path.
- Adapter przepisuje zarówno exact IDs, jak i finalne indeksowane fragmenty
  `OLD#i -> NEW#i`.
- `ProcessorEngine.nodeAt(..., '/blueId')` używa wyłącznie wstrzykniętego
  semantic `calculateBlueId`; bez kalkulatora rzuca jawny błąd.
- Runtime event IDs używane przez checkpointing są liczone semantic
  `calculateBlueIdSync(event)`, bez fallbacku do eventowego reference
  `blueId`.
- Operation Request `document` pin zachowuje reference `blueId` jako jawnie
  pinowaną wersję dokumentu; inline payload bez reference używa semantic
  calculatora.
- Test-support i testy DP nie używają raw `BlueIdCalculator`.

### Testy

- Fallback repo ładuje się bez `properties`.
- `/blueId` używa injected semantic calculator.
- Event checkpoint ID używa semantic calculatora.
- Operation Request document pin obsługuje resolved/materialized reference
  oraz inline semantic payload.
- Repository bridge przepisuje `blueId: OLD#1` na `blueId: NEW#1`.
- `document-processor` przechodzi type-check, lint i testy po zmianie identity.

---

## Faza 1K — List control forms

### Cel

Domknąć list identity przed snapshotami: normalny minimal overlay dla
odziedziczonych list używa spec-native `$previous`, `$pos` i `$empty`, bez
legacy first-item markerów i bez tymczasowego full-list overlay jako write path.

### Implementacja

- `ListControls` definiuje internal contract dla:
  - `$previous`: exact first item `{ $previous: { blueId: <itemsListBlueId> } }`,
  - `$pos`: non-negative integer metadata na itemie, tylko dla
    `mergePolicy: positional`,
  - `$empty`: zwykły content, nie metadata.
- `Merger` rozwiązuje list controls w kontekście inherited target list:
  - default `mergePolicy` to `positional`,
  - `append-only` odrzuca `$pos`,
  - `$pos` refinements targetują finalny merged index,
  - duplicate, non-integer i out-of-range `$pos` rzucają jawne błędy,
  - malformed `$previous` nadal jest błędem,
  - stale `$previous` jest zużywane i ignorowane jako nieaktualny optimization
    hint; resolver recompute'uje efektywną listę od aktualnego inherited
    prefixu.
- `MergeReverser` minimalizuje inherited appendy jako `$previous + delta`, a
  positional refinements jako `$previous + $pos`; append-only non-prefix
  mutation rzuca błąd.
- `BlueIdHasher` seeduje list fold z `$previous` dla appendów i odrzuca raw
  `$pos`, bo `$pos` musi zostać skonsumowany przez semantic normalization przed
  hashowaniem.
- Publiczny `Blue.calculateBlueId*` nie traktuje dowolnego authoring inputu z
  `$previous` jako trusted minimal storage; untrusted controls przechodzą przez
  semantic resolve/minimize.
- Uzasadnienie hash path: append-only `$previous` może zacząć fold od BlueId
  poprzedniej listy i kontynuować fold dla nowych elementów. `$pos` nie może
  być policzony z samego BlueId poprzedniej listy, bo podmiana finalnego indeksu
  wymaga materializowanych elementów poprzedniej listy.
- `hashMinimalTrusted` materializuje minimal input z `$pos` przez semantic
  resolve + hash-only minimization bez ponownej emisji controls.
- Path-limited resolve stosuje finalne indeksy dla controls. Gdy `$previous`
  anchor jest obecny, ale inherited prefix nie został zmaterializowany przez
  limit, resolver materializuje append delta bez raw-index filtrowania; to
  zachowuje poprawny wynik kosztem szerszej materializacji delty.

### Testy

- `$previous` append-only minimal ma ten sam semantic `BlueId` co pełna lista.
- Stale `$previous` nie rzuca i nie zatruwa publicznego semantic hash seedem.
- Publiczny semantic BlueId ignoruje niezweryfikowany `$previous` bez
  inherited prefixu.
- Minimizer emituje `$previous`, nie legacy pure-reference marker.
- Zwykły pierwszy item `{ blueId: ... }` pozostaje contentem.
- `$pos` obsługuje positional refinement i appendy w finalnej kolejności.
- Duplicate, non-integer i out-of-range `$pos` rzucają błędy.
- `append-only` odrzuca `$pos`.
- `$previous` nie jako pierwszy item jest rejected.
- `$empty` wpływa na `BlueId` jako zwykły element.
- PathLimits wybierają appendy względem finalnych indeksów listy, nie indeksów
  raw control itemów.

### Exit criteria

- `nx test language` przechodzi z list controls w Phase 1.
- Phase 2 snapshots mogą startować bez planowanego przepisywania list overlay
  po drodze.

---

## Faza 1L — Public API and list-control closure

### Cel

Domknąć ostatnie publiczne i runtime luki po Phase 1K przed startem snapshotów:
semantic identity ma być spójne dla async/sync, resolved/minimal `$pos`,
materialized typed list items, `$empty` exact shape oraz path-limited `$pos`.

### Decyzje

- Top-level utility `calculateBlueId` / `calculateBlueIdSync` z `src/utils`
  są usunięte z publicznych eksportów. Publiczne semantic identity to wyłącznie
  `Blue.calculateBlueId*`; jawny low-level hasher pozostaje jako
  `BlueIdCalculator`.
- `ResolvedBlueNode.getMinimalBlueId()` zostaje tylko jako compatibility shim i
  jest oznaczone jako deprecated. Nowy kod powinien używać
  `blue.calculateBlueIdSync(resolved)`.
- `$previous.blueId` dla minimalizowanych inherited list oznacza semantic
  identity poprzedniego item-prefixu, nie raw hash materialized runtime itemów.

### Implementacja

- `ResolvedBlueNode.getMinimalBlueId()` używa hash-only minimization, więc
  resolved minimal overlay z `$pos` nie trafia raw do `BlueIdHasher`.
- `SemanticIdentityService.calculateBlueId()` używa async odpowiednika
  `hashMinimalTrusted()`, włącznie z `StorageShapeValidator`.
- `MergeReverser` i `Merger` porównują runtime list items przez hash-only
  semantic minimization, żeby typed/materialized items nie dawały raw mismatch.
- `$empty` jest walidowane jako exact item `{ $empty: true }`; malformed
  `$empty` i kombinacje z `$previous` / `$pos` są invalid storage shape.
- Path-limited `$pos` overlays są aplikowane względem finalnych inherited
  indeksów, a dopiero potem wynik jest projektowany do limitu.
- `enrichWithBlueId` używa semantic `Blue.calculateBlueId(...)`.

### Testy

- `getMinimalBlueId()` dla resolved positional `$pos`.
- Async/sync parity dla `$pos`, stale `$previous`, inherited list controls i
  mixed `blueId + payload` validation.
- Semantic `$previous` dla inherited typed/materialized list items.
- Path-limited typed full-list overlay bez fałszywego `Mismatched items`.
- Exact `$empty` validation.
- PathLimits + `$pos` wybiera finalny merged index.

### Exit criteria

- `npx vitest run --config libs/language/vite.config.ts` przechodzi.
- `npx tsc -p libs/document-processor/tsconfig.lib.json --noEmit` przechodzi.
- `npx eslint libs/document-processor --fix` nie zostawia lint errors.
- `nx test document-processor --skip-nx-cache` przechodzi albo ma jawnie
  opisany runtime blocker Nx/Vitest.

---

## Faza 2 — Snapshoty

### Cel

Dostarczyć DP-ready runtime artifact po domknięciu semantic identity i list
controls; direct cycles (`this#k`) nadal zostają poza zakresem Phase 2.

### Implementacja

Dodać:

- `ResolvedSnapshot`
- `FrozenNode` albo frozen `ResolvedBlueNode`
- `blue.resolveToSnapshot(...)`
- `blue.minimize(snapshot)` lub `snapshot.toMinimal()`
- `snapshot.blueId`

Minimum funkcjonalne:

- immutable resolved root,
- lazy cache minimal overlay,
- lazy cache semantic BlueId,
- path index,
- metadata o resolve context.

Wariant docelowy:

- `SnapshotEditor` albo `blue.applyPatch(snapshot, patch)`:
  - copy-on-write tylko po ścieżce,
  - przeliczenie tylko touched subtree + ancestors,
  - nowy snapshot jako wynik.

To ma być gotowe jako baza pod późniejsze zużycie w `document-processor`.

### Pliki

- nowe `src/lib/snapshot/*`
- adaptacja `Blue.ts`
- możliwe odchudzenie `ResolvedNode.ts`

### Testy

- stary snapshot nie zmienia się po patchu,
- nowy snapshot dostaje nowy `BlueId`,
- przeliczana jest tylko ścieżka do korzenia,
- `snapshot.toMinimal()` daje to samo co `blue.minimize(resolvedNode)`,
- `resolveToSnapshot()` i zwykły `resolve()` są semantycznie zgodne.

### Benchmarki

- nowy `snapshot-patch` benchmark,
- porównanie full resolve vs snapshot patch.

### Exit criteria fazy 2

Po tej fazie `language` ma już gotowy runtime artifact, który później może
zostać podłączony w `document-processor`, nawet jeśli `this#k` jest jeszcze
przed finalnym cleanupem.

### Naturalny podział na PR

- PR-2A: snapshot core + freeze
- PR-2B: lazy caches + path index
- PR-2C: patch/update API + benchmark

---

## Faza 3 — Direct cycles i final cleanup

Rozumiem Wasze „#this” jako `this#k` z §11.

### Cel

Domknąć pełną zgodność specyfikacyjną przez direct cyclic sets i usunąć
pozostałe przejściowe semantics.

### Strumień 3A — Direct cycles i `this#k`

#### Implementacja

Zaimplementować §11:

- ZERO sentinel,
- preliminary ids,
- sort lexicographically,
- rewrite do `this#k`,
- MASTER list hash,
- finalne `MASTER#i`.

To zamyka combined BlueId dla direct cycles. ([language.blue][1])

#### Testy

- 2-doc cycle,
- 3-doc cycle,
- stabilność pozycji po sortowaniu preliminary IDs,
- `MASTER#i` zgodne między zapisami,
- provider multi-doc ingest działa poprawnie.

### Strumień 3B — Final cleanup

#### Implementacja

- usunięcie legacy list marker code path,
- usunięcie starych niejawnych skrótów,
- finalizacja docs.

### Exit criteria fazy 3

Po tej fazie `libs/language` jest gotowe do bycia podstawą dla reszty monorepo i do wydania jako major breaking change.

### Naturalny podział na PR

- PR-3A: `this#k` + cyclic BlueIds
- PR-3B: cleanup + docs final

## 4. Przykłady testów integracyjnych

### 1) Semantic `BlueId` jest taki sam dla authoring / resolved / minimal / provider fetch

```ts
it('keeps one semantic BlueId across authoring, resolved, minimal and fetched storage form', () => {
  const provider = new BasicNodeProvider();
  provider.addSingleDocs(`
name: BaseType
a: 1
b: 2
`);

  const baseId = provider.getBlueIdByName('BaseType');
  const blue = new Blue({ nodeProvider: provider });

  const authoring = blue.yamlToNode(`
name: Child
type:
  blueId: ${baseId}
c: 3
`);

  const resolved = blue.resolve(authoring);
  const minimal = blue.minimize(resolved);

  const id1 = blue.calculateBlueIdSync(authoring);
  const id2 = blue.calculateBlueIdSync(resolved);
  const id3 = blue.calculateBlueIdSync(minimal);

  expect(id1).toBe(id2);
  expect(id2).toBe(id3);

  provider.addNode(minimal);
  const fetched = provider.fetchByBlueId(id1)![0];

  expect(blue.calculateBlueIdSync(fetched)).toBe(id1);
  expect(blue.calculateBlueIdSync(blue.resolve(fetched))).toBe(id1);
});
```

### 2) Authoring/storage ingest odrzuca mixed `blueId + payload`

```ts
it('rejects ambiguous blueId + payload in storage ingest', () => {
  const provider = new BasicNodeProvider();

  expect(() =>
    provider.addSingleDocs(`
name: BadDoc
x:
  blueId: SomeBlueId
  value: 1
`),
  ).toThrow(/ambiguous blueId/i);
});
```

### 3) Snapshot jest immutable i robi path-local rehash

```ts
it('creates a new immutable snapshot and rehashes only the touched path', () => {
  const blue = new Blue({ nodeProvider: new BasicNodeProvider() });

  const snap1 = blue.resolveToSnapshot(
    blue.yamlToNode(`
order:
  price: 10
  status: created
`),
  );

  const result = blue.applyPatch(snap1, {
    op: 'replace',
    path: '/order/price',
    value: 11,
  });

  const snap2 = result.snapshot;

  expect(snap2.blueId).not.toBe(snap1.blueId);
  expect(blue.get(snap1.resolvedRoot, '/order/price')?.getValue()).toBe(10);
  expect(blue.get(snap2.resolvedRoot, '/order/price')?.getValue()).toBe(11);

  expect(result.metrics.rehashedPointers).toEqual(['/order/price', '/order', '/']);
});
```

### 4) `$previous` daje ten sam `BlueId` co pełna materializacja

```ts
it('gives the same BlueId for append-only list via $previous and full list', () => {
  const blue = new Blue({ nodeProvider: new BasicNodeProvider() });

  const parent = blue.yamlToNode(`
entries:
  type: List
  mergePolicy: append-only
  items: [A, B]
`);

  const prevId = blue.calculateBlueIdSync(
    (blue.get(parent, '/entries') as BlueNode).getItems() ?? [],
  );

  const delta = blue.yamlToNode(`
entries:
  type: List
  mergePolicy: append-only
  items:
    - $previous: { blueId: ${prevId} }
    - C
`);

  const full = blue.yamlToNode(`
entries:
  type: List
  mergePolicy: append-only
  items: [A, B, C]
`);

  expect(blue.calculateBlueIdSync(delta)).toBe(blue.calculateBlueIdSync(full));
});
```

### 5) `this#k` daje stabilny combined BlueId dla direct cycle

```ts
it('assigns stable MASTER#i BlueIds for a direct cyclic set', () => {
  const provider = new BasicNodeProvider();
  const blue = new Blue({ nodeProvider: provider });

  provider.addSingleDocs(`
- name: Person
  pet:
    type: { blueId: this#1 }

- name: Dog
  owner:
    type: { blueId: this#0 }
  breed:
    type: Text
`);

  const person = provider.getNodeByName('Person');
  const dog = provider.getNodeByName('Dog');

  const personId = blue.calculateBlueIdSync(person);
  const dogId = blue.calculateBlueIdSync(dog);

  expect(personId.split('#')[0]).toBe(dogId.split('#')[0]);
  expect(personId).toMatch(/#1$|#0$/);
  expect(dogId).toMatch(/#1$|#0$/);
});
```

## 5. Twarde Definition of Done

### Exit DoD dla fazy 1

- `Blue.calculateBlueId*` zwraca ten sam wynik dla authoring, resolved i minimal
  dla dokumentów niecyklicznych, w tym spec-native list control forms.
- `PathLimits` nie zmieniają `BlueId`.
- expansion nie zmienia `BlueId`.
- pure-ref short-circuit działa tylko dla exact `{ blueId }`.
- `[] != absent`, `[A] != A`, `[[A,B],C] != [A,B,C]`.
- providerzy zapisują minimal overlay keyed by semantic `BlueId`.
- normalny provider/storage path nie używa `minimizeStorageOverlay` ani legacy
  inherited-list marker.
- `Blue.extend()` / `NodeExtender` expansion zachowuje semantic `BlueId` i nie
  zostawia `blueId + payload` jako hash input.
- `document-processor` runtime nie fallbackuje do raw `BlueIdCalculator`.
- storage ingest odrzuca mixed `blueId + payload` jako authoring/minimal input.
- `NodeToMapListOrValue` nie bierze już udziału w hash path.
  Te warunki są bezpośrednio zgodne z §8–§10 i §12, z wyjątkiem direct cyclic
  sets, które świadomie odkładamy do fazy 3. ([language.blue][1])

### Exit DoD dla fazy 2

- `resolveToSnapshot()` istnieje i daje immutable/frozen runtime artifact.
- `snapshot.toMinimal()` i `blue.minimize(resolved)` są semantycznie zgodne.
- `snapshot.blueId` jest semantic `BlueId`.
- patch po ścieżce nie robi full-tree re-resolve.
- benchmark `snapshot-patch` pokazuje lokalny rehash zamiast pełnego przebiegu.
- stary snapshot nigdy nie zmienia się po commitcie nowego.
  To jest spójne z tym, że resolve ma kończyć się sfinalizowanym snapshotem, a limity nie mogą wpływać na identity. ([language.blue][1])

### Finalne DoD dla `libs/language`

- `canonical` nie jest używane na minimal overlay form; terminologia w kodzie i docs jest spójna.
- official/wrapped form, minimal overlay form, resolved snapshot i semantic `BlueId` są jednoznacznie rozdzielone.
- providerzy i `NodeContentHandler` operują na minimal-first storage.
- `Merger` / minimizer / hasher obsługują `$previous`, `$pos`, `$empty`.
- write path nie emituje legacy list marker.
- direct cyclic sets obsługują `this#k`, MASTER i finalne `MASTER#i`.
- `nx test language` przechodzi w całości.
- benchmark `calculate-blue-id` i `resolve` nie mają regresji > 10% na baseline ogólnym.
- append-only list case jest wyraźnie szybszy niż baseline.
- README, `docs/blue-id.md`, `docs/resolve.md`, ADR-y i glossary są zgodne z nową semantyką.
  To zamyka pełną zgodność z aktualną specyfikacją identity, minimization, list hashing i direct cycles. ([language.blue][1])

Ten układ uważam za najlepszy pod Wasz cel: **najpierw naprawić tożsamość i storage, potem dołożyć runtime snapshots dla `document-processor`, a dopiero potem domknąć specjalne formy list i cykle**.

[1]: https://language.blue/docs/reference/specification 'Blue Language Specification — language.blue docs'
