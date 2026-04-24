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
- dopiero na końcu domykamy spec-native list forms i bezpośrednie cykle `this#k`. Listy i cykle są ważne, ale nie powinny blokować uporządkowania identity i snapshotów. Spec faktycznie definiuje `$previous`, `$pos`, `$empty` oraz `this#k`, ale to są osobne, końcowe ścieżki konformacyjno-optymalizacyjne. ([language.blue][1])

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

Status after implementing the 1E/1F/1G stabilization block and the strict
provider cleanup: semantic storage is now the only provider ingest path.
Provider ingest either stores minimal content under its semantic `BlueId` or
fails immediately.

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
- Multi-doc direct cycles using `this#k` are explicitly rejected until Phase 3.
  Single-doc `this` remains supported.
- `SemanticIdentityService` has separate internal paths:
  `minimizeResolved()`, `minimizeAuthoring()`, and `hashMinimalTrusted()`.
- The minimizer no longer collapses every `blueId + payload` node to
  `{ blueId }`. Collapse is allowed only for trusted materialization paths or
  after confirming that the payload matches known provider content.
- Resolved/runtime nodes carry the minimum completeness metadata:
  `completeness: 'full' | 'path-limited'`, `sourceSemanticBlueId`, and optional
  `expandedFromBlueId`.
- `resolve()` now has caches for type overlays, node hashes, list hashes,
  subtype checks, and provider fetches per `blueId`; the per-typed-node clone of
  the resolved type overlay was removed.
- `calculateBlueId` is treated as a low-level hash benchmark, while the separate
  semantic API benchmark covers authoring, resolved, trusted minimal, and
  provider ingest cases.
- `snapshot-patch` remains a `patch-then-full-resolve` benchmark until Phase 2.
- Resolver-invalid tests use direct/raw test providers instead of relying on
  provider fallback to ingest invalid content.

### Verification run

- `nx tsc language --skip-nx-cache` — passed.
- `nx lint language` — passed.
- `nx build language --skip-nx-cache` — passed.
- `nx test language --skip-nx-cache` — passed.
- `BENCH_COMPARE_BASELINE=1 node scripts/benchmark/resolve.mjs`:
  shared type case passed the regression limit.
- `BENCH_COMPARE_BASELINE=1 BENCH_TYPE_MODE=unique node scripts/benchmark/resolve.mjs`:
  unique type case passed the regression limit.
- `node scripts/benchmark/semanticBlueId.mjs` — passed.

### Deliberate transitional behavior

1. **Legacy list marker storage overlay.** The storage service still has an
   explicit transitional path for inherited lists that use the legacy
   marker-shaped first item. This is not a resolve-error fallback and should be
   removed in Phase 3 when lists move to `$previous`, `$pos`, and `$empty`.
2. **Path-limited list marker behavior.** Partial materialization must not
   pretend to be a full resolved snapshot or become a normal hash source without
   `sourceSemanticBlueId`. Inherited lists that rely on the legacy marker remain
   transitional until Phase 3 replaces them with spec-native `$previous`, `$pos`,
   and `$empty`.
3. **External Blue Repository Types.** The installed `@blue-repository/types`
   package still uses historical/pre-semantic storage keys. Characterization
   tests that consume that package are skipped until the package is reindexed to
   semantic IDs.

### Decisions before Phase 2

- When to migrate Blue Repository Types to semantic IDs. The strict provider
  path does not include a dual-index/alias period.
- Whether path-limited nodes need a stronger public contract now, or should
  remain internal metadata until snapshots.
- Whether to remove the legacy list marker storage overlay before snapshots, or
  keep it until the Phase 3 list-control cleanup.

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
- Memoizować hashe elementów list używane przy porównaniu prefixów i
  inherited-list markerów.
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
- `blue.hashMinimalTrusted(minimalNode)` jako `validateStorageShape -> low-level hash`

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
  - `sourceSemanticBlueId?: string`,
  - `expandedFromBlueId?: string` albo równoważny trusted expansion marker.

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

## Faza 2 — Snapshoty

### Cel

Dostarczyć DP-ready runtime artifact bez czekania na końcową fazę list/cykli.

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

To nie musi jeszcze mieć finalnych list spec-native, ale ma już być gotowe jako baza pod późniejsze zużycie w `document-processor`.

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

Po tej fazie `language` ma już gotowy runtime artifact, który później może zostać podłączony w `document-processor`, nawet jeśli listy i `this#k` są jeszcze przed finalnym cleanupem.

### Naturalny podział na PR

- PR-2A: snapshot core + freeze
- PR-2B: lazy caches + path index
- PR-2C: patch/update API + benchmark

---

## Faza 3 — Spec-native listy + `this#k`

Rozumiem Wasze „#this” jako `this#k` z §11.

### Cel

Domknąć pełną zgodność specyfikacyjną i usunąć przejściowe legacy semantics.

### Strumień 3A — List control forms

#### Implementacja

`Merger`, minimizer i hasher przechodzą na:

- `$previous`,
- `$pos`,
- `$empty`.

Znika legacy marker:

- „pierwszy item = `{ blueId: prefixId }`”.

Write path nigdy go już nie emituje. Read path może chwilowo mieć shim migracyjny, ale tylko w czasie developmentu; finalnie go usuwamy. Spec wyraźnie definiuje zarówno dozwolone formy, jak i dokładne zachowanie list hashingu oraz merge policy. ([language.blue][1])

#### Testy

- `$previous` tylko jako pierwszy element,
- `$previous` ignorowany przy zmienionym prefixie,
- append-only: `$pos` = error,
- positional: duplicate/out-of-range = error,
- `$empty` zostaje contentem i wpływa na `BlueId`. ([language.blue][1])

### Strumień 3B — Direct cycles i `this#k`

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

### Strumień 3C — Final cleanup

#### Implementacja

- usunięcie legacy list marker code path,
- usunięcie starych niejawnych skrótów,
- finalizacja docs.

### Exit criteria fazy 3

Po tej fazie `libs/language` jest gotowe do bycia podstawą dla reszty monorepo i do wydania jako major breaking change.

### Naturalny podział na PR

- PR-3A: list control forms
- PR-3B: `this#k` + cyclic BlueIds
- PR-3C: cleanup + docs final

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

  const prevId = blue.calculateBlueIdSync(blue.get(parent, '/entries') as BlueNode);

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

- `Blue.calculateBlueId*` zwraca ten sam wynik dla authoring, resolved i minimal dla dokumentów niecyklicznych i bez spec-native list control forms.
- `PathLimits` nie zmieniają `BlueId`.
- expansion nie zmienia `BlueId`.
- pure-ref short-circuit działa tylko dla exact `{ blueId }`.
- `[] != absent`, `[A] != A`, `[[A,B],C] != [A,B,C]`.
- providerzy zapisują minimal overlay keyed by semantic `BlueId`.
- storage ingest odrzuca mixed `blueId + payload` jako authoring/minimal input.
- `NodeToMapListOrValue` nie bierze już udziału w hash path.
  Te warunki są bezpośrednio zgodne z §8–§10 i §12, z wyjątkiem końcowej obsługi spec-native lists/cycles, które świadomie odkładamy do fazy 3. ([language.blue][1])

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
