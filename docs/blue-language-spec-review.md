# Blue Language Spec Review

THIS FILE WAS CREATED BASED ON: https://chatgpt.com/s/t_6992eef302e88191ab6ba7b042e43b3c

Below is a concrete **end-to-end** plan that takes everything you raised into account:

- **semantic `blueId`** (equivalence is defined by the resolved meaning, not authoring noise)
- **fast processing** (tons of events, tiny state diffs, no full re-resolve each time)
- **dynamic type generalization** (processor never emits an illegal snapshot)
- **huge resolved documents** (avoid storing/transmitting "type-expanded explosions" like the webhook payload you attached)
- and you explicitly said **no backward-compat concerns**, so we can simplify a lot and fix some fundamental issues cleanly

I'm going to:

1. explain the target end state
2. critique what's wrong today (with precise references)
3. propose the best architecture (canonical vs. resolved views + immutable snapshots)
4. give a step-by-step implementation plan aligned to your code
5. show multiple code snippets: ingest/resolve, patch+generalize, store, compute `blueId`, and transport

## Where we should end up

### 1) Two representations, one identity

#### A. Canonical form (minimized / overlay form)

- Small, stable, and hashable **without fetching types** (strong Merkle behavior)
- Contains:
  - data overrides
  - references to types (and other nodes) using `{ blueId: ... }`
- This is the **only** thing you store as "the document" and use for `blueId`

#### B. Runtime resolved view (type-linked, type-sound)

What the processor executes on: it must be "fully resolved" in the sense that type hierarchies are available in-memory, but it does **not** need to physically inline everything into every node.

It's best implemented as an **immutable snapshot** that:

- shares type objects (structural sharing)
- supports cheap lookups
- supports cheap updates (copy-on-write along a path)
- supports cheap conformance checks + generalization

> **Identity rule (the key decision):**
>
> Document `blueId = hash(canonical minimized form)`  
> not `hash(fully expanded resolved tree)`.

This is how you get both:

- "equivalent resolved meaning ⇒ same id"
- and "Merkle verification from the document alone" (because canonical form references type `blueId`s rather than embedding full type bodies)

This matches your own bullet: _"Stronger Merkle behavior: minimized form largely references type blueIds instead of inlining inherited content."_

## What's wrong today (and why it matters)

### Today `blueId` hashing is "pre-resolution" and over-trusts embedded `blueId`

You already documented this, and the code confirms it:

- `Blue.calculateBlueId(node)` directly calls `BlueIdCalculator.calculateBlueId(node)` without resolving
- `NodeContentHandler.parseAndCalculateBlueId(...)` preprocesses only, then hashes; no merge/resolve step

So: authoring-time noise and redundancy changes the id.

### The bigger correctness issue: `blueId` short-circuit is too permissive

- `NodeToMapListOrValue` includes `blueId` whenever `node.getBlueId() != null`
- `BlueIdCalculator.calculateMap(...)` returns that value immediately if the map contains `blueId`

That means **any object with a `blueId` field becomes "identity-by-assertion"**, even if it also contains other content. This is the single biggest semantic footgun in the current implementation.

### Empty lists are effectively erased

- `cleanStructure` returns `null` for empty lists, so "empty list" hashes like "field absent"

That's not just a spec nuance — it breaks "meaning preservation" in common cases.

### Your webhook payload shows the practical pain

The attached webhook JSON contains a massive resolved document with deeply expanded type structures and many embedded `blueId` fields (inside large type objects, not just reference stubs).

It demonstrates exactly why you don't want to store/ship "fully inlined resolved" as the canonical artifact.

## Best overall strategy for fast processing

### The winning combination

1. Canonical minimized form is the stored form and hashed form.
2. Resolved runtime snapshot is immutable and uses structural sharing.
3. Updates are patch-based, path-local, and always run "generalize-until-conforms" from the changed path up to the root.
4. `blueId` is updated incrementally (Merkle) along the changed path, not recomputed over the whole tree.
5. Transport/webhooks default to canonical + optional bundle, not giant resolved expansions.

This gives you:

- `O(depth + changed_subtree)` per update (usually tiny)
- stable semantic ids
- no repeated full resolve
- safe caching of resolved types across all docs
- much smaller state storage / network payloads

## Concrete design

### 1) Split `referenceBlueId` vs `computedBlueId`

Right now `Node.blueId` is overloaded: sometimes it's a reference, sometimes it behaves like "the node's own id."

You want to make it unambiguous:

- `referenceBlueId`: the serialized `"blueId"` field in user-facing documents, meaning "this node is a reference" (or a type reference)
- `computedBlueId`: internal cached hash for snapshots; never serialized as `"blueId"`

This is exactly what the Codex plan is aiming for — and it's the right call.

#### Important tightening (because you don't need backward compat)

In canonical authoring/canonical storage:

- a `{blueId: ...}` node is **reference-only**; no other keys allowed
- any computed/hash value must be in a sidecar index or a different field name in debug output

That single rule eliminates the `blueId` short-circuit ambiguity.

### 2) Immutable snapshot type: `ResolvedSnapshot`

You want an immutable structure because it enables:

- safe structural sharing of resolved type trees across documents
- cheap copy-on-write updates for patches
- cached per-node hashes that never go stale due to mutation
- concurrency safety (big if you process many docs in parallel)

Recommended snapshot contents:

```java
public record ResolvedSnapshot(
    FrozenNode canonicalRoot,   // minimized overlay, hash source of truth
    FrozenNode resolvedRoot,    // runtime view (type-linked), structural sharing
    String blueId,              // == canonicalRoot.hash()
    BlueIdIndex blueIdsByPtr,   // optional: pointer -> hash (fast diffs/caches)
    PathIndex pathIndex         // optional: pointer -> node (fast lookup)
) {}
```

Where:

- `FrozenNode` is an immutable node with persistent maps/vectors and cached hash
- `blueId` is always the `canonicalRoot` hash

### 3) Resolution approach: "link types" rather than "inline-everything"

Instead of producing gigantic inlined structures, the resolved runtime tree should:

- keep the node's own overrides
- point `node.type` to a cached resolved type object
- allow property lookup to fall back to the type chain if missing

That yields a "fully resolved in-memory view" without materializing a massive tree.

You can still materialize the fully merged tree for debugging/export, but you don't store it.

### 4) Minimization becomes cheap and incremental

If your canonical form is the persisted form, minimization is not a heavy end-of-pipeline step; it becomes:

- when applying a patch, decide whether the patch creates an override or is redundant
- remove redundant overrides immediately
- only touch the patched path (and ancestors if types generalized)

That's exactly aligned with your "minimizing isn't expensive; it's basically remove if equal to parent" — but you do it locally, not by scanning the entire doc every time.

## Updated hashing: spec-correct Merkle and incremental-friendly

### Required changes to the hashing algorithm

#### 1. Short-circuit only for pure reference nodes

- Only if the canonical node is exactly `{ "blueId": "..." }`
- Not "contains `blueId` anywhere" (current behavior)

#### 2. Preserve empty lists

- Empty list must hash differently from absent
- Current `cleanStructure` collapses empty lists to `null`

#### 3. Use domain separation for list folding

Your current list hashing is a recursive rolling pair; it's deterministic, but doesn't support "cheap append" unless you treat it as fold state, and it currently can't represent empty list at all.

Switch to an explicit fold with a seed.

#### 4. Canonical JSON of primitives

Avoid `toString()` hashing for primitives (it's brittle). Hash canonical JSON bytes of the scalar.

### Incremental hashing

Because the canonical form is Merkle-ish ("children hashes embedded"), patching a leaf can update only:

- the leaf node hash
- its parent hash
- up to root

That's `O(depth)`.

## Implementation plan, aligned to your code

I'll keep the plan in the "minimal code surface" spirit, but I'll tighten a few decisions since we can break things.

### Phase 1 — Make `blueId` unambiguous and fix hashing correctness

#### 1.1 `Node.java`: split reference vs computed

Currently `Node` has `private String blueId;`

Change to:

```java
public class Node {
  // serialized field "blueId" (reference only)
  private String referenceBlueId;

  // internal cache, never serialized as "blueId"
  private transient String computedBlueId;

  public String blueId() { return referenceBlueId; }
  public Node blueId(String ref) { this.referenceBlueId = ref; return this; }

  public String computedBlueId() { return computedBlueId; }
  public Node computedBlueId(String id) { this.computedBlueId = id; return this; }

  public boolean isReferenceOnly() {
    return referenceBlueId != null
      && name == null && description == null && type == null
      && itemType == null && keyType == null && valueType == null
      && value == null && (items == null || items.isEmpty())
      && (properties == null || properties.isEmpty())
      && constraints == null && blue == null;
  }
}
```

#### 1.2 `NodeDeserializer`: enforce "reference-only `blueId`"

Right now it accepts `"blueId"` as just another field.

Change rule:

- If object contains `"blueId"`, it must be the only key in that object (for canonical docs)
- Otherwise: reject (or parse into a special debug structure, but do not treat it as `referenceBlueId`)

This eliminates the "`blueId` short-circuit hides overrides" pitfall.

#### 1.3 Rewrite `BlueIdCalculator` (or introduce `SemanticBlueIdCalculator`)

Current short-circuit behavior is in `calculateMap`.

Replace with:

- short-circuit only when map is exactly `{blueId: ...}`
- preserve empty lists
- domain-separated list fold

Keep the canonical "hash children and embed as `{blueId: childHash}`" strategy — it's good for incremental updates.

#### 1.4 Update `NodeToMapListOrValue`

It currently emits `"blueId"` whenever `node.getBlueId() != null`.

After the split:

- emit `"blueId"` only when `node.isReferenceOnly()` and using `referenceBlueId`
- never emit `computedBlueId` into canonical hashing

### Phase 2 — Introduce immutable snapshots and canonical storage

#### 2.1 Add `FrozenNode` and persistent collections

`FrozenNode` is the core: immutable, shareable, hash-cached.

Use `org.pcollections` or a simple custom persistent map/vector.

Cache the computed Merkle hash at the node.

```java
public final class FrozenNode {
  private final String name;
  private final String description;
  private final FrozenNode type;
  private final Object value;

  private final PMap<String, FrozenNode> properties;
  private final PVector<FrozenNode> items;

  // Canonical reference nodes are represented structurally as refOnly nodes
  private final String referenceBlueId;
  private final boolean referenceOnly;

  private final String cachedHash; // semantic blueId of this node (Merkle)
}
```

#### 2.2 Add `ResolvedSnapshot`

As described above:

- `canonicalRoot` (minimized overlay)
- `resolvedRoot` (runtime type-linked view)
- `blueId = hash(canonicalRoot)`

#### 2.3 Update `Blue` API

Right now `Blue.resolve(...)` returns `Node` via `Merger`.

Introduce a new canonical path:

```java
public ResolvedSnapshot resolveToSnapshot(Node authoring);
public ResolvedSnapshot loadSnapshot(Node canonical, SnapshotTrust trust);
public String calculateBlueId(Node authoring); // now semantic: resolve -> minimize -> hash
```

You can still keep `resolve(Node)` for callers who want a materialized merged `Node`, but your processor path should use snapshots.

### Phase 3 — Provider ingestion uses semantic ids

`NodeContentHandler.parseAndCalculateBlueId` currently does preprocess-only then hashes.

Change the ingestion pipeline to:

1. parse YAML -> `Node`
2. preprocess
3. resolve to snapshot (type-linked)
4. canonicalize/minimize
5. hash canonical
6. store canonical JSON under that `blueId`

You can optionally cache resolved snapshot for fast future reload.

### Phase 4 — Patch + Generalization + Incremental update

This is where your "dynamic generalization" doc plugs in.

#### 4.1 `WorkingDocument` operates on snapshots

- holds a `ResolvedSnapshot`
- applies patches to the resolved runtime view
- simultaneously updates the canonical overlay
- recomputes hash incrementally

#### 4.2 Generalization algorithm integration

For each patch (or for a batch), do:

1. Apply patch to a tentative copy (persistent update)
2. Validate at the deepest modified node
3. If non-conformant: generalize its type up the chain until conformant
4. Move up to parent and repeat until root
5. Update canonical overlay to reflect:
   - new override value (if needed)
   - removal of redundant overrides
   - updated type reference (if generalized)
6. Update Merkle hashes along touched paths only

Your current processing path calls `runtime.applyPatch(...)` and produces new document state / cascade scopes.

The change is: runtime holds a snapshot and returns a new snapshot.

### Phase 5 — Transport/webhook format: canonical + bundle, not giant resolved expansions

Your attached payload is huge because it includes deep resolved type objects and repeated expansions.

Change webhook payloads to:

- `rootBlueId`
- `canonical` (minimized document)
- optional `bundle` of blocks (referenced type nodes / commonly needed nodes)
- optional `blueIdsByPointer` sidecar map (debug/perf)
- optional `resolved` for debug only (off by default)

This makes payloads small and verifiable.

## "How it will work" — usage snippets

Below are concrete examples of the final API behavior.

### 1) Read authoring YAML -> resolve -> compute semantic `blueId` -> store

```java
Blue blue = new Blue(nodeProvider); // provider knows how to fetch type docs

Node authoring = YAML_MAPPER.readValue(yamlString, Node.class);

// Semantic: resolve (type-linked) + minimize (canonical overlay) + hash
ResolvedSnapshot snap = blue.resolveToSnapshot(authoring);

String blueId = snap.blueId();
Node canonical = snap.canonicalRoot().toMutableNode(); // if you want YAML/JSON

cas.put(blueId, JSON_MAPPER.writeValueAsBytes(canonical));

// Optional perf cache: resolved snapshot stored separately (not identity)
resolvedCache.put(blueId, snap);
```

### 2) Load snapshot fast (blind trust) -> apply one patch -> commit -> store next state

```java
ResolvedSnapshot prev = snapshotStore.load(blueId, SnapshotTrust.BLIND);

WorkingDocument wd = WorkingDocument.forSnapshot(blue, prev);

// counter := counter + 1
wd.applyPatch(JsonPatch.replace("/counter", new Node().value(1))); // example literal

ResolvedSnapshot next = wd.commit();

snapshotStore.put(next.blueId(), next.canonicalRoot()); // canonical CAS
resolvedCache.put(next.blueId(), next);                 // optional speed cache
```

### 3) Patch causes generalization (the "Price in EUR -> Price" story)

```java
WorkingDocument wd = WorkingDocument.forSnapshot(blue, prev);

// Change currency EUR -> USD
wd.applyPatch(JsonPatch.replace("/price/currency", new Node().value("USD")));

// After patch + generalization:
FrozenNode resolved = wd.currentResolvedRoot();
System.out.println(resolved.at("/price/type").name()); // "Price"
System.out.println(resolved.at("/type").name());       // e.g. "Global Product"

// Commit immutable snapshot
ResolvedSnapshot next = wd.commit();
System.out.println("New semantic blueId = " + next.blueId());

// Export canonical minimized view:
System.out.println(YAML_MAPPER.writeValueAsString(next.canonicalRoot().toMutableNode()));
```

The key property here:

- you do not re-resolve everything
- you generalize only along the modified path upward
- the canonical overlay updates only locally
- `blueId` updates incrementally

### 4) Example: changing inherited fixed value forces skipping constrained type

Your scenario: `C <- B <- A`, and `x` is constrained/fixed in `B`. Changing `x` must generalize from `C` all the way to `A` (because `B` still fails).

```java
wd.applyPatch(JsonPatch.replace("/x", new Node().value(2)));

// Internally:
// check C conformance -> fail
// generalize to B -> still fail (x fixed)
// generalize to A -> succeed
```

Canonical overlay result becomes:

- `type: {blueId: <A>}`
- `x: 2` override (since `A` doesn't fix it)

And your semantic `blueId` reflects that truthfully.

### 5) Webhook payload (canonical + bundle) instead of "resolved explosion"

```java
ResolvedSnapshot next = wd.commit();

WebhookEnvelope env = WebhookEnvelope.builder()
    .rootBlueId(next.blueId())
    .canonical(next.canonicalRoot().toJsonNode())
    .bundle(bundleBuilder.forCanonical(next.canonicalRoot())) // optional
    .blueIdsByPointer(next.blueIdsByPtr().asMap())            // optional perf/debug
    .build();

sendWebhook(JSON_MAPPER.writeValueAsString(env));
```

This avoids payloads like the attached one that inline huge type graphs.

## Patch + generalization: complete case coverage (object/scalar + lists)

Here's the exhaustive set of situations you must handle.

### A) Patch target exists vs does not exist

- REPLACE existing
- REPLACE missing -> treat as error or as ADD (pick one, document it)
- ADD missing
- ADD existing -> error or treat as REPLACE (pick one)
- REMOVE existing
- REMOVE missing -> no-op

### B) The value is effectively "no change"

Even if canonical doesn't contain the field (because it's inherited), REPLACE may be a no-op if the effective resolved value already equals the new value.

So you need:

- read effective value from resolved view
- compare semantics (or hash)
- if equal: don't create override in canonical; return no-op

### C) The patched field is inherited vs overridden

#### Field currently overridden in canonical

- patch updates override
- then minimization may remove it if it matches inherited again

#### Field currently inherited (not in canonical)

- patch creates override **only if** value differs from inherited

### D) The patch violates current type invariants

Your generalization algorithm handles these:

- fixed value violated (e.g. currency must be EUR)
- constraint violated (pattern/min/max/etc.)
- missing required property (if you model `required`)
- incompatible subtype required by parent

Generalization loop:

- at modified node, climb type chain until conforms
- then validate parent, repeat to root

### E) Patch attempts to mutate `/.../type/*`

Disallow.

- Only `/.../type` replacement is allowed
- and only in the generalization direction (`currentType <: newType`)

### F) Lists

You likely need list operations in practice (workflow steps, events, etc.).

Cases:

- add/replace/remove at index
- append (`/-`) if you support it
- compare/minimize for list items that are inherited vs overridden

Hashing:

- append should be `O(1)` (fold with previous hash)
- replace/remove in middle may be `O(n)` unless you build a Merkle tree (optional optimization)

Given your workload ("tons of events"), most big lists in real systems are append-only; if that's true for you, the fold-based Merkle list is perfect.

## Why immutability/snapshots are worth it (in your scenario)

You basically already discovered the reason in your own thought experiment:

- Cache resolved types by `blueId`
- Reuse the same resolved type instance across many documents safely
- Apply changes without cloning huge structures
- Keep a stable baseline for:
  - diffs
  - audits
  - deterministic hashing
  - concurrency

A mutable "resolved node" can't be safely shared, so you'd keep cloning or risk corruption. An immutable snapshot makes "type cache reuse" a free win.

## Practical notes on your current codebase

- The current provider hashing path (`NodeContentHandler`) must change from preprocess-only to resolve+minimize+hash
- The current short-circuit in `BlueIdCalculator.calculateMap` must be restricted to pure reference nodes only
- Your current payload explosion is exactly what canonical+bundle fixes
- You already have a conceptual minimizer: `Blue.reverse(...)` uses `MergeReverser`
  - Even if you rewrite it, you can mine it for logic and test cases

## Summary: what you'll have at the end

### 1) Semantic `blueId`

- Stable across authoring noise and redundant inherited overrides
- Computed from canonical minimized form

### 2) Fast processor

- Operates on immutable runtime snapshots
- Patch updates are path-local
- Generalization keeps every epoch valid

### 3) Small storage & transport

- Persist and ship canonical + optional bundle
- not giant expanded resolved docs

### 4) No `blueId` confusion

- `"blueId"` in documents means reference only
- computed hashes live in caches / sidecars

If you want, I can take your Codex plan and rewrite it into a PR-by-PR checklist with "done means..." acceptance criteria (unit tests + integration checks), but the architecture above is the cleanest way to satisfy your goals without paying the "resolve+minimize whole tree every time" cost.
