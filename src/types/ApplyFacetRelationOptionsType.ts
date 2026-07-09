import type { SchemaGraphRelationType } from './SchemaGraph.js';

/**
 * Options bag for the `applyFacetRelation` helper in the Datatypes dispatcher.
 */
export type ApplyFacetRelationOptionsType = {
  'bnodeId': string;
  'delta': Record<string, unknown>;
  'fr': SchemaGraphRelationType;
  'reportUnsupported': (axiomIri: string, subjectIri: null | string) => void;
};
