import type { DefaultCreatorInterface } from './DefaultCreatorInterface.js';
import type { FormatRegistryInterface } from './FormatRegistryInterface.js';
import type { SchemaRegistryInterface } from './SchemaRegistryInterface.js';
import type { SchemaDepthLimitEntity } from '../entities/SchemaDepthLimitEntity.js';
import type { SchemaRegistrySharedOptionsInterface } from './SchemaRegistrySharedOptionsInterface.js';

export interface RegistryOptionsInterface extends SchemaRegistrySharedOptionsInterface {
  /**
   * Factory that builds the default-instance creator for `create()`. Injected
   * by the facade so the registry depends on {@link DefaultCreatorInterface}
   * rather than the higher `materialization` layer. When absent, `create()`
   * throws `SchemaError('SCHEMA_DEFAULT_CREATOR_MISSING')`.
   */
  'defaultCreatorFactory'?: (registry: SchemaRegistryInterface) => DefaultCreatorInterface;
  'formatRegistry'?: FormatRegistryInterface;
  'maxSchemaDepth'?: SchemaDepthLimitEntity.Type;
}
