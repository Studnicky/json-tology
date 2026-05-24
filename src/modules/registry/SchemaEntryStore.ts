/**
 * SchemaEntryStore
 *
 * Owns the raw Map storage, hash-keyed duplicate index, and revision counter
 * that back SchemaRegistry. SchemaRegistry composes this and delegates all
 * entry CRUD through it.
 */

import type {
  DuplicateReportEntryType, SchemaEntryStoreInterface
} from '../../interfaces/SchemaEntryStore.js';
import type { SchemaRegistryEntryInterface } from '../../interfaces/SchemaRegistryEntry.js';

import { isRecord } from '../data/DataTypes.js';
import { StructuralHash } from '../data/StructuralHash.js';

export class SchemaEntryStore implements SchemaEntryStoreInterface {
  private readonly byId = new Map<string, SchemaRegistryEntryInterface>();
  private readonly hashes = new Map<string, string>();
  private rev = 0;
  /** Cached top-level hash → schemaId map for findDuplicates(). Invalidated on mutation. */
  private topLevelHashCache: Map<string, string> | undefined = undefined;

  public add(schemaId: string, entry: SchemaRegistryEntryInterface): void {
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

  public entries(): IterableIterator<[string, SchemaRegistryEntryInterface]> {
    return this.byId.entries();
  }

  public findDuplicates(): readonly DuplicateReportEntryType[] {
    if (this.topLevelHashCache === undefined) {
      const cache = new Map<string, string>();

      for (const [
        schemaId,
        entry
      ] of this.byId) {
        cache.set(StructuralHash.of(entry.schema), schemaId);
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

  public get(schemaId: string): SchemaRegistryEntryInterface | undefined {
    return this.byId.get(schemaId);
  }

  public getByHash(hash: string): string | undefined {
    return this.hashes.get(hash);
  }

  public has(schemaId: string): boolean {
    return this.byId.has(schemaId);
  }

  public hasHash(hash: string): boolean {
    return this.hashes.has(hash);
  }

  public keys(): IterableIterator<string> {
    return this.byId.keys();
  }

  public get revision(): number {
    return this.rev;
  }

  public get size(): number {
    return this.byId.size;
  }

  public values(): IterableIterator<SchemaRegistryEntryInterface> {
    return this.byId.values();
  }

  private walkForDuplicates(
    schemaId: string,
    schema: Record<string, unknown>,
    pointer: string,
    topLevelHashes: Map<string, string>,
    results: DuplicateReportEntryType[]
  ): void {
    if (isRecord(schema.properties)) {
      for (const [
        propName,
        propSchema
      ] of Object.entries(schema.properties)) {
        if (!isRecord(propSchema)) {
          continue;
        }
        const propPointer = `${pointer}/properties/${propName}`;

        if (typeof propSchema.$id !== 'string' && !('$ref' in propSchema)) {
          const leafHash = StructuralHash.of(propSchema);
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

    for (const compositionKey of [
      'allOf',
      'anyOf',
      'oneOf'
    ]) {
      const compositionArr = schema[compositionKey];

      if (Array.isArray(compositionArr)) {
        for (const [
          idx,
          subSchema
        ] of compositionArr.entries()) {
          if (!isRecord(subSchema)) {
            continue;
          }
          this.walkForDuplicates(schemaId, subSchema, `${pointer}/${compositionKey}/${idx}`, topLevelHashes, results);
        }
      }
    }

    if (isRecord(schema.$defs)) {
      for (const [
        defName,
        defSchema
      ] of Object.entries(schema.$defs)) {
        if (!isRecord(defSchema)) {
          continue;
        }
        this.walkForDuplicates(schemaId, defSchema, `${pointer}/$defs/${defName}`, topLevelHashes, results);
      }
    }
  }
}
