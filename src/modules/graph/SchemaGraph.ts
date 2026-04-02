import type {
  NormIRInterface,
  SchemaGraphNodeInterface, SchemaGraphRelationInterface,
  SchemaGraphSemanticsInterface, StructureWarningInterface
} from '../../interfaces/SchemaGraph.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';
import type { VocabularyPluginInterface } from '../../interfaces/VocabularyPlugin.js';
import { isRecord } from '../data/DataTypes.js';
import { GraphError } from '../../errors/GraphError.js';
import { extractRelations } from './schemaGraphRelations.js';
import {
  escapeJsonPointerSegment,
  extractSemantics,
  nodeIdFromPointer,
  resolveSchemaAtPointer,
  validateGraphStructure
} from './schemaGraphSupport.js';
import type { JsonSchemaType } from '../../types/Schema.js';

export class SchemaGraph implements SchemaGraphInterface {
  /**
   * Builds a normalized intermediate representation from a root schema.
   *
   * @param rootSchema - The JSON Schema to lower into a NormIR.
   * @returns The serializable normalized intermediate representation.
   */
  public static buildNormIR(rootSchema: JsonSchemaType): NormIRInterface {
    const graph = new SchemaGraph(rootSchema);

    return graph.getNormIR();
  }
  /**
   * Reconstructs a SchemaGraph from a previously serialized NormIR.
   *
   * @param normIR - The normalized intermediate representation to restore.
   * @returns A fully hydrated SchemaGraph instance.
   */
  public static fromNormIR(normIR: NormIRInterface): SchemaGraph {
    const graph = Object.create(SchemaGraph.prototype) as SchemaGraph;

    // Initialize private maps via reflection (bypass constructor)
    const fields = graph as unknown as Record<string, unknown>;

    fields.anchorMap = new Map<string, SchemaGraphNodeInterface>();
    fields.childMap = new WeakMap<SchemaGraphNodeInterface, Map<string, SchemaGraphNodeInterface>>();
    fields.entryMap = new WeakMap<SchemaGraphNodeInterface, Map<string, Array<[string, SchemaGraphNodeInterface]>>>();
    fields.identityMap = new WeakMap<object, SchemaGraphNodeInterface>();
    fields.indexedChildMap = new WeakMap<SchemaGraphNodeInterface, Map<string, SchemaGraphNodeInterface[]>>();
    fields.nodeMap = new Map<string, SchemaGraphNodeInterface>();
    fields.relationMap = new WeakMap<SchemaGraphNodeInterface, SchemaGraphRelationInterface[]>();
    fields.semanticMap = new WeakMap<SchemaGraphNodeInterface, SchemaGraphSemanticsInterface>();
    fields.vocabularies = [];
    fields.rootSchema = normIR.rootSchema;

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
      const childMap = graph.childMap.get(parentNode);

      if (childMap === undefined) {
        continue;
      }

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
      const entryMap = graph.entryMap.get(parentNode);

      if (entryMap === undefined) {
        continue;
      }

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
      const indexedMap = graph.indexedChildMap.get(parentNode);

      if (indexedMap === undefined) {
        continue;
      }

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
  /**
   * Resolves a JSON Pointer against a raw schema object without constructing a full graph.
   *
   * @param rootSchema - The root schema to traverse.
   * @param pointer - The JSON Pointer path to resolve.
   * @returns The sub-schema at the given pointer location.
   */
  static resolvePointer(rootSchema: JsonSchemaType, pointer: string): JsonSchemaType {
    return resolveSchemaAtPointer(rootSchema, pointer);
  }
  private allRelationsCache: SchemaGraphRelationInterface[] | undefined = undefined;
  private readonly anchorMap = new Map<string, SchemaGraphNodeInterface>();
  private readonly childMap = new WeakMap<SchemaGraphNodeInterface, Map<string, SchemaGraphNodeInterface>>();
  private readonly entryMap = new WeakMap<
    SchemaGraphNodeInterface, Map<string, Array<[string, SchemaGraphNodeInterface]>>
  >();
  private readonly identityMap = new WeakMap<object, SchemaGraphNodeInterface>();

  private readonly indexedChildMap = new WeakMap<SchemaGraphNodeInterface, Map<string, SchemaGraphNodeInterface[]>>();

  private readonly nodeMap = new Map<string, SchemaGraphNodeInterface>();

  private readonly relationMap = new WeakMap<SchemaGraphNodeInterface, SchemaGraphRelationInterface[]>();

  private readonly semanticMap = new WeakMap<SchemaGraphNodeInterface, SchemaGraphSemanticsInterface>();

  private readonly vocabularies: readonly VocabularyPluginInterface[];

  /**
   * Creates a new schema graph by lowering a root schema into graph nodes.
   *
   * @param rootSchema - The JSON Schema (object or boolean) to represent as a graph.
   * @param vocabularies - Optional vocabulary plugins for custom relation extraction.
   */
  public constructor(public readonly rootSchema: JsonSchemaType, vocabularies?: readonly VocabularyPluginInterface[]) {
    this.vocabularies = vocabularies ?? [];
    this.lower(rootSchema, '');
  }

  /**
   * Collects every relation across all nodes in the graph.
   *
   * @returns A flat array of all relations from every graph node.
   */
  public allRelations(): SchemaGraphRelationInterface[] {
    if (this.allRelationsCache !== undefined) {
      return this.allRelationsCache;
    }

    const result: SchemaGraphRelationInterface[] = [];

    for (const node of this.nodeMap.values()) {
      // Core relations
      result.push(...this.relations(node));

      // Plugin-extracted relations
      const semantics = this.semantics(node);

      for (const plugin of this.vocabularies) {
        if (plugin.extractRelations) {
          result.push(...plugin.extractRelations(node, semantics, this));
        }
      }
    }

    this.allRelationsCache = result;

    return result;
  }

  /**
   * Retrieves a named child node of a parent node.
   *
   * @param node - The parent graph node.
   * @param key - The child key (schema keyword or property name).
   * @returns The child node, or `undefined` if no child exists for that key.
   */
  public child(node: SchemaGraphNodeInterface, key: string): SchemaGraphNodeInterface | undefined {
    return this.childMap.get(node)?.get(key);
  }

  /**
   * Returns the named entry pairs for a keyword on a given node.
   *
   * @param node - The parent graph node.
   * @param key - The keyword whose entries to retrieve (e.g. `"properties"`).
   * @returns An array of `[entryName, entryNode]` pairs, empty when none exist.
   */
  public entries(node: SchemaGraphNodeInterface, key: string): Array<[string, SchemaGraphNodeInterface]> {
    return this.entryMap.get(node)?.get(key) ?? [];
  }

  /**
   * Serializes the current graph state into a normalized intermediate representation.
   *
   * @returns The NormIR snapshot of all nodes, children, entries, indexed children, and anchors.
   */
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
          indexedRecord[key] = indexedList.map((indexedNode) => {
            return indexedNode.pointer;
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

  /**
   * Returns the ordered list of indexed child nodes for a keyword on a given node.
   *
   * @param node - The parent graph node.
   * @param key - The keyword whose indexed children to retrieve (e.g. `"allOf"`).
   * @returns An array of child nodes, empty when none exist.
   */
  public indexedChildren(node: SchemaGraphNodeInterface, key: string): SchemaGraphNodeInterface[] {
    return this.indexedChildMap.get(node)?.get(key) ?? [];
  }

  /**
   * Reads a raw keyword value from a node's underlying schema object.
   *
   * @param node - The graph node to inspect.
   * @param key - The JSON Schema keyword name.
   * @returns The keyword's value, or `undefined` if the node is boolean or the keyword is absent.
   */
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

  /**
   * Looks up the graph node for a schema object by identity reference.
   *
   * @param schema - The schema object to look up (matched by reference, not by value).
   * @returns The corresponding graph node, or `undefined` if not found.
   */
  public node(schema: Record<string, unknown>): SchemaGraphNodeInterface | undefined {
    return this.identityMap.get(schema);
  }

  /**
   * Returns all graph nodes in pointer-insertion order.
   *
   * @returns An array of every node in the graph.
   */
  public nodes(): SchemaGraphNodeInterface[] {
    return [...this.nodeMap.values()];
  }

  /**
   * Extracts the semantic relations for a node, caching the result for subsequent calls.
   *
   * @param node - The graph node whose relations to extract.
   * @returns An array of relations originating from the node.
   */
  public relations(node: SchemaGraphNodeInterface): SchemaGraphRelationInterface[] {
    const cached = this.relationMap.get(node);

    if (cached !== undefined) {
      return cached;
    }

    const relations = extractRelations(this, node, this.nodeMap);

    this.relationMap.set(node, relations);

    return relations;
  }

  /**
   * Resolves a JSON Pointer fragment or anchor name to a graph node.
   *
   * @param fragment - JSON Pointer or anchor name (without leading `#`).
   * @returns The resolved graph node.
   * @throws {@link GraphError} If the fragment is an anchor that cannot be found.
   */
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

  /**
   * Resolves a JSON Pointer to a graph node.
   *
   * @param pointer - An absolute JSON Pointer (e.g. `/properties/name`), or empty string for root.
   * @returns The graph node at the given pointer.
   * @throws {@link GraphError} If the pointer is malformed or points to a non-existent node.
   */
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

  /**
   * Resolves a `$ref` string to the target node's canonical identifier.
   *
   * @param ref - The `$ref` value (local fragment like `#/defs/Foo` or an absolute URI).
   * @returns The resolved node's `id` for local refs, or the `ref` string itself for external refs.
   */
  public resolveRefId(ref: string): string {
    if (!ref.startsWith('#')) {
      return ref;
    }

    return this.resolveLocalRef(ref).id;
  }

  /**
   * Returns the root node of the graph (the node at the empty pointer).
   *
   * @returns The root graph node.
   */
  public get rootNode(): SchemaGraphNodeInterface {
    return this.nodeMap.get('') as SchemaGraphNodeInterface;
  }

  /**
   * Extracts the semantic facets for a node, caching the result for subsequent calls.
   *
   * @param node - The graph node whose semantics to extract.
   * @returns The computed semantics (types, constraints, composition nodes, etc.).
   */
  public semantics(node: SchemaGraphNodeInterface): SchemaGraphSemanticsInterface {
    const cached = this.semanticMap.get(node);

    if (cached !== undefined) {
      return cached;
    }

    const sem = extractSemantics(this, node, (ref) => {
      return this.resolveLocalRef(ref);
    });

    this.semanticMap.set(node, sem);

    return sem;
  }

  /**
   * Validates the structural integrity of the graph, returning any warnings found.
   *
   * @returns An array of structure warnings, empty when the graph is well-formed.
   */
  public validateStructure(): StructureWarningInterface[] {
    return validateGraphStructure(this.nodeMap);
  }
}
