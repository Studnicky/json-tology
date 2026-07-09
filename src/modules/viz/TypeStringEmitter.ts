/**
 * Generates TypeScript type definitions from schema graphs.
 */

import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphInterface.js';
import type {
  SchemaGraphNodeType, SchemaGraphSemanticsType
} from '../../types/SchemaGraph.js';

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

    // Strip any file extension, then upper-case the first character while
    // preserving the rest so PascalCase ids (e.g. "TreeNode") stay intact.
    const base = lastSegment.split('.')[0] ?? 'Root';

    if (base.length === 0) {
      return 'Root';
    }

    return base.charAt(0).toUpperCase() + base.slice(1);
  }

  /**
   * Generates a TypeScript type definition string for the schema.
   *
   * @returns TypeScript type definition code
   */
  public emit(): string {
    const rootNode = this.graph.rootNode;
    const rootSchema = this.graph.rootSchema;

    if (typeof rootSchema !== 'object') {
      return 'type Root = unknown;';
    }

    const schemaId = (rootSchema).$id;
    const typeName = this.deriveTypeName(schemaId);
    const visited = new Set<string>();
    const body = this.renderNode(rootNode, visited);

    return `type ${typeName} = ${body};`;
  }

  /**
   * Returns a property key formatted for use in a TS type literal.
   * Valid identifiers are returned as-is; others are quoted.
   */
  private formatKey(key: string): string {
    // A valid JS identifier: starts with letter/$/_; followed by alphanumeric/$/_
    if (/^[A-Za-z_$][\w$]*$/u.test(key)) {
      return key;
    }

    return JSON.stringify(key);
  }

  private renderArray(sem: SchemaGraphSemanticsType, visited: Set<string>): string {
    // Tuple from prefixItems
    if (sem.prefixItems.length > 0) {
      const members = sem.prefixItems.map((n) => {
        const result = this.renderNode(n, visited);

        return result;
      });

      return `[${members.join(', ')}]`;
    }

    // Homogeneous array from items
    if (sem.itemsNode !== undefined) {
      const itemType = this.renderNode(sem.itemsNode, visited);

      return `${itemType}[]`;
    }

    return 'unknown[]';
  }

  private renderLiteral(value: unknown): string {
    if (value === null) {
      return 'null';
    }
    if (typeof value === 'string') {
      return JSON.stringify(value);
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    return 'unknown';
  }

  private renderNode(node: SchemaGraphNodeType, visited: Set<string>): string {
    const sem = this.graph.semantics(node);

    // $ref: render as named type to avoid infinite expansion
    if (sem.ref !== undefined) {
      if (sem.refTargetNode !== undefined) {
        const targetSem = this.graph.semantics(sem.refTargetNode);
        const targetId = targetSem.schemaId ?? sem.refTargetNode.id;

        return this.deriveTypeName(targetId);
      }

      // ref present but no resolved target — use the ref IRI's last segment
      return this.deriveTypeName(sem.ref);
    }

    // Cycle guard: if we've already started rendering this node, emit a named ref
    if (visited.has(node.id)) {
      const sem2 = this.graph.semantics(node);
      const id = sem2.schemaId ?? node.id;

      return this.deriveTypeName(id);
    }

    visited.add(node.id);

    try {
      return this.renderSemantics(sem, visited);
    } finally {
      visited.delete(node.id);
    }
  }

  private renderObject(sem: SchemaGraphSemanticsType, visited: Set<string>): string {
    const {
      additionalPropertiesNode, properties, required
    } = sem;

    if (properties.size === 0) {
      // No declared properties — check additionalProperties
      if (additionalPropertiesNode === true) {
        return 'Record<string, unknown>';
      }
      if (additionalPropertiesNode !== undefined && additionalPropertiesNode !== false) {
        const valueType = this.renderNode(additionalPropertiesNode, visited);

        return `Record<string, ${valueType}>`;
      }

      return 'Record<string, unknown>';
    }

    const requiredSet = new Set(required);
    const lines: string[] = [];

    for (const [
      key,
      propNode
    ] of properties) {
      const propType = this.renderNode(propNode, visited);
      const isRequired = requiredSet.has(key);
      const escapedKey = this.formatKey(key);
      const separator = isRequired ? ':' : '?:';

      lines.push(`  ${escapedKey}${separator} ${propType}`);
    }

    // If additionalProperties allows extra keys, append an index signature
    if (additionalPropertiesNode === true) {
      lines.push('  [key: string]: unknown');
    } else if (additionalPropertiesNode !== undefined && additionalPropertiesNode !== false) {
      const valueType = this.renderNode(additionalPropertiesNode, visited);

      lines.push(`  [key: string]: ${valueType}`);
    }

    return `{\n${lines.join(';\n')};\n}`;
  }

  private renderPrimitive(jsonType: string): string {
    switch (jsonType) {
      case 'boolean': return 'boolean';
      case 'integer': return 'number';
      case 'null': return 'null';
      case 'number': return 'number';
      case 'string': return 'string';
      default: return 'unknown';
    }
  }

  private renderSemantics(sem: SchemaGraphSemanticsType, visited: Set<string>): string {
    // const
    if (sem.hasConst) {
      return this.renderLiteral(sem.constValue);
    }

    // enum
    if (sem.enumValues !== undefined && sem.enumValues.length > 0) {
      return sem.enumValues.map((enumValue) => {
        const result = this.renderLiteral(enumValue);

        return result;
      }).join(' | ');
    }

    // anyOf / oneOf → union
    const anyOf = sem.anyOf;
    const oneOf = sem.oneOf;
    let unionMembers: SchemaGraphNodeType[] | undefined;

    if (anyOf.length > 0) {
      unionMembers = anyOf;
    } else if (oneOf.length > 0) {
      unionMembers = oneOf;
    }

    if (unionMembers !== undefined && unionMembers.length > 0) {
      return unionMembers.map((n) => {
        const result = this.renderNode(n, visited);

        return result;
      }).join(' | ');
    }

    // allOf → intersection
    if (sem.allOf.length > 0) {
      return sem.allOf.map((n) => {
        const result = this.renderNode(n, visited);

        return result;
      }).join(' & ');
    }

    // Determine active types
    const schemaTypes = sem.schemaTypes;
    const hasObject = schemaTypes.includes('object') || sem.properties.size > 0;
    const hasArray = schemaTypes.includes('array');

    if (hasObject) {
      return this.renderObject(sem, visited);
    }

    if (hasArray) {
      return this.renderArray(sem, visited);
    }

    // Primitives — may be multi-type union
    if (schemaTypes.length > 0) {
      return schemaTypes.map((jsonType) => {
        const result = this.renderPrimitive(jsonType);

        return result;
      }).join(' | ');
    }

    return 'unknown';
  }
}
