import type { SchemaRegistryEntryInterface } from './SchemaRegistryEntry.js';

export interface DuplicateReportEntryType<TEquivalentTo extends string = string> {
  readonly 'equivalentTo': TEquivalentTo;
  readonly 'pointer': string;
  readonly 'schemaId': string;
  readonly 'shape': Record<string, unknown>;
}

export interface SchemaEntryStoreInterface {
  /** Store an entry under schemaId; also record the content hash → id mapping. */
  add(schemaId: string, entry: SchemaRegistryEntryInterface): void;
  /** Remove all entries and all hash mappings. Returns true if anything was cleared. */
  clear(): boolean;

  /** Remove a single entry by schemaId. Returns true if it existed. */
  delete(schemaId: string): boolean;
  /** Iterate [schemaId, entry] pairs. */
  entries(): IterableIterator<[string, SchemaRegistryEntryInterface]>;
  /** Return all duplicate sub-schema shapes detected across registered schemas. */
  findDuplicates(): readonly DuplicateReportEntryType[];
  /** Return the entry for schemaId, or undefined. */
  get(schemaId: string): SchemaRegistryEntryInterface | undefined;
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
  values(): IterableIterator<SchemaRegistryEntryInterface>;
}
