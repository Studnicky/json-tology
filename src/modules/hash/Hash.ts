/**
 * Hash — deterministic FNV-1a hashing for JSON-serializable values.
 *
 * Single implementation consumed by Value, GraphEngine, SchemaRegistry,
 * and Materializer.
 */

import { HEX_RADIX } from '../../constants/NUMERIC.js';

export class Hash {
  /**
   * Compute a deterministic FNV-1a hash of a JSON-serializable value with sorted keys.
   *
   * @param input - Value to hash (must be JSON-serializable)
   * @returns Hex string of the 32-bit FNV-1a hash
   */
  static value(input: unknown): string {
    const serialized = JSON.stringify(input, keySortReplacer);
    let hash = 2_166_136_261;
    const fnvPrime = 16_777_619;

    for (let i = 0; i < serialized.length; i++) {
      hash ^= serialized.codePointAt(i) ?? 0;
      hash = (hash * fnvPrime) >>> 0;
    }

    return hash.toString(HEX_RADIX);
  }
}

function keySortReplacer(_: string, value: unknown): unknown {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const sorted: Record<string, unknown> = {};
    const sortedKeys = Object.keys(value).sort();

    for (const sortedKey of sortedKeys) {
      sorted[sortedKey] = (value as Record<string, unknown>)[sortedKey];
    }

    return sorted;
  }

  return value;
}
