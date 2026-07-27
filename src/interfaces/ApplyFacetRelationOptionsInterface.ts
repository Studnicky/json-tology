import type { StringValueEntity } from '../entities/StringValueEntity.js';
import type { SchemaGraphRelationInterface } from './SchemaGraphRelationInterface.js';

/** Options bag for the `applyFacetRelation` helper in the Datatypes dispatcher. */
export interface ApplyFacetRelationOptionsInterface {
  'bnodeId': StringValueEntity.Type;
  'delta': Record<string, unknown>;
  'fr': SchemaGraphRelationInterface;
  'reportUnsupported': (axiomIri: string, subjectIri: null | string) => void;
}
