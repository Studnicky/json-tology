/**
 * Schema visualization data structures.
 */

/**
 * Node in the schema relationship graph.
 */
export interface VizNodeInterface {
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
}

/**
 * Edge representing a relationship between schemas.
 */
export interface VizEdgeInterface {
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
}

/**
 * Schema data for visualization rendering.
 */
export interface VizSchemaDataInterface {
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
  readonly 'owl': unknown[];

  /**
   * SHACL shapes representation (RDF quads).
   */
  readonly 'shacl': unknown[];

  /**
   * Generated TypeScript type definition.
   */
  readonly 'typescript': string;
}

/**
 * Visualization payload containing collected schema graph data.
 */
export interface VizPayloadInterface {
  /**
   * Edges representing relationships between schemas.
   */
  readonly 'edges': VizEdgeInterface[];

  /**
   * Nodes representing registered schemas.
   */
  readonly 'nodes': VizNodeInterface[];

  /**
   * Detailed schema data for each registered schema.
   */
  readonly 'schemas': VizSchemaDataInterface[];
}
