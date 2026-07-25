/**
 * A loosely-typed schema record known to carry a registered `$id`.
 *
 * Used at the registry/materialization boundary where the schema has not
 * been narrowed to the full {@link JsonSchemaDocumentType} shape.
 */
export type SchemaWithIdType = Record<string, unknown> & { '$id': string };
