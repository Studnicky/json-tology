import type {
  NormIRInterface,
  SchemaGraphNodeInterface, SchemaGraphRelationInterface,
  SchemaGraphSemanticsInterface, StructureWarningInterface
} from '../../interfaces/schema-graph.js';
import type { SchemaGraphInterface } from '../../interfaces/schema-graph-impl.js';
import { isRecord } from '../data/DataTypes.js';
import { GraphError } from '../../errors/GraphError.js';
import {
  escapeJsonPointerSegment,
  extractRelations,
  extractSemantics,
  nodeIdFromPointer,
  resolveSchemaAtPointer,
  validateGraphStructure
} from './SchemaGraph.support.js';


type JsonSchemaType = boolean | Record<string, unknown>;

export class SchemaGraph implements SchemaGraphInterface {
  public static buildNormIR(rootSchema: JsonSchemaType): NormIRInterface {
    const graph = new SchemaGraph(rootSchema);

    return graph.getNormIR();
  }
  public static fromNormIR(normIR: NormIRInterface): SchemaGraph {
    const graph = Object.create(SchemaGraph.prototype) as SchemaGraph;

    // Initialize private maps via reflection (bypass constructor)
    const g = graph as unknown as Record<string, unknown>;

    g.anchorMap = new Map<string, SchemaGraphNodeInterface>();
    g.childMap = new WeakMap<SchemaGraphNodeInterface, Map<string, SchemaGraphNodeInterface>>();
    g.entryMap = new WeakMap<SchemaGraphNodeInterface, Map<string, Array<[string, SchemaGraphNodeInterface]>>>();
    g.identityMap = new WeakMap<object, SchemaGraphNodeInterface>();
    g.indexedChildMap = new WeakMap<SchemaGraphNodeInterface, Map<string, SchemaGraphNodeInterface[]>>();
    g.nodeMap = new Map<string, SchemaGraphNodeInterface>();
    g.relationMap = new WeakMap<SchemaGraphNodeInterface, SchemaGraphRelationInterface[]>();
    g.semanticMap = new WeakMap<SchemaGraphNodeInterface, SchemaGraphSemanticsInterface>();
    g.rootSchema = normIR.rootSchema;

    // Rebuild nodes from NormIR
    for (const normNode of normIR.nodes) {
      const schema = resolveSchemaAtPointer(normIR.rootSchema, normNode.pointer);
      const node: SchemaGraphNodeInterface = {
        'id': normNode.id,
        'pointer': normNode.pointer,
        schema
      };

      graph.nodeMap.set(normNode.pointer, node);
      if (isRecord(schema)) {
        graph.identityMap.set(schema, node);
      }
      graph.childMap.set(node, new Map());
      graph.entryMap.set(node, new Map());
      graph.indexedChildMap.set(node, new Map());
    }

    // Rebuild children
    for (const [
      pointer,
      childRecord
    ] of Object.entries(normIR.children)) {
      const parentNode = graph.nodeMap.get(pointer);

      if (parentNode === undefined) {
        continue;
      }
      const childMap = graph.childMap.get(parentNode)!;

      for (const [
        key,
        childPointer
      ] of Object.entries(childRecord)) {
        const childNode = graph.nodeMap.get(childPointer);

        if (childNode !== undefined) {
          childMap.set(key, childNode);
        }
      }
    }

    // Rebuild entries
    for (const [
      pointer,
      entryRecord
    ] of Object.entries(normIR.entries)) {
      const parentNode = graph.nodeMap.get(pointer);

      if (parentNode === undefined) {
        continue;
      }
      const entryMap = graph.entryMap.get(parentNode)!;

      for (const [
        key,
        entryList
      ] of Object.entries(entryRecord)) {
        const resolved: Array<[string, SchemaGraphNodeInterface]> = [];

        for (const [
          name,
          entryPointer
        ] of entryList) {
          const entryNode = graph.nodeMap.get(entryPointer);

          if (entryNode !== undefined) {
            resolved.push([
              name,
              entryNode
            ]);
          }
        }
        entryMap.set(key, resolved);
      }
    }

    // Rebuild indexedChildren
    for (const [
      pointer,
      indexedRecord
    ] of Object.entries(normIR.indexedChildren)) {
      const parentNode = graph.nodeMap.get(pointer);

      if (parentNode === undefined) {
        continue;
      }
      const indexedMap = graph.indexedChildMap.get(parentNode)!;

      for (const [
        key,
        pointers
      ] of Object.entries(indexedRecord)) {
        const resolved: SchemaGraphNodeInterface[] = [];

        for (const childPointer of pointers) {
          const childNode = graph.nodeMap.get(childPointer);

          if (childNode !== undefined) {
            resolved.push(childNode);
          }
        }
        indexedMap.set(key, resolved);
      }
    }

    // Rebuild anchors
    for (const [
      anchor,
      anchorPointer
    ] of Object.entries(normIR.anchors)) {
      const anchorNode = graph.nodeMap.get(anchorPointer);

      if (anchorNode !== undefined) {
        graph.anchorMap.set(anchor, anchorNode);
      }
    }

    return graph;
  }
  static resolvePointer(rootSchema: JsonSchemaType, pointer: string): JsonSchemaType {
    return resolveSchemaAtPointer(rootSchema, pointer);
  }
  private readonly anchorMap = new Map<string, SchemaGraphNodeInterface>();
  private readonly childMap = new WeakMap<SchemaGraphNodeInterface, Map<string, SchemaGraphNodeInterface>>();
  private readonly entryMap = new WeakMap<SchemaGraphNodeInterface, Map<string, Array<[string, SchemaGraphNodeInterface]>>>();
  private readonly identityMap = new WeakMap<object, SchemaGraphNodeInterface>();
  private readonly indexedChildMap = new WeakMap<SchemaGraphNodeInterface, Map<string, SchemaGraphNodeInterface[]>>();

  private readonly nodeMap = new Map<string, SchemaGraphNodeInterface>();

  private readonly relationMap = new WeakMap<SchemaGraphNodeInterface, SchemaGraphRelationInterface[]>();

  private readonly semanticMap = new WeakMap<SchemaGraphNodeInterface, SchemaGraphSemanticsInterface>();

  public constructor(public readonly rootSchema: JsonSchemaType) {
    this.lower(rootSchema, '');
  }

  public allRelations(): SchemaGraphRelationInterface[] {
    const result: SchemaGraphRelationInterface[] = [];

    for (const node of this.nodeMap.values()) {
      result.push(...this.relations(node));
    }

    return result;
  }

  public child(node: SchemaGraphNodeInterface, key: string): SchemaGraphNodeInterface | undefined {
    return this.childMap.get(node)?.get(key);
  }

  public entries(node: SchemaGraphNodeInterface, key: string): Array<[string, SchemaGraphNodeInterface]> {
    return this.entryMap.get(node)?.get(key) ?? [];
  }

  public getNormIR(): NormIRInterface {
    const nodes: Array<{ 'id': string;
      'pointer': string }> = [];
    const children: Record<string, Record<string, string>> = {};
    const entries: Record<string, Record<string, Array<[string, string]>>> = {};
    const indexedChildren: Record<string, Record<string, string[]>> = {};
    const anchors: Record<string, string> = {};

    for (const node of this.nodeMap.values()) {
      nodes.push({
        'id': node.id,
        'pointer': node.pointer
      });

      const nodeChildren = this.childMap.get(node);

      if (nodeChildren !== undefined && nodeChildren.size > 0) {
        const childRecord: Record<string, string> = {};

        for (const [
          key,
          childNode
        ] of nodeChildren) {
          childRecord[key] = childNode.pointer;
        }
        children[node.pointer] = childRecord;
      }

      const nodeEntries = this.entryMap.get(node);

      if (nodeEntries !== undefined && nodeEntries.size > 0) {
        const entryRecord: Record<string, Array<[string, string]>> = {};

        for (const [
          key,
          entryList
        ] of nodeEntries) {
          entryRecord[key] = entryList.map(([
            name,
            entryNode
          ]) => {
            return [
              name,
              entryNode.pointer
            ];
          });
        }
        entries[node.pointer] = entryRecord;
      }

      const nodeIndexed = this.indexedChildMap.get(node);

      if (nodeIndexed !== undefined && nodeIndexed.size > 0) {
        const indexedRecord: Record<string, string[]> = {};

        for (const [
          key,
          indexedList
        ] of nodeIndexed) {
          indexedRecord[key] = indexedList.map((n) => {
            return n.pointer;
          });
        }
        indexedChildren[node.pointer] = indexedRecord;
      }
    }

    for (const [
      anchor,
      anchorNode
    ] of this.anchorMap) {
      anchors[anchor] = anchorNode.pointer;
    }

    return {
      anchors,
      children,
      entries,
      indexedChildren,
      nodes,
      'rootSchema': this.rootSchema
    };
  }

  public indexedChildren(node: SchemaGraphNodeInterface, key: string): SchemaGraphNodeInterface[] {
    return this.indexedChildMap.get(node)?.get(key) ?? [];
  }

  public keywordValue(node: SchemaGraphNodeInterface, key: string): unknown {
    if (!isRecord(node.schema)) {
      return undefined;
    }

    return node.schema[key];
  }

  private lower(schema: JsonSchemaType, pointer: string): void {
    const id = nodeIdFromPointer(this.rootSchema, pointer, schema);
    const node = {
      id,
      pointer,
      schema
    };

    this.nodeMap.set(pointer, node);
    if (isRecord(schema)) {
      this.identityMap.set(schema, node);
    }
    this.childMap.set(node, new Map());
    this.entryMap.set(node, new Map());
    this.indexedChildMap.set(node, new Map());

    if (!isRecord(schema)) {
      return;
    }

    if (typeof schema.$anchor === 'string') {
      this.anchorMap.set(schema.$anchor, this.nodeMap.get(pointer) as SchemaGraphNodeInterface);
    }
    if (typeof schema.$dynamicAnchor === 'string') {
      this.anchorMap.set(schema.$dynamicAnchor, this.nodeMap.get(pointer) as SchemaGraphNodeInterface);
    }

    for (const [
      key,
      value
    ] of Object.entries(schema)) {
      if (typeof value === 'boolean' || isRecord(value)) {
        const childPointer = `${pointer}/${escapeJsonPointerSegment(key)}`;

        this.lower(value as JsonSchemaType, childPointer);
        this.childMap.get(node)?.set(key, this.nodeMap.get(childPointer) as SchemaGraphNodeInterface);

        if (isRecord(value)) {
          const entries: Array<[string, SchemaGraphNodeInterface]> = [];

          for (const entryKey of Object.keys(value)) {
            const entryValue = value[entryKey];

            if (!isRecord(entryValue) && typeof entryValue !== 'boolean') {
              continue;
            }

            const entryPointer = `${childPointer}/${escapeJsonPointerSegment(entryKey)}`;

            entries.push([
              entryKey,
              this.nodeMap.get(entryPointer) as SchemaGraphNodeInterface
            ]);
          }

          if (entries.length > 0) {
            this.entryMap.get(node)?.set(key, entries);
          }
        }
        continue;
      }
      if (!Array.isArray(value)) {
        continue;
      }

      const indexedChildren: SchemaGraphNodeInterface[] = [];

      for (const [
        index,
        element
      ] of value.entries()) {
        if (typeof element === 'boolean' || isRecord(element)) {
          const elementPointer = `${pointer}/${escapeJsonPointerSegment(key)}/${index}`;

          this.lower(element as JsonSchemaType, elementPointer);
          indexedChildren.push(this.nodeMap.get(elementPointer) as SchemaGraphNodeInterface);
        }
      }

      if (indexedChildren.length > 0) {
        this.indexedChildMap.get(node)?.set(key, indexedChildren);
      }
    }
  }

  public node(schema: Record<string, unknown>): SchemaGraphNodeInterface | undefined {
    return this.identityMap.get(schema);
  }

  public nodes(): SchemaGraphNodeInterface[] {
    return [...this.nodeMap.values()];
  }

  public relations(node: SchemaGraphNodeInterface): SchemaGraphRelationInterface[] {
    const cached = this.relationMap.get(node);

    if (cached !== undefined) {
      return cached;
    }

    const relations = extractRelations(this, node, this.nodeMap);

    this.relationMap.set(node, relations);

    return relations;
  }

  public resolveFragment(fragment: string): SchemaGraphNodeInterface {
    if (fragment === '') {
      return this.rootNode;
    }
    if (fragment.startsWith('/')) {
      return this.resolvePointer(fragment);
    }

    const anchored = this.anchorMap.get(fragment);

    if (anchored === undefined) {
      throw new GraphError('ANCHOR_NOT_FOUND', `Unknown schema anchor: #${fragment}`, fragment);
    }

    return anchored;
  }

  private resolveLocalRef(ref: string): SchemaGraphNodeInterface {
    if (ref === '#') {
      return this.rootNode;
    }
    if (ref.startsWith('#/')) {
      return this.resolvePointer(ref.slice(1));
    }

    return this.resolveFragment(ref.slice(1));
  }

  public resolvePointer(pointer: string): SchemaGraphNodeInterface {
    if (pointer === '') {
      return this.rootNode;
    }
    if (!pointer.startsWith('/')) {
      throw new GraphError('POINTER_INVALID', `Invalid JSON Pointer: ${pointer}`, pointer);
    }

    const resolved = this.nodeMap.get(pointer);

    if (resolved === undefined) {
      throw new GraphError('POINTER_NOT_FOUND', `Pointer not found: ${pointer}`, pointer);
    }

    return resolved;
  }

  public resolveRefId(ref: string): string {
    if (!ref.startsWith('#')) {
      return ref;
    }

    return this.resolveLocalRef(ref).id;
  }

  public get rootNode(): SchemaGraphNodeInterface {
    return this.nodeMap.get('') as SchemaGraphNodeInterface;
  }

  public semantics(node: SchemaGraphNodeInterface): SchemaGraphSemanticsInterface {
    const cached = this.semanticMap.get(node);

    if (cached !== undefined) {
      return cached;
    }

    const sem = extractSemantics(this, node, this.resolveLocalRef.bind(this));

    this.semanticMap.set(node, sem);

    return sem;
  }

  public validateStructure(): StructureWarningInterface[] {
    return validateGraphStructure(this.nodeMap);
  }
}
