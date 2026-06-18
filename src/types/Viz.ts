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
  readonly 'id': string;

  /**
   * Human-readable label for the schema.
   */
  readonly 'label': string;

  /**
   * Number of properties defined in the schema.
   */
  readonly 'propertyCount': number;

  /**
   * JSON Schema type constraints (e.g., `['object', 'null']`).
   */
  readonly 'schemaTypes': string[];
};

/**
 * Edge representing a relationship between schemas.
 */
export type VizEdgeType = {
  /**
   * Property or relationship name.
   */
  readonly 'label': string;

  /**
   * Source schema ID.
   */
  readonly 'source': string;

  /**
   * Target schema ID.
   */
  readonly 'target': string;
};

/**
 * Schema data for visualization rendering.
 */
export type VizSchemaDataType = {
  /**
   * Schema ID (IRI).
   */
  readonly 'id': string;

  /**
   * Reconstructed JSON Schema.
   */
  readonly 'jsonSchema': Record<string, unknown>;

  /**
   * OWL ontology representation (RDF quads).
   */
  readonly 'owl': readonly QuadInterface[];

  /**
   * SHACL shapes representation (RDF quads).
   */
  readonly 'shacl': readonly QuadInterface[];

  /**
   * Generated TypeScript type definition.
   */
  readonly 'typescript': string;
};

/**
 * Visualization payload containing collected schema graph data.
 */
export type VizPayloadType = {
  /**
   * Edges representing relationships between schemas.
   */
  readonly 'edges': VizEdgeType[];

  /**
   * Nodes representing registered schemas.
   */
  readonly 'nodes': VizNodeType[];

  /**
   * Detailed schema data for each registered schema.
   */
  readonly 'schemas': VizSchemaDataType[];
};
