import equal from 'fast-deep-equal/es6';

/**
 * Returns `true` when every key / value in **`subset`**
 * exists (deep-equal) somewhere inside **`source`**.
 *
 *  • Arrays → order-insensitive subset
 *  • Map    → key/value subset
 *  • Set    → element subset
 */
export function deepContains<T = unknown>(source: T, subset: unknown): boolean {
  /* ------------------------------------------------------------------ */
  /*  1. Primitive or “value” objects that should be compared directly  */
  /* ------------------------------------------------------------------ */
  if (
    subset === null ||
    typeof subset !== 'object' ||
    subset instanceof Date ||
    subset instanceof RegExp
  ) {
    return equal(source, subset);
  }

  /* ------------------------------------------------------------------ */
  /*  2. Set ⊆ check                                                    */
  /* ------------------------------------------------------------------ */
  if (subset instanceof Set) {
    if (!(source instanceof Set)) return false;
    for (const v of subset) if (!source.has(v)) return false;
    return true;
  }

  /* ------------------------------------------------------------------ */
  /*  3. Map ⊆ check                                                    */
  /* ------------------------------------------------------------------ */
  if (subset instanceof Map) {
    if (!(source instanceof Map)) return false;
    for (const [k, v] of subset)
      if (!source.has(k) || !deepContains(source.get(k), v)) return false;
    return true;
  }

  /* ------------------------------------------------------------------ */
  /*  4. Array (order-insensitive subset)                               */
  /* ------------------------------------------------------------------ */
  if (Array.isArray(subset)) {
    if (!Array.isArray(source)) return false;
    return subset.every((p) =>
      (source as unknown[]).some((o) => deepContains(o, p))
    );
  }

  /* ------------------------------------------------------------------ */
  /*  5. Plain-object subset                                            */
  /* ------------------------------------------------------------------ */
  if (source === null || typeof source !== 'object' || Array.isArray(source)) {
    return false; // object-vs-array or other type mismatch
  }

  const s = source as Record<PropertyKey, unknown>;
  return Object.entries(subset as Record<PropertyKey, unknown>).every(
    ([k, v]) => k in s && deepContains(s[k], v)
  );
}
