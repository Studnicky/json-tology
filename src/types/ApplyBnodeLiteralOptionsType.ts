/**
 * ApplyBnodeLiteralOptionsType — options for the blank-node / literal
 * equivalentClass arm helpers in the ClassAxioms dispatcher.
 */

import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';
import type { AxiomContextType } from './AxiomContextType.js';

export type ApplyBnodeLiteralOptionsType
  = { 'axiomCtx': AxiomContextType }
    & { 'graph': SchemaGraphInterface };
