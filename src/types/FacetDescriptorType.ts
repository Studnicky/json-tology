/**
 * FacetDescriptorType — JSON-Schema keyword descriptor for an XSD facet.
 *
 * Used by the canonical XSD facet table (src/constants/XSD_FACETS.ts) to map
 * each XSD facet to the JSON Schema keyword (or handling mode) it corresponds
 * to when importing owl:withRestrictions blocks.
 */

import type { JsonSchemaDocumentObjectType } from './Schema.js';

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
