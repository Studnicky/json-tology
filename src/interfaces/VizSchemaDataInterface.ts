import type { QuadInterface } from './QuadInterface.js';
import type { IriEntity } from '../entities/IriEntity.js';
import type { TypeScriptSourceEntity } from '../entities/TypeScriptSourceEntity.js';

/**
 * Schema data for visualization rendering.
 */
export interface VizSchemaDataInterface {
  /**
   * Schema ID (IRI).
   */
  'id': IriEntity.Type;

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
  'typescript': TypeScriptSourceEntity.Type;
}
