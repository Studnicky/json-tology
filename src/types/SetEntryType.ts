/**
 * SetEntryType — a single entry accepted by `SchemaRegistry.set()`.
 *
 * Either a bare schema object or a tuple of `[schema, iri]` where the IRI
 * overrides the schema's own `$id` as the registry key.
 */
export type SetEntryType = [Record<string, unknown>, string] | Record<string, unknown>;
