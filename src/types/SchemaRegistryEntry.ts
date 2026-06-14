import type { CompiledValidatorType } from './Compiler.js';
import type { GraphEngineInterface } from '../interfaces/GraphEngineImpl.js';
import type { SchemaGraphInterface } from '../interfaces/SchemaGraphImpl.js';

export type SchemaRegistryEntryType = {
  'compiled'?: CompiledValidatorType;
  'engine'?: GraphEngineInterface;
  'graph'?: SchemaGraphInterface;
  'hasComputedFields': boolean;
  'hash': string;
  /**
   * True when a Transform decoder is attached to this schema's object at
   * registration time. Used by duplicate detection to give transform-bearing
   * schemas a distinct structural identity so they do not collide with
   * semantically plain schemas that share an identical JSON body.
   */
  'hasTransform': boolean;
  'refsChecked'?: boolean;
  'schema': Record<string, unknown>;
};
