/**
 * Resolver — per-call option merging
 *
 * Merges a base options object with an optional per-call override.
 * Only defined (non-undefined) keys in the override replace base values.
 */
export class Resolver {
  public static merge<T extends Record<string, unknown>>(
    base: T,
    override: Partial<T> | undefined
  ): T {
    if (override === undefined) {
      return base;
    }
    const result = { ...base };

    // Object.keys returns string[], but override is Partial<T> so every key is keyof T.
    // The cast is safe for this shallow merge: no keys outside T can appear in the override.
    for (const key of Object.keys(override) as Array<keyof T>) {
      if (override[key] !== undefined) {
        result[key] = override[key];
      }
    }

    return result;
  }
}
