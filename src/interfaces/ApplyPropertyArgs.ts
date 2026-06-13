/**
 * ApplyPropertyArgs — arguments for applyPropertyToDomains in the Properties
 * dispatcher; carries the domain class list, property IRI, resolved shape, and
 * the mutable schema-delta map.
 */

import type { JsonSchemaDocumentObjectType } from '../types/Schema.js';

export interface ApplyPropertyArgs {
  readonly 'domains': string[];
  readonly 'propertyIri': string;
  readonly 'propShape': null | Record<string, unknown>;
  readonly 'schemaDeltas': Map<string, Partial<JsonSchemaDocumentObjectType>>;
}
