/**
 * Shared normalization utilities for graph serializers.
 */

/**
 * Ensures the value at `key` in `node` is wrapped in an array.
 * No-op if the value is undefined or already an array.
 */
export function ensureArray(node: Record<string, unknown>, key: string): void {
  const value = node[key];

  if (value !== undefined && !Array.isArray(value)) {
    node[key] = [value];
  }
}

/**
 * Recursively traverses `node` and ensures that values at any of
 * the given `keys` are wrapped in arrays.
 */
export function normalizeArrays(node: unknown, keys: readonly string[]): void {
  if (typeof node !== 'object' || node === null) {
    return;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      normalizeArrays(item, keys);
    }

    return;
  }

  const obj = node as Record<string, unknown>;

  for (const key of keys) {
    if (obj[key] !== undefined && !Array.isArray(obj[key])) {
      obj[key] = [obj[key]];
    }
  }

  for (const value of Object.values(obj)) {
    normalizeArrays(value, keys);
  }
}
