/**
 * ApplyRelationOptions — options for applying a single graph relation to the
 * axiom delta map in the ClassAxioms dispatcher.
 */

import type { SchemaGraphRelationInterface } from './SchemaGraph.js';
import type { AxiomContext } from './AxiomContext.js';

export interface ApplyRelationOptions {
  readonly 'axiomCtx': AxiomContext;
  readonly 'relation': SchemaGraphRelationInterface;
  readonly 'subjectIri': string;
}
