# Plan refaktoryzacji krok po kroku

## Krok 0 — Zrób powtarzalny benchmark `resolve` (baseline)

**Status:** ✅ Zrealizowane (dodany benchmark `resolve` i target `benchmark:resolve`).

**Cel:** mieć stały sposób porównywania “przed/po” bez zgadywania.

### Co dodać

1. Nowy skrypt: `libs/language/scripts/benchmark/resolve.mjs`
2. Nowy target w `libs/language/project.json`, np.:
   - `benchmark:resolve` (podobnie jak `benchmark:calculate-blue-id`)

### Jak benchmarkować sensownie

- Zbuduj dokument o kontrolowanej wielkości:
  - dużo pól w obiekcie (testuje najgorszy przypadek `mergeProperty`)
  - dużo elementów listy (testuje `mergeChildren`)
  - dużo węzłów z tym samym `type.blueId` (testuje powtarzalną rezolucję typów)

**Bardzo przydatne:** policz liczbę wywołań `clone()` w trakcie `resolve`.
W benchmarku możesz zrobić “monkey patch”:

- zachowujesz oryginał `BlueNode.prototype.clone`
- podmieniasz na wrapper, który inkrementuje licznik i deleguje do oryginału

Wynik benchmarku powinien wypisywać:

- czas (avg/min/max z kilku iteracji)
- licznik `clone()` (to jest często najlepszy “proxy” na realny koszt)

✅ Ten krok niczego nie zmienia w logice — tylko daje Ci narzędzie do pomiaru.

---

## Krok 1 — Usuń O(n²) w `mergeChildren` (indexOf w pętli)

**Cel:** szybka wygrana, bez ryzyka semantycznego.

### Gdzie

`libs/language/src/lib/merge/Merger.ts` → `mergeChildren()`

### Co zmienić

Zamiast:

```ts
.map((child) => {
  limits.enterPathSegment(String(sourceChildren.indexOf(child)), child);
  ...
})
```

zrób pętlę `for (let i=0; i<sourceChildren.length; i++)` i używaj `i` jako indeksu (to był sens `indexOf`).

### Jak zweryfikować

- testy jednostkowe
- benchmark z dużą listą (np. 10k elementów) pokaże spadek czasu + mniej CPU

✅ To jest w 100% bezpieczne i warto zrobić od razu.

---

## Krok 2 — Dodaj tani klon: `BlueNode.cloneShallow()` (bez deep rekurencji)

**Status:** ✅ Zrealizowane (dodana metoda `cloneShallow()` i testy semantyki shallow w `Node.test.ts`).

**Cel:** móc zastępować “deep clone do ustawienia jednego pola”.

### Gdzie

`libs/language/src/lib/model/Node.ts`

### Proponowana semantyka

- kopiuje pola prymitywne (name/description/value/blueId/inlineValue)
- **nie klonuje rekurencyjnie** dzieci (type/itemType/… oraz items/properties)
  tylko je **referencjonuje** lub (lepiej) robi _shallow copy_ kontenerów:
  - `items: this.items ? [...this.items] : undefined`
  - `properties: this.properties ? { ...this.properties } : undefined`
  - `type/itemType/...`: referencja (nie deep clone)

To daje dobrą równowagę:

- zmiana mapy/array w klonie nie modyfikuje oryginału
- dzieci (BlueNode) są współdzielone — to jest “świadomie shallow”

### Jak zweryfikować

Dodaj testy w `libs/language/src/lib/model/__tests__/Node.test.ts`:

- `cloneShallow` zwraca nowe `items/properties` (inne referencje)
- ale wartości children w `items/properties` są te same referencje (bo shallow)

✅ Dodanie nowej metody jest niebreaking.

---

## Krok 3 — Zamień “deep clone do ustawienia jednego pola” na `cloneShallow`

**Status:** ✅ Zrealizowane (`Merger.ts` i procesory merge używają `cloneShallow()` w ścieżkach top-level update).

**Cel:** zbić koszty w wielu miejscach bez dużej przebudowy.

### 3A. Merger.merge: uniknij deep clone source przy podmianie type

**Gdzie**
`Merger.merge()`:

Zamiast:

```ts
const sourceWithResolvedType = source.clone().setType(resolvedType);
```

zrób:

```ts
const sourceWithResolvedType = source.cloneShallow().setType(resolvedType);
```

### 3B. mergeObject: ustawianie blueId bez deep clone

Zamiast:

```ts
newTarget = newTarget.clone().setBlueId(source.getBlueId());
```

zrób:

```ts
newTarget = newTarget.cloneShallow().setBlueId(source.getBlueId());
```

### 3C. mergeChildren: returny przez cloneShallow

Zamiast:

```ts
return target.clone().setItems(filteredChildren);
```

zrób:

```ts
return target.cloneShallow().setItems(filteredChildren);
```

### 3D. Procesory merge’ujące: cloneShallow zamiast clone

W procesorach z `libs/language/src/lib/merge/processors/*` (np. `ValuePropagator`, `TypeAssigner`, `ListProcessor`, `DictionaryProcessor`, `MetadataPropagator`) zamień:

- `target.clone()` → `target.cloneShallow()`

**Uwaga praktyczna:** te procesory zmieniają tylko top-level pola (`value/type/...`), więc deep clone jest tu prawie zawsze przepalaniem CPU.

### Jak zweryfikować

- pełne testy `vitest`
- benchmark: powinieneś zobaczyć spadek liczby `clone()` (deep) i czasu

✅ Ten krok daje duży zysk przy minimalnym ryzyku.

---

## Krok 4 — Największy zysk: przebuduj merge properties tak, by nie klonować targeta dla każdego pola

**Cel:** zdjąć O(n²) na obiektach z dużą liczbą properties (to jest zwykle “killer”).

### Problem dziś

`mergeObject()` robi:

- iteracja po properties
- dla każdego key: `newTarget = mergeProperty(newTarget, ...)`
- a `mergeProperty` robi `target.clone()` deep → koszmar

### Docelowa zmiana

Zamiast per-property klonowania całego targeta:

- zrób **jedno** przygotowanie mapy properties
- modyfikuj lokalną mapę
- na końcu ustaw ją na `newTarget` przez **jedno** `cloneShallow()`

### Proponowany kierunek refaktoru

1. W `mergeObject()` zastąp pętlę po properties wywołaniem:
   - `newTarget = this.mergeProperties(newTarget, properties, limits);`

2. Zaimplementuj:
   - `private mergeProperties(target: BlueNode, sourceProps: Record<string, BlueNode>, limits: Limits): BlueNode`

Logika:

- `const baseProps = target.getProperties() ?? {};`
- `let outProps = baseProps;`
- `let changed = false;`
- iterujesz po `Object.entries(sourceProps)`
  - jeśli segment nie dozwolony: continue
  - resolvedValue = (value.isResolved ? value : this.resolve(value))
  - existing = outProps[key]
  - merged = existing ? this.mergeObject(existing, resolvedValue, limits) : resolvedValue
  - jeśli `!changed` i musisz zmienić: `outProps = { ...baseProps }` (copy-on-write)
  - `outProps[key] = merged`

Na końcu:

- jeśli `!changed` → `return target`
- else → `return target.cloneShallow().setProperties(outProps)`

3. `mergeProperty()` może stać się helperem zwracającym tylko wartość, albo zostać usunięty.

### Kluczowy detal bezpieczeństwa

Żeby nie “mutować” istniejących węzłów przez przypadek:

- upewnij się, że `mergeObject()` nie mutuje wejściowego `target` (patrz Krok 4.5 poniżej)

### 4.5 (ważne!) — odizoluj `target` przed `mergingProcessor.process`

W `mergeObject()` rozważ zmianę:

```ts
let newTarget = this.mergingProcessor.process(target, source, provider);
```

na:

```ts
const working = target.cloneShallow();
let newTarget = this.mergingProcessor.process(working, source, provider);
```

To daje Ci gwarancję, że nawet jeśli ktoś ma custom `MergingProcessor` który mutuje target in-place, nie rozwalisz “shared references”.

### Jak zweryfikować

- wszystkie testy
- benchmark z obiektem np. 5k/10k pól → tu zwykle widać największy skok

✅ To jest krok, który najczęściej zmienia “resolve jest nieużywalny na dużych docach” w “jest OK”.

---

## Krok 5 — Uporządkuj merge items analogicznie (bez zbędnych klonów + bez `resolve` jeśli już resolved)

**Cel:** zejść z kosztów na listach i uniknąć podwójnej pracy.

### Co zrobić

1. W `mergeChildren()`:
   - zrób iterację `for` (już po kroku 1)
   - przy tworzeniu wyniku użyj `cloneShallow()`

2. Dodaj “fast path” dla już-resolved:
   - jeżeli `child.isResolved()` → nie wołaj `this.resolve(child, limits)`

### Jak zweryfikować

- benchmark z dużą listą węzłów
- testy integracyjne

---

## Krok 6 — Fast path globalny: jeśli node już jest `ResolvedBlueNode`, nie rezolwuj go drugi raz w głąb

**Cel:** przyspieszyć przypadki typu:

- `resolve` na dokumencie, w którym część subdrzew już jest resolved
- merge typów, które już są resolved (po cache’owaniu typów w kolejnym kroku)

### Minimalna zmiana

W miejscach, gdzie robisz:

- `this.resolve(sourceValue, limits)`
  zamień na:
- `sourceValue.isResolved() ? (sourceValue as ResolvedBlueNode) : this.resolve(sourceValue, limits)`

W 2 miejscach:

- `mergeProperty`
- `mergeChildren`

✅ To nie zmienia wyniku, tylko unika zbędnej rekurencji.

---

## Krok 7 — Cache resolved typów w obrębie jednego `resolve()` (duży zysk na dokumentach z powtarzalnymi typami)

**Cel:** jeśli dokument ma 1000 węzłów `type.blueId = X`, to typ `X` powinien zostać zrezolwowany **raz**, a nie 1000 razy.

### Jak to zrobić bez ryzykownej zmiany API

1. Dodaj wewnętrzny kontekst rezolucji (np. `ResolutionContext`) w `merge/`:
   - `limits`
   - `nodeProvider`
   - `resolvedTypeCache: Map<string, ResolvedBlueNode>`
   - `pathStack: string[]` (żeby uwzględnić PathLimits w cache key)

2. Cache key:
   - minimum: `typeBlueId`
   - bezpieczniej: `typeBlueId + '|' + currentPointer`
     gdzie `currentPointer` budujesz z `pathStack`, utrzymując go równolegle do `limits.enter/exit`.

3. W `merge()`:
   - jeśli `source.getType()?.getBlueId()` jest non-null:
     - sprawdź cache
     - jeśli brak:
       - clone type ref node
       - `NodeExtender.extend(...)`
       - `resolvedType = this.resolve(clonedTypeNode, limits)`
       - zapisz do cache

4. **Nie rób ponownie `this.merge(newTarget, clonedTypeNode, limits)`** (to jest druga, droga ścieżka!)
   Zamiast tego:
   - weź “ciało typu” z resolvedType, ale bez wpływu na type samego noda:
     - `typeOverlay = resolvedType.cloneShallow().setType(undefined)`
       (opcjonalnie też `.setBlueId(undefined)` żeby nie robić zbędnego set/clear)

   - `newTarget = this.mergeObject(newTarget, typeOverlay, limits)`
   - potem `sourceWithResolvedType = source.cloneShallow().setType(resolvedType)`
   - i `return this.mergeObject(newTarget, sourceWithResolvedType, limits)`

To eliminuje ponowną rezolucję supertypów i powtarzalne extendy.

### Jak zweryfikować

- benchmark: dokument z 10k elementów o tym samym typie
- licznik `clone()` powinien spaść dramatycznie, czas także

---

## Krok 8 — (Opcjonalnie) cache BlueIdCalculator / isSubtype na czas jednego resolve

**Cel:** zbić koszty walidacji typu w `TypeAssigner` i checków list.

Dwa proste cache:

1. `WeakMap<BlueNode, string>` dla `BlueIdCalculator.calculateBlueIdSync(node)`
   (w obrębie jednego resolve, bo obiekty są te same)
2. `Map<string, boolean>` dla par `(subtypeBlueId, supertypeBlueId)` w `NodeTypes.isSubtype`

To jest zwykle “ostatnie 20%” zysku po usunięciu deep clone O(n²).

---

# Co bym zrobił _od zera_ (zostawiam jako zajawka do v4.0)

Skoro chcesz to w kolejnym majorze, to tylko w punktach:

- wprowadziłbym **niemutowalny model** (albo copy-on-write) i **structural sharing**
- resolve byłby **kompilowany do planu** (np. “type overlay + patch”), a nie robił deep clone’ów
- typy byłyby **internowane** (współdzielone i traktowane jako immutable)
- `resolve` miałby tryb **lazy** (rezolucja poddrzewa dopiero gdy jest potrzebne)

Ale to jest faktycznie “v4”.

---

# Podsumowanie: kolejność, która daje najszybszy efekt

Jeśli chcesz maksymalny zysk jak najszybciej, robiłbym dokładnie tak:

1. **Krok 0** benchmark + licznik clone
2. **Krok 1** fix `mergeChildren indexOf`
3. **Krok 4** przebudowa merge properties (to zwykle największy win)
4. **Krok 2+3** `cloneShallow` + podmiany w kluczowych miejscach
5. **Krok 6** fast path “już resolved”
6. **Krok 7** cache typów (mega win przy powtarzalnych typach)

Jeśli chcesz, mogę Ci też dopisać **konkretny szkic patchy** (diff-podobny) dla kroków 1–4, żebyś mógł praktycznie kopiować fragmenty do repo.
