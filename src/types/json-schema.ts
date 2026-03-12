/**
 * Project-owned JSON Schema type definition.
 *
 * This is the generic constraint type used in `T extends JSONSchema`.
 * Intentionally loose — it accepts any valid JSON Schema object declared with `as const`.
 * Tight inference happens in `InferSchema<T>`.
 */

type JSONSchemaObject = {
  readonly [key: string]: unknown;
};

type JSONSchemaDefinition = boolean | JSONSchemaObject;

/** Public constraint type — used in `T extends JSONSchema`. */
export type JSONSchema = JSONSchemaDefinition;
