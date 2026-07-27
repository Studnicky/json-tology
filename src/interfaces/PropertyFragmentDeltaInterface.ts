/**
 * PropertyFragmentDeltaInterface — schema-delta and characteristic accumulation
 * produced by Properties.buildFragmentFromEntries, later merged into the
 * full OwlImportFragmentInterface returned by Properties.dispatch.
 */

import type { JsonSchemaDocumentObjectType } from '../types/Schema.js';
import type { PropertyCharacteristicEntity } from '../entities/PropertyCharacteristicEntity.js';

export interface PropertyFragmentDeltaInterface {
  'characteristics': PropertyCharacteristicEntity.Type[];
  'schemaDeltas': Map<string, JsonSchemaDocumentObjectType>;
}
