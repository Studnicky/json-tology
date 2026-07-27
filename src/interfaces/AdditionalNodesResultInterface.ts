import type { SchemaGraphNodeInterface } from './SchemaGraphNodeInterface.js';

/**
 * Resolved `additionalItems`/`additionalProperties` semantics: a boolean
 * flag, a resolved child node, or undefined when the keyword is absent.
 *
 * @remarks
 * Used to compose the final `SchemaGraphSemanticsInterface` without repeating
 * resolution logic. Internal to `AdditionalSchemaNode.resolveAll` in
 * `src/modules/graph/SchemaGraphSupport.ts`.
 *
 * @category Graph
 * @since 0.18.0
 * @group Graph
 */
export interface AdditionalNodesResultInterface {
  'additionalItemsNode': boolean | SchemaGraphNodeInterface | undefined;
  'additionalPropertiesNode': boolean | SchemaGraphNodeInterface | undefined;
}
