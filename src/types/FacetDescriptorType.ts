/**
 * FacetDescriptorType — JSON-Schema keyword descriptor for an XSD facet.
 *
 * Used by the canonical XSD facet table (src/constants/XSD_FACETS.ts) to map
 * each XSD facet to the JSON Schema keyword (or handling mode) it corresponds
 * to when importing owl:withRestrictions blocks.
 */

import type { JsonSchemaDocumentObjectType } from './Schema.js';

// No-fix exception: `@studnicky/type-alias-invariants` flags this alias because
// two variants' `key` member is `keyof JsonSchemaDocumentObjectType` — a
// TypeScript-only key-introspection computation with no JSON Schema
// representation. Widening `key` to a plain string would drop compile-time
// verification that every facet maps to a real JSON Schema keyword, which is
// the entire point of the field; there is no schema-derivable equivalent.
export type FacetDescriptorType
  = | { 'key': keyof JsonSchemaDocumentObjectType;
    'kind': 'numeric' }
  | { 'key': keyof JsonSchemaDocumentObjectType;
    'kind': 'string' }
  | { 'kind': 'fractionDigits' }
  | { 'kind': 'ignore' }
  | { 'kind': 'length' }
  | { 'kind': 'unsupported';
    'predicate': string };
