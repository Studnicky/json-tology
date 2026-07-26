/**
 * ApplyRelationOptionsInterface — options for applying a single graph relation to the
 * axiom delta map in the ClassAxioms dispatcher.
 */

import type { SchemaGraphRelationInterface } from './SchemaGraphRelationInterface.js';
import type { AxiomContextInterface } from './AxiomContextInterface.js';
import type { StringValueEntity } from '../entities/StringValueEntity.js';

export interface ApplyRelationOptionsInterface {
  'axiomCtx': AxiomContextInterface;
  'relation': SchemaGraphRelationInterface;
  'subjectIri': StringValueEntity.Type;
}
