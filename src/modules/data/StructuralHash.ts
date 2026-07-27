/**
 * StructuralHash — canonical structural equivalence hashing for JSON Schema shapes.
 *
 * Strips metadata-only fields (title, description, $id) before hashing so that
 * two schemas that differ only in descriptive annotations still compare as equal.
 */

import { Hash } from '../hash/Hash.js';
import { METADATA_KEYS } from '../../constants/STRUCTURAL_HASH.js';
import { DataType } from './DataType.js';

export class StructuralHash {
  public static of(schema: Record<string, unknown>): string {
    const result = Hash.value(StructuralHash.strip(schema));

    return result;
  }

  private static strip(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => {
        const result = StructuralHash.strip(item);

        return result;
      });
    }

    if (!DataType.isRecord(value)) {
      return value;
    }

    const record = value;
    const result: Record<string, unknown> = {};

    for (const [
      key,
      propertyValue
    ] of Object.entries(record)) {
      if (METADATA_KEYS.has(key)) {
        continue;
      }
      result[key] = StructuralHash.strip(propertyValue);
    }

    return result;
  }
}
