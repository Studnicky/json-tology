import type { CurieInterface } from '../interfaces/CurieInterface.js';
import type { SchemaRegistryInterface } from '../interfaces/SchemaRegistryInterface.js';
import type { PredicateResolverFunctionType } from '../types/PredicateResolverFunctionType.js';
import type { IdentityType } from './IdentityType.js';

/** Internal args for liftInstancesImpl — bundles registry + LiftOptionsType. */
export type LiftImplArgumentListType = IdentityType<{
  'curie': CurieInterface | undefined;
  'predicateResolver': PredicateResolverFunctionType | undefined;
  'registry': SchemaRegistryInterface;
}>;
