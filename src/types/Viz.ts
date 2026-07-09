/**
 * Schema visualization data structures.
 */

import type { QuadInterface } from '../interfaces/QuadInterface.js';

/**
 * Node in the schema relationship graph.
 */
export type VizNodeType = {
  /**
   * Schema ID (IRI).
   */
  'id': string;

  /**
   * Human-readable label for the schema.
   */
  'label': string;

  /**
   * Number of properties defined in the schema.
   */
  'propertyCount': number;

  /**
   * JSON Schema type constraints (e.g., `['object', 'null']`).
   */
  'schemaTypes': string[];
};

/**
 * Edge representing a relationship between schemas.
 */
export type VizEdgeType = {
  /**
   * Property or relationship name.
   */
  'label': string;

  /**
   * Source schema ID.
   */
  'source': string;

  /**
   * Target schema ID.
   */
  'target': string;
};

/**
 * Schema data for visualization rendering.
 */
export type VizSchemaDataType = {
  /**
   * Schema ID (IRI).
   */
  'id': string;

  /**
   * Reconstructed JSON Schema.
   */
  'jsonSchema': Record<string, unknown>;

  /**
   * OWL ontology representation (RDF quads).
   */
  'owl': QuadInterface[];

  /**
   * SHACL shapes representation (RDF quads).
   */
  'shacl': QuadInterface[];

  /**
   * Generated TypeScript type definition.
   */
  'typescript': string;
};

/**
 * Visualization payload containing collected schema graph data.
 */
export type VizPayloadType = {
  /**
   * Edges representing relationships between schemas.
   */
  'edges': VizEdgeType[];

  /**
   * Nodes representing registered schemas.
   */
  'nodes': VizNodeType[];

  /**
   * Detailed schema data for each registered schema.
   */
  'schemas': VizSchemaDataType[];
};
