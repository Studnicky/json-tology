import type { CompiledValidatorInterface } from './CompiledValidatorInterface.js';
import type { GraphEngineInterface } from './GraphEngineInterface.js';
import type { SchemaGraphInterface } from './SchemaGraphInterface.js';
import type { HasComputedFieldsFlagEntity } from '../entities/HasComputedFieldsFlagEntity.js';
import type { HashValueEntity } from '../entities/HashValueEntity.js';
import type { HasTransformFlagEntity } from '../entities/HasTransformFlagEntity.js';
import type { RefsCheckedFlagEntity } from '../entities/RefsCheckedFlagEntity.js';

export interface SchemaRegistryEntryInterface {
  'compiled'?: CompiledValidatorInterface;
  'engine'?: GraphEngineInterface;
  'graph'?: SchemaGraphInterface;
  'hasComputedFields': HasComputedFieldsFlagEntity.Type;
  'hash': HashValueEntity.Type;
  /**
   * True when a Transform decoder is attached to this schema's object at
   * registration time. Used by duplicate detection to give transform-bearing
   * schemas a distinct structural identity so they do not collide with
   * semantically plain schemas that share an identical JSON body.
   */
  'hasTransform': HasTransformFlagEntity.Type;
  'refsChecked'?: RefsCheckedFlagEntity.Type;
  'schema': Record<string, unknown>;
}
