import type { CompiledValidatorInterface } from './Compiler.js';
import type { GraphEngineInterface } from './GraphEngineImpl.js';
import type { SchemaGraphInterface } from './SchemaGraphImpl.js';

export interface SchemaRegistryEntryInterface {
  'compiled'?: CompiledValidatorInterface;
  'engine'?: GraphEngineInterface;
  'graph'?: SchemaGraphInterface;
  'hasComputedFields': boolean;
  'hasEmbeddedIds': boolean;
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
}
