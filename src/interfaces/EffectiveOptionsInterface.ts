import type { SchemaGraphInterface } from './SchemaGraphInterface.js';
import type { BooleanValueEntity } from '../entities/BooleanValueEntity.js';
import type { NumberValueEntity } from '../entities/NumberValueEntity.js';

/**
 * Effective (fully resolved) `GraphEngine` options after defaults are applied.
 *
 * @remarks
 * Every `GraphEngineOptionsInterface` field that carries a static default is
 * required here. `lookupGraph` and `lookupSchema` have no static default and
 * stay optional.
 */
export interface EffectiveOptionsInterface {
  'allowAdditionalProperties': BooleanValueEntity.Type;
  'applyDefaults': BooleanValueEntity.Type;
  'castTypes': BooleanValueEntity.Type;
  'collectErrors': BooleanValueEntity.Type;
  'enforceSchemaProperties': BooleanValueEntity.Type;
  'lookupGraph'?: (schemaId: string) => SchemaGraphInterface | undefined;
  'lookupSchema'?: (schemaId: string) => Record<string, unknown> | undefined;
  'materializeContainers': BooleanValueEntity.Type;
  'maxSchemaDepth': NumberValueEntity.Type;
  'removeAdditionalProperties': BooleanValueEntity.Type;
  'synthesizeDefaults': BooleanValueEntity.Type;
}
