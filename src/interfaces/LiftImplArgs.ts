import type { CurieInterface } from './Curie.js';
import type { SchemaRegistryInterface } from './SchemaRegistry.js';
import type { PredicateResolverFnType } from '../types/PredicateResolverFn.js';

/** Internal args for liftInstancesImpl — bundles registry + LiftOptionsInterface. */
export interface LiftImplArgsInterface {
  readonly 'curie': CurieInterface | undefined;
  readonly 'predicateResolver': PredicateResolverFnType | undefined;
  readonly 'registry': SchemaRegistryInterface;
}
