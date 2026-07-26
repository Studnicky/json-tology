/**
 * ApplyBnodeLiteralOptionsInterface — options for the blank-node / literal
 * equivalentClass arm helpers in the ClassAxioms dispatcher.
 */

import type { SchemaGraphInterface } from './SchemaGraphInterface.js';
import type { AxiomContextInterface } from './AxiomContextInterface.js';

export interface ApplyBnodeLiteralOptionsInterface {
  'axiomCtx': AxiomContextInterface;
  'graph': SchemaGraphInterface;
}
