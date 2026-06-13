/**
 * ApplyBnodeLiteralOptions — options for the blank-node / literal
 * equivalentClass arm helpers in the ClassAxioms dispatcher.
 */

import type { SchemaGraphInterface } from './SchemaGraphImpl.js';
import type { AxiomContext } from './AxiomContext.js';

export interface ApplyBnodeLiteralOptions {
  readonly 'axiomCtx': AxiomContext;
  readonly 'graph': SchemaGraphInterface;
}
