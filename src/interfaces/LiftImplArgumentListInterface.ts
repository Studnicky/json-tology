import type { CurieInterface } from './CurieInterface.js';
import type { SchemaRegistryInterface } from './SchemaRegistryInterface.js';
import type { PredicateResolverInterface } from './PredicateResolverInterface.js';

/** Internal args for liftInstancesImpl — bundles registry + LiftOptionsInterface. */
export interface LiftImplArgumentListInterface {
  'curie': CurieInterface | undefined;
  'predicateResolver': PredicateResolverInterface | undefined;
  'registry': SchemaRegistryInterface;
}
