/**
 * MutablePropertySchemaType — mutable property-level JSON Schema shape accumulated
 * during property restriction processing in the PropertyRestrictions dispatcher.
 */

export type MutablePropertySchemaType = {
  'const'?: unknown;
  'items'?: { '$ref': string };
  'maxItems'?: number;
  'minItems'?: number;
};
