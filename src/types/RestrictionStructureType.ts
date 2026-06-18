/**
 * RestrictionStructureType — the restriction variant of RelationStructureType, extracted
 * for use in the PropertyRestrictions dispatcher.
 */

import type { RelationStructureType } from './SchemaGraph.js';

export type RestrictionStructureType = Extract<RelationStructureType, { 'kind': 'restriction' }>;
