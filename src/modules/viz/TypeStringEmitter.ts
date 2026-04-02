/**
 * Generates TypeScript type definitions from schema graphs.
 */

import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';

/**
 * Emits TypeScript type definitions derived from a schema graph.
 */
export class TypeStringEmitter {
  private readonly graph: SchemaGraphInterface;

  /**
   * Creates a new TypeScript type emitter.
   *
   * @param graph - The schema graph to generate types from
   */
  public constructor(graph: SchemaGraphInterface) {
    this.graph = graph;
  }

  private deriveTypeName(schemaId: unknown): string {
    if (typeof schemaId !== 'string') {
      return 'Root';
    }

    const segments = schemaId.split('/');
    const lastSegment = segments.at(-1) ?? 'Root';

    // Remove extension and capitalize
    const base = lastSegment.split('.')[0] ?? 'Root';
    const capitalized = base.charAt(0).toUpperCase() + base.slice(1).toLowerCase();

    return capitalized;
  }

  /**
   * Generates a TypeScript type definition string for the schema.
   *
   * @returns TypeScript type definition code
   */
  public emit(): string {
    const rootSchema = this.graph.rootSchema;

    if (typeof rootSchema !== 'object') {
      return 'type Root = unknown;';
    }

    const schemaId = (rootSchema).$id;
    const typeName = this.deriveTypeName(schemaId);

    // Placeholder implementation: generate a basic type definition
    return `type ${typeName} = Record<string, unknown>;`;
  }
}
