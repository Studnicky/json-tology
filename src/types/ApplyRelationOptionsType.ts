/**
 * ApplyRelationOptionsType — options for applying a single graph relation to the
 * axiom delta map in the ClassAxioms dispatcher.
 */

import type { SchemaGraphRelationType } from './SchemaGraph.js';
import type { AxiomContextType } from './AxiomContextType.js';

export type ApplyRelationOptionsType
  = { 'axiomCtx': AxiomContextType }
    & { 'relation': SchemaGraphRelationType }
    & { 'subjectIri': string };
