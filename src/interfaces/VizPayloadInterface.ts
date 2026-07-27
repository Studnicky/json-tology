import type { VizSchemaDataInterface } from './VizSchemaDataInterface.js';
import type { VizEdgeEntity } from '../entities/VizEdgeEntity.js';
import type { VizNodeEntity } from '../entities/VizNodeEntity.js';

/**
 * Visualization payload containing collected schema graph data.
 */
export interface VizPayloadInterface {
  /**
   * Edges representing relationships between schemas.
   */
  'edges': VizEdgeEntity.Type[];

  /**
   * Nodes representing registered schemas.
   */
  'nodes': VizNodeEntity.Type[];

  /**
   * Detailed schema data for each registered schema.
   */
  'schemas': VizSchemaDataInterface[];
}
