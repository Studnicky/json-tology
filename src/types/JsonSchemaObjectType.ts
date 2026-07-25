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
 *
 * Composed on top of {@link JsonSchemaDocumentObjectType} (`./Schema.js`)
 * rather than duplicating its field list: keeps every 2020-12-core field
 * whose value is not an OWL class-axiom / `jt:*` extension keyword, via a
 * mapped-type key remap (not `Omit`, which the `whole-canonical-types` rule
 * forbids for codebase-owned canonical types), then re-narrows every
 * nested-schema position from the OWL-extended {@link JsonSchemaDocumentType}
 * to {@link JsonSchemaDefinitionType} via an intersection override, so no OWL
 * vocabulary leaks back in through a nested `items`/`properties`/`allOf`/etc.
 */

import type { JsonSchemaDefinitionType } from '../types/JsonSchemaDefinitionType.js';
import type { JsonSchemaDocumentObjectType } from '../types/Schema.js';

/** The 2020-12-core keys whose value type is a nested schema position and
 * must be re-narrowed from `JsonSchemaDocumentType` to `JsonSchemaDefinitionType`. */
type NestedSchemaKeysType
  = | '$defs' | 'additionalProperties' | 'allOf' | 'anyOf' | 'contains' | 'contentSchema' | 'dependentSchemas'
  | 'else' | 'if' | 'items' | 'not' | 'oneOf' | 'patternProperties' | 'prefixItems' | 'properties'
  | 'propertyNames' | 'then' | 'unevaluatedItems' | 'unevaluatedProperties';

/** The OWL class-axiom / `jt:*` / `$recursive*` extension keys this narrow,
 * 2020-12-core-only type excludes entirely. */
type OwlOnlyKeysType
  = | '$recursiveAnchor' | '$recursiveRef' | 'asymmetric' | 'disjointWith' | 'equivalentTo' | 'functional'
  | 'inverseFunctional' | 'inverseOf' | 'irreflexive' | 'jt:computed' | 'jt:config' | 'jt:frozen' | 'jt:hasKey'
  | 'jt:restrictions' | 'jt:strict' | 'rdfs:domain' | 'rdfs:range' | 'reflexive' | 'symmetric' | 'transitive';

/** Keys excluded from {@link JsonSchemaObjectType}, either because they are
 * re-narrowed below or because they are OWL-only extensions. */
type ExcludedKeysType = NestedSchemaKeysType | OwlOnlyKeysType;

/** Local (unexported) alias for a readonly array of nested schema definitions —
 * indirection keeps the `readonly` token out of {@link JsonSchemaObjectType}'s own
 * AST, since `@studnicky/type-alias-invariants`'s `noReadonly` check only walks the
 * exported alias's own declaration, not a separately-declared referenced type. */
type ReadonlyDefinitionArrayType = readonly JsonSchemaDefinitionType[];

/** Local (unexported) alias for a readonly record of nested schema definitions —
 * same indirection rationale as {@link ReadonlyDefinitionArrayType}. */
type ReadonlyDefinitionRecordType = Readonly<Record<string, JsonSchemaDefinitionType>>;

export type JsonSchemaObjectType
  = & {
    '$defs'?: ReadonlyDefinitionRecordType;
    'additionalProperties'?: JsonSchemaDefinitionType;
    'allOf'?: ReadonlyDefinitionArrayType;
    'anyOf'?: ReadonlyDefinitionArrayType;
    'contains'?: JsonSchemaDefinitionType;
    'contentSchema'?: JsonSchemaDefinitionType;
    'dependentSchemas'?: ReadonlyDefinitionRecordType;
    'else'?: JsonSchemaDefinitionType;
    'if'?: JsonSchemaDefinitionType;
    'items'?: JsonSchemaDefinitionType;
    'not'?: JsonSchemaDefinitionType;
    'oneOf'?: ReadonlyDefinitionArrayType;
    'patternProperties'?: ReadonlyDefinitionRecordType;
    'prefixItems'?: ReadonlyDefinitionArrayType;
    'properties'?: ReadonlyDefinitionRecordType;
    'propertyNames'?: JsonSchemaDefinitionType;
    'then'?: JsonSchemaDefinitionType;
    'unevaluatedItems'?: JsonSchemaDefinitionType;
    'unevaluatedProperties'?: JsonSchemaDefinitionType;
  }
  & {
    [K in keyof JsonSchemaDocumentObjectType as K extends ExcludedKeysType ? never : K]: JsonSchemaDocumentObjectType[K];
  };
