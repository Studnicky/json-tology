import type { FormatRegistryInterface } from './FormatRegistryInterface.js';
import type { GraphEngineRestOptionsInterface } from './GraphEngineRestOptionsInterface.js';
import type { KeywordDefinitionInterface } from './KeywordDefinitionInterface.js';
import type { LoggerInterface } from './LoggerInterface.js';

/**
 * Runtime options controlling how a `GraphEngine` validates and transforms data.
 *
 * @remarks
 * All fields are optional. Unset options fall back to the engine's compiled
 * defaults, which are derived from the registered schema. Options passed to
 * `GraphEngine.execute` take precedence over the instance-level options
 * supplied at construction time.
 *
 * Notable options:
 * - `castTypes` — coerce string/number inputs to the declared schema type.
 * - `applyDefaults` / `synthesizeDefaults` — populate missing fields from schema defaults.
 * - `collectErrors` — accumulate all validation errors rather than stopping at the first.
 * - `allowAdditionalProperties` / `removeAdditionalProperties` — relax or strip
 *   properties not declared in the schema.
 * - `maxSchemaDepth` — guard against deeply nested or recursive schemas.
 *
 * Authored as an interface rather than a schema-derived entity: `formatRegistry`,
 * `logger`, `lookupGraph`, and `lookupSchema` are behavioral/callable, not
 * JSON-representable data.
 *
 * @category GraphEngine
 * @since 0.1.0
 * @group GraphEngine
 */
export interface GraphEngineOptionsInterface extends GraphEngineRestOptionsInterface {
  'formatRegistry'?: FormatRegistryInterface;
  'keywords'?: KeywordDefinitionInterface[];
  'logger'?: LoggerInterface;
}
