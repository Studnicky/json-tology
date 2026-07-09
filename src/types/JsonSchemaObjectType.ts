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
 * rather than duplicating its field list: `Omit`s the OWL class-axiom /
 * `jt:*` extension keywords entirely, then re-narrows every nested-schema
 * position from the OWL-extended {@link JsonSchemaDocumentType} to
 * {@link JsonSchemaDefinitionType} via an intersection override, so no OWL
 * vocabulary leaks back in through a nested `items`/`properties`/`allOf`/etc.
 * Giving `JsonSchemaDocumentObjectType` a type parameter instead (so this
 * type could `Pick` a generic instantiation of it) was tried and reverted:
 * TypeScript reports the type's own existing
 * `JsonSchemaDocumentType = boolean | JsonSchemaDocumentObjectType`
 * recursion as circular the moment a type parameter — even one with a
 * self-referential default that changes no other call site's behavior — is
 * added, independent of anything in this file. `Omit` + override keeps
 * `JsonSchemaDocumentObjectType` untouched and non-generic, which avoids
 * that limit entirely.
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

export type JsonSchemaObjectType
  = & Omit<JsonSchemaDocumentObjectType, NestedSchemaKeysType | OwlOnlyKeysType>
  & {
    '$defs'?: Readonly<Record<string, JsonSchemaDefinitionType>>;
    'additionalProperties'?: JsonSchemaDefinitionType;
    'allOf'?: readonly JsonSchemaDefinitionType[];
    'anyOf'?: readonly JsonSchemaDefinitionType[];
    'contains'?: JsonSchemaDefinitionType;
    'contentSchema'?: JsonSchemaDefinitionType;
    'dependentSchemas'?: Readonly<Record<string, JsonSchemaDefinitionType>>;
    'else'?: JsonSchemaDefinitionType;
    'if'?: JsonSchemaDefinitionType;
    'items'?: JsonSchemaDefinitionType;
    'not'?: JsonSchemaDefinitionType;
    'oneOf'?: readonly JsonSchemaDefinitionType[];
    'patternProperties'?: Readonly<Record<string, JsonSchemaDefinitionType>>;
    'prefixItems'?: readonly JsonSchemaDefinitionType[];
    'properties'?: Readonly<Record<string, JsonSchemaDefinitionType>>;
    'propertyNames'?: JsonSchemaDefinitionType;
    'then'?: JsonSchemaDefinitionType;
    'unevaluatedItems'?: JsonSchemaDefinitionType;
    'unevaluatedProperties'?: JsonSchemaDefinitionType;
  };
