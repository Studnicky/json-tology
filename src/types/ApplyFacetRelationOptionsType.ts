import type { SchemaGraphRelationType } from './SchemaGraph.js';

/**
 * Options bag for the `applyFacetRelation` helper in the Datatypes dispatcher.
 */
export type ApplyFacetRelationOptionsType = {
  readonly 'bnodeId': string;
  readonly 'delta': Record<string, unknown>;
  readonly 'fr': SchemaGraphRelationType;
  readonly 'reportUnsupported': (axiomIri: string, subjectIri: null | string) => void;
};
