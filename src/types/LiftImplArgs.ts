import type { CurieInterface } from '../interfaces/Curie.js';
import type { SchemaRegistryInterface } from '../interfaces/SchemaRegistry.js';
import type { PredicateResolverFnType } from '../types/PredicateResolverFn.js';

/** Internal args for liftInstancesImpl — bundles registry + LiftOptionsType. */
export type LiftImplArgsType = {
  readonly 'curie': CurieInterface | undefined;
  readonly 'predicateResolver': PredicateResolverFnType | undefined;
  readonly 'registry': SchemaRegistryInterface;
};
