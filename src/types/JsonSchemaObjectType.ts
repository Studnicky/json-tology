/**
 * JSON Schema draft 2020-12 — strict structural model.
 *
 * Narrow by design: only keywords defined by the 2020-12 core, validation,
 * format-annotation, content, and meta-data vocabularies are representable.
 * Draft-07 carry-overs that 2020-12 removed are intentionally absent:
 *   - `definitions`       (replaced by `$defs`)
 *   - `dependencies`      (replaced by `dependentSchemas` + `dependentRequired`)
 *   - `additionalItems`   (replaced by `items` + `prefixItems`)
 *   - the array form of `items` (now requires `prefixItems`)
 *   - the boolean form of `exclusiveMaximum` / `exclusiveMinimum`
 *
 * Specs:
 *   https://json-schema.org/draft/2020-12/json-schema-core
 *   https://json-schema.org/draft/2020-12/json-schema-validation
 */

import type { JsonSchema } from '../types/JsonSchema.js';
import type { JsonSchemaTypeNameType } from '../types/Schema.js';

export type JsonSchemaObjectType = {
  readonly '$anchor'?: string;
  readonly '$comment'?: string;
  readonly '$defs'?: Readonly<Record<string, JsonSchema>>;
  readonly '$dynamicAnchor'?: string;
  readonly '$dynamicRef'?: string;
  readonly '$id'?: string;
  readonly '$ref'?: string;
  readonly '$schema'?: string;
  readonly '$vocabulary'?: Readonly<Record<string, boolean>>;
  readonly 'additionalProperties'?: JsonSchema;
  readonly 'allOf'?: readonly JsonSchema[];
  readonly 'anyOf'?: readonly JsonSchema[];
  readonly 'const'?: unknown;
  readonly 'contains'?: JsonSchema;
  readonly 'contentEncoding'?: string;
  readonly 'contentMediaType'?: string;
  readonly 'contentSchema'?: JsonSchema;
  readonly 'default'?: unknown;
  readonly 'dependentRequired'?: Readonly<Record<string, readonly string[]>>;
  readonly 'dependentSchemas'?: Readonly<Record<string, JsonSchema>>;
  readonly 'deprecated'?: boolean;
  readonly 'description'?: string;
  readonly 'else'?: JsonSchema;
  readonly 'enum'?: readonly unknown[];
  readonly 'examples'?: readonly unknown[];
  readonly 'exclusiveMaximum'?: number;
  readonly 'exclusiveMinimum'?: number;
  readonly 'format'?: string;
  readonly 'if'?: JsonSchema;
  readonly 'items'?: JsonSchema;
  readonly 'maxContains'?: number;
  readonly 'maximum'?: number;
  readonly 'maxItems'?: number;
  readonly 'maxLength'?: number;
  readonly 'maxProperties'?: number;
  readonly 'minContains'?: number;
  readonly 'minimum'?: number;
  readonly 'minItems'?: number;
  readonly 'minLength'?: number;
  readonly 'minProperties'?: number;
  readonly 'multipleOf'?: number;
  readonly 'not'?: JsonSchema;
  readonly 'oneOf'?: readonly JsonSchema[];
  readonly 'pattern'?: string;
  readonly 'patternProperties'?: Readonly<Record<string, JsonSchema>>;
  readonly 'prefixItems'?: readonly JsonSchema[];
  readonly 'properties'?: Readonly<Record<string, JsonSchema>>;
  readonly 'propertyNames'?: JsonSchema;
  readonly 'readOnly'?: boolean;
  readonly 'required'?: readonly string[];
  readonly 'then'?: JsonSchema;
  readonly 'title'?: string;
  readonly 'type'?: JsonSchemaTypeNameType | readonly JsonSchemaTypeNameType[];
  readonly 'unevaluatedItems'?: JsonSchema;
  readonly 'unevaluatedProperties'?: JsonSchema;
  readonly 'uniqueItems'?: boolean;
  readonly 'writeOnly'?: boolean;
};
