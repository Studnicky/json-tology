/**
 * PropertyFragmentDeltaType — schema-delta and characteristic accumulation
 * produced by Properties.buildFragmentFromEntries, later merged into the
 * full OwlImportFragmentType returned by Properties.dispatch.
 */

import type { JsonSchemaDocumentObjectType } from './Schema.js';

export type PropertyFragmentDeltaType = {
  'characteristics': Array<{ 'characteristic': string;
    'propertyIri': string }>;
  'schemaDeltas': Map<string, JsonSchemaDocumentObjectType>;
};
