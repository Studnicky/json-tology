import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';

/**
 * Effective (fully resolved) `GraphEngine` options after defaults are applied.
 *
 * @remarks
 * Spells out, via `Record` intersection, every `GraphEngineOptionsType` field
 * that carries a static default as required — exactly the fields the prior
 * `Required<Omit<GraphEngineOptionsType, ...>>` derivation produced
 * positionally. `lookupGraph` and `lookupSchema` have no static default and
 * stay optional, spelled out explicitly via `Partial<Record<...>>` rather
 * than `Pick<GraphEngineOptionsType, ...>`.
 */
export type EffectiveOptionsType = Partial<Record<'lookupGraph', (schemaId: string) => SchemaGraphInterface | undefined>>
  & Partial<Record<'lookupSchema', (schemaId: string) => Record<string, unknown> | undefined>>
  & Record<'allowAdditionalProperties', boolean>
  & Record<'applyDefaults', boolean>
  & Record<'castTypes', boolean>
  & Record<'collectErrors', boolean>
  & Record<'enforceSchemaProperties', boolean>
  & Record<'materializeContainers', boolean>
  & Record<'maxSchemaDepth', number>
  & Record<'removeAdditionalProperties', boolean>
  & Record<'synthesizeDefaults', boolean>;
