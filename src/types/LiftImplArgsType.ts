import type { CurieInterface } from '../interfaces/CurieInterface.js';
import type { SchemaRegistryInterface } from '../interfaces/SchemaRegistryInterface.js';
import type { PredicateResolverFnType } from '../types/PredicateResolverFnType.js';

/** Internal args for liftInstancesImpl — bundles registry + LiftOptionsType. */
export type LiftImplArgsType = {
  readonly 'curie': CurieInterface | undefined;
  readonly 'predicateResolver': PredicateResolverFnType | undefined;
  readonly 'registry': SchemaRegistryInterface;
};
