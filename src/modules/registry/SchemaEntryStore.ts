/**
 * SchemaEntryStore
 *
 * Owns the raw Map storage, hash-keyed duplicate index, and revision counter
 * that back SchemaRegistry. SchemaRegistry composes this and delegates all
 * entry CRUD through it.
 */

import type { DuplicateReportEntryType } from '../../types/DuplicateReportEntryType.js';
import type { SchemaEntryStoreInterface } from '../../interfaces/SchemaEntryStoreInterface.js';
import type { SchemaRegistryEntryType } from '../../types/SchemaRegistryEntryType.js';

import { DataType } from '../data/DataType.js';
import { StructuralHash } from '../data/StructuralHash.js';

/**
 * Suffixes appended to the structural hash to express nominal identity.
 *
 * A transform-bearing schema has different nominal identity from a structurally
 * identical plain schema — their hashes must not collide in the duplicate-
 * detection cache. Anonymous inline sub-shapes always use the PLAIN suffix,
 * which aligns them with plain (non-transform) top-level schemas only.
 */
const TRANSFORM_SUFFIX = ':t';
const PLAIN_SUFFIX = ':p';

/**
 * Compute a nominal-aware hash for a top-level registry entry.
 *
 * The hash is `StructuralHash.of(entry.schema) + suffix` where suffix is `:t`
 * for transform-bearing schemas and `:p` for plain ones.  This ensures that
 * a decoder-carrying primitive (e.g. `IriString` with a URL decoder) cannot
 * collide in the duplicate-detection cache with a plain `{ type: 'string' }`
 * schema that happens to share the same JSON body.
 */
function nominalAwareHash(entry: SchemaRegistryEntryType): string {
  const base = StructuralHash.of(entry.schema);

  return entry.hasTransform ? base + TRANSFORM_SUFFIX : base + PLAIN_SUFFIX;
}

export class SchemaEntryStore implements SchemaEntryStoreInterface {
  private readonly byId = new Map<string, SchemaRegistryEntryType>();
  private readonly hashes = new Map<string, string>();
  private rev = 0;
  /** Cached top-level hash → schemaId map for findDuplicates(). Invalidated on mutation. */
  private topLevelHashCache: Map<string, string> | undefined = undefined;

  public add(schemaId: string, entry: SchemaRegistryEntryType): void {
    this.byId.set(schemaId, entry);
    this.hashes.set(entry.hash, schemaId);
    this.topLevelHashCache = undefined;
    this.rev++;
  }

  public clear(): boolean {
    if (this.byId.size === 0 && this.hashes.size === 0) {
      return false;
    }
    this.byId.clear();
    this.hashes.clear();
    this.topLevelHashCache = undefined;
    this.rev++;

    return true;
  }

  public delete(schemaId: string): boolean {
    const entry = this.byId.get(schemaId);

    if (entry === undefined) {
      return false;
    }
    this.byId.delete(schemaId);
    this.hashes.delete(entry.hash);
    this.topLevelHashCache = undefined;
    this.rev++;

    return true;
  }

  public entries(): IterableIterator<[string, SchemaRegistryEntryType]> {
    const result = this.byId.entries();

    return result;
  }

  public findDuplicates(): readonly DuplicateReportEntryType[] {
    if (this.topLevelHashCache === undefined) {
      // Phase 1: compute a nominal-aware structural hash for each top-level
      // schema and group by hash to detect "nominally contested" entries.
      //
      // Nominal-aware hash = StructuralHash.of(schema) + transform suffix.
      // Two top-level schemas that share the SAME nominal-aware hash are
      // intentionally distinct named classes (e.g. IriString vs Slug, both
      // { type: 'string' }). Reporting an inline sub-shape as a duplicate of
      // one of them would be a false positive — the consumer cannot know which
      // named class is "the right one" to reference.
      //
      // Hashes that appear for exactly ONE top-level schema remain valid
      // duplicate-detection anchors (e.g. a unique EmailSchema shape).
      const hashToIds = new Map<string, string[]>();

      for (const [
        schemaId,
        entry
      ] of this.byId) {
        const hash = nominalAwareHash(entry);
        const existing = hashToIds.get(hash);

        if (existing === undefined) {
          hashToIds.set(hash, [schemaId]);
        } else {
          existing.push(schemaId);
        }
      }

      // Phase 2: build the effective match cache from uncontested hashes only.
      const cache = new Map<string, string>();

      for (const [
        hash,
        ids
      ] of hashToIds) {
        if (ids.length === 1) {
          const id = ids[0];

          if (id !== undefined) {
            cache.set(hash, id);
          }
        }
        // Multiple top-level schemas share this nominal hash → nominally
        // contested → omit from the cache so inline shapes are not flagged.
      }
      this.topLevelHashCache = cache;
    }
    const topLevelHashes = this.topLevelHashCache;

    const results: DuplicateReportEntryType[] = [];

    for (const [
      schemaId,
      entry
    ] of this.byId) {
      this.walkForDuplicates(schemaId, entry.schema, '', topLevelHashes, results);
    }

    return results;
  }

  public get(schemaId: string): SchemaRegistryEntryType | undefined {
    const result = this.byId.get(schemaId);

    return result;
  }

  public getByHash(hash: string): string | undefined {
    const result = this.hashes.get(hash);

    return result;
  }

  public has(schemaId: string): boolean {
    const result = this.byId.has(schemaId);

    return result;
  }

  public hasHash(hash: string): boolean {
    const result = this.hashes.has(hash);

    return result;
  }

  public keys(): IterableIterator<string> {
    const result = this.byId.keys();

    return result;
  }

  public get revision(): number {
    return this.rev;
  }

  public get size(): number {
    return this.byId.size;
  }

  public values(): IterableIterator<SchemaRegistryEntryType> {
    const result = this.byId.values();

    return result;
  }

  private walkCompositionForDuplicates(
    schemaId: string,
    schema: Record<string, unknown>,
    pointer: string,
    compositionKey: 'allOf' | 'anyOf' | 'oneOf',
    topLevelHashes: Map<string, string>,
    results: DuplicateReportEntryType[]
  ): void {
    const compositionArr = schema[compositionKey];

    if (!Array.isArray(compositionArr)) {
      return;
    }

    for (const [
      idx,
      subSchema
    ] of compositionArr.entries()) {
      if (!DataType.isRecord(subSchema)) {
        continue;
      }
      this.walkForDuplicates(schemaId, subSchema, `${pointer}/${compositionKey}/${idx}`, topLevelHashes, results);
    }
  }

  private walkForDuplicates(
    schemaId: string,
    schema: Record<string, unknown>,
    pointer: string,
    topLevelHashes: Map<string, string>,
    results: DuplicateReportEntryType[]
  ): void {
    if (DataType.isRecord(schema.properties)) {
      for (const [
        propName,
        propSchema
      ] of Object.entries(schema.properties)) {
        if (!DataType.isRecord(propSchema)) {
          continue;
        }
        const propPointer = `${pointer}/properties/${propName}`;

        if (typeof propSchema.$id !== 'string' && !('$ref' in propSchema)) {
          // Inline anonymous sub-shapes never carry a transform, so they are
          // keyed with PLAIN_SUFFIX to align with the nominal-aware cache.
          const leafHash = StructuralHash.of(propSchema) + PLAIN_SUFFIX;
          const matchId = topLevelHashes.get(leafHash);

          if (matchId !== undefined && matchId !== schemaId) {
            results.push({
              'equivalentTo': matchId,
              'pointer': propPointer,
              'schemaId': schemaId,
              'shape': propSchema
            });
          }
        }

        this.walkForDuplicates(schemaId, propSchema, propPointer, topLevelHashes, results);
      }
    }

    this.walkCompositionForDuplicates(schemaId, schema, pointer, 'allOf', topLevelHashes, results);
    this.walkCompositionForDuplicates(schemaId, schema, pointer, 'anyOf', topLevelHashes, results);
    this.walkCompositionForDuplicates(schemaId, schema, pointer, 'oneOf', topLevelHashes, results);

    if (DataType.isRecord(schema.$defs)) {
      for (const [
        defName,
        defSchema
      ] of Object.entries(schema.$defs)) {
        if (!DataType.isRecord(defSchema)) {
          continue;
        }
        this.walkForDuplicates(schemaId, defSchema, `${pointer}/$defs/${defName}`, topLevelHashes, results);
      }
    }
  }
}
