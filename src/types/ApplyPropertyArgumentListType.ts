/**
 * ApplyPropertyArgumentListType — arguments for applyPropertyToDomains in the Properties
 * dispatcher; carries the domain class list, property IRI, resolved shape, and
 * the mutable schema-delta map.
 */

import type { JsonSchemaDocumentObjectType } from '../types/Schema.js';

export type ApplyPropertyArgumentListType = {
  'domains': string[];
  'propertyIri': string;
  'propShape': null | Record<string, unknown>;
  'schemaDeltas': Map<string, JsonSchemaDocumentObjectType>;
};
