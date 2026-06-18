/**
 * Hash — deterministic FNV-1a hashing for JSON-serializable values.
 *
 * Single implementation consumed by Value, GraphEngine, SchemaRegistry,
 * and Materializer.
 */

import { HEX_RADIX } from '../../constants/NUMERIC.js';
import { DataType } from '../data/DataType.js';

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
  if (DataType.isRecord(value)) {
    const rec = value;
    const keys = Object.keys(rec);

    // Fast-path: already sorted (common case for compiled schemas).
    let alreadySorted = true;

    for (let i = 1; i < keys.length; i++) {
      const prev = keys[i - 1];
      const curr = keys[i];

      if (prev !== undefined && curr !== undefined && prev > curr) {
        alreadySorted = false;
        break;
      }
    }
    if (alreadySorted) {
      return value;
    }

    const sorted: Record<string, unknown> = {};

    for (const k of keys.sort()) {
      sorted[k] = rec[k];
    }

    return sorted;
  }

  return value;
}
