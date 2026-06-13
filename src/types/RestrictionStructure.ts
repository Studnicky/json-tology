/**
 * RestrictionStructure — the restriction variant of RelationStructure, extracted
 * for use in the PropertyRestrictions dispatcher.
 */

import type { RelationStructure } from './SchemaGraph.js';

export type RestrictionStructure = Extract<RelationStructure, { 'kind': 'restriction' }>;
