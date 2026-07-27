import type { JsonSchemaDocumentObjectType } from '../types/Schema.js';
import type { StringValueEntity } from '../entities/StringValueEntity.js';

/**
 * Arguments for applyPropertyToDomains in the Properties dispatcher; carries
 * the domain class list, property IRI, resolved shape, and the mutable
 * schema-delta map.
 */
export interface ApplyPropertyArgumentListInterface {
  'domains': StringValueEntity.Type[];
  'propertyIri': StringValueEntity.Type;
  'propShape': null | Record<string, unknown>;
  'schemaDeltas': Map<string, JsonSchemaDocumentObjectType>;
}
