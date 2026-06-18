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

import type { JsonSchemaDefinitionType } from '../types/JsonSchemaDefinitionType.js';
import type { JsonSchemaTypeNameType } from '../types/Schema.js';

export type JsonSchemaObjectType = {
  readonly '$anchor'?: string;
  readonly '$comment'?: string;
  readonly '$defs'?: Readonly<Record<string, JsonSchemaDefinitionType>>;
  readonly '$dynamicAnchor'?: string;
  readonly '$dynamicRef'?: string;
  readonly '$id'?: string;
  readonly '$ref'?: string;
  readonly '$schema'?: string;
  readonly '$vocabulary'?: Readonly<Record<string, boolean>>;
  readonly 'additionalProperties'?: JsonSchemaDefinitionType;
  readonly 'allOf'?: readonly JsonSchemaDefinitionType[];
  readonly 'anyOf'?: readonly JsonSchemaDefinitionType[];
  readonly 'const'?: unknown;
  readonly 'contains'?: JsonSchemaDefinitionType;
  readonly 'contentEncoding'?: string;
  readonly 'contentMediaType'?: string;
  readonly 'contentSchema'?: JsonSchemaDefinitionType;
  readonly 'default'?: unknown;
  readonly 'dependentRequired'?: Readonly<Record<string, readonly string[]>>;
  readonly 'dependentSchemas'?: Readonly<Record<string, JsonSchemaDefinitionType>>;
  readonly 'deprecated'?: boolean;
  readonly 'description'?: string;
  readonly 'else'?: JsonSchemaDefinitionType;
  readonly 'enum'?: readonly unknown[];
  readonly 'examples'?: readonly unknown[];
  readonly 'exclusiveMaximum'?: number;
  readonly 'exclusiveMinimum'?: number;
  readonly 'format'?: string;
  readonly 'if'?: JsonSchemaDefinitionType;
  readonly 'items'?: JsonSchemaDefinitionType;
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
  readonly 'not'?: JsonSchemaDefinitionType;
  readonly 'oneOf'?: readonly JsonSchemaDefinitionType[];
  readonly 'pattern'?: string;
  readonly 'patternProperties'?: Readonly<Record<string, JsonSchemaDefinitionType>>;
  readonly 'prefixItems'?: readonly JsonSchemaDefinitionType[];
  readonly 'properties'?: Readonly<Record<string, JsonSchemaDefinitionType>>;
  readonly 'propertyNames'?: JsonSchemaDefinitionType;
  readonly 'readOnly'?: boolean;
  readonly 'required'?: readonly string[];
  readonly 'then'?: JsonSchemaDefinitionType;
  readonly 'title'?: string;
  readonly 'type'?: JsonSchemaTypeNameType | readonly JsonSchemaTypeNameType[];
  readonly 'unevaluatedItems'?: JsonSchemaDefinitionType;
  readonly 'unevaluatedProperties'?: JsonSchemaDefinitionType;
  readonly 'uniqueItems'?: boolean;
  readonly 'writeOnly'?: boolean;
};
