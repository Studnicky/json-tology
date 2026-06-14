import type { DuplicateReportEntryType } from '../types/DuplicateReportEntryType.js';
import type { SchemaRegistryEntryType } from '../types/SchemaRegistryEntry.js';

export interface SchemaEntryStoreInterface {
  /** Store an entry under schemaId; also record the content hash → id mapping. */
  add(schemaId: string, entry: SchemaRegistryEntryType): void;
  /** Remove all entries and all hash mappings. Returns true if anything was cleared. */
  clear(): boolean;

  /** Remove a single entry by schemaId. Returns true if it existed. */
  delete(schemaId: string): boolean;
  /** Iterate [schemaId, entry] pairs. */
  entries(): IterableIterator<[string, SchemaRegistryEntryType]>;
  /** Return all duplicate sub-schema shapes detected across registered schemas. */
  findDuplicates(): readonly DuplicateReportEntryType[];
  /** Return the entry for schemaId, or undefined. */
  get(schemaId: string): SchemaRegistryEntryType | undefined;
  /** Return the schemaId currently registered under hash, or undefined. */
  getByHash(hash: string): string | undefined;
  /** True if schemaId has an entry. */
  has(schemaId: string): boolean;
  /** True if this hash is already claimed by any registered schema. */
  hasHash(hash: string): boolean;
  /** Iterate all schemaIds. */
  keys(): IterableIterator<string>;
  /** Monotonically increasing counter; bumped on every mutation. */
  readonly 'revision': number;
  /** Number of registered schemas. */
  readonly 'size': number;
  /** Iterate all entries. */
  values(): IterableIterator<SchemaRegistryEntryType>;
}
