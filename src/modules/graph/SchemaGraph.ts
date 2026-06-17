import type {
  ListItemType,
  NormIRType,
  SchemaGraphNodeType, SchemaGraphRelationType,
  SchemaGraphSemanticsType, StructureWarningType
} from '../../types/SchemaGraph.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';
import type { VocabularyPluginInterface } from '../../interfaces/VocabularyPlugin.js';
import type { QuadInterface } from '../../interfaces/Quad.js';
import type { PrefixMap } from '../../types/OwlImport.js';
import { isRecord } from '../data/DataTypes.js';
import { GraphError } from '../../errors/GraphError.js';
import { SchemaGraphRelations } from './SchemaGraphRelations.js';
import { SchemaGraphSupport } from './SchemaGraphSupport.js';
import { QuadBackedSchemaGraph } from './QuadBackedSchemaGraph.js';
import type { JsonSchemaType } from '../../types/Schema.js';

/**
 * Canonical schema graph over a compiled JSON Schema document.
 *
 * `SchemaGraph` lowers a raw JSON Schema into a navigable node/relation graph
 * used by `GraphEngine` for validation, `OwlProjection` for ontology export,
 * and `Materializer` for ABox projection.  Each schema object becomes a
 * {@link SchemaGraphNodeType} keyed by its JSON Pointer; composition,
 * reference, and keyword relations are encoded as
 * {@link SchemaGraphRelationType} edges.
 *
 * @remarks
 * Instantiate via `new SchemaGraph(schema)` for normal use, or the static
 * factory methods (`fromNormIR`, `fromQuads`, `buildNormIR`) for
 * serialization and round-trip scenarios.  The graph is built once at
 * construction; subsequent accesses to `semantics()`, `relations()`, and
 * `allRelations()` are memoised.
 *
 * @example
 * ```ts
 * const graph = new SchemaGraph({ $id: 'https://example.com/Book', type: 'object' });
 * const root = graph.rootNode;
 * const sem = graph.semantics(root);
 * ```
 *
 * @category Graph
 * @since 0.1.0
 * @see {@link SchemaGraphInterface}
 * @group Graph
 */
export class SchemaGraph implements SchemaGraphInterface {
  public static buildNormIR(rootSchema: JsonSchemaType): NormIRType {
    const graph = new SchemaGraph(rootSchema);

    return graph.getNormIR();
  }
  public static fromNormIR(normIR: NormIRType): SchemaGraph {
    const graph = Object.create(SchemaGraph.prototype) as SchemaGraph;

    // @internal
    // Initialize private maps via reflection (bypass constructor).
    // Invariant: `Object.create(SchemaGraph.prototype)` produces a valid SchemaGraph instance
    // whose prototype chain is intact; we then populate every private field before the object
    // escapes this factory method. The cast is structurally safe because the fields being set
    // are exactly the private fields declared on SchemaGraph — no external field writes occur,
    // and the resulting object satisfies the SchemaGraphInterface contract before it is returned.
    // A factory constructor overload could replace this, but would require exposing the field
    // initialisation as a separate internal method, increasing the risk of partially-initialised
    // instances; the current pattern keeps initialisation atomic.
    const fields = graph as unknown as Record<string, unknown>;

    fields.anchorMap = new Map<string, SchemaGraphNodeType>();
    fields.cachedRootNode = undefined;
    fields.childMap = new WeakMap<SchemaGraphNodeType, Map<string, SchemaGraphNodeType>>();
    fields.domainMap = new WeakMap<SchemaGraphNodeType, SchemaGraphNodeType>();
    fields.embeddedIdMap = new Map<string, SchemaGraphNodeType>();
    fields.entryMap = new WeakMap<SchemaGraphNodeType, Map<string, Array<[string, SchemaGraphNodeType]>>>();
    fields.identityMap = new WeakMap<object, SchemaGraphNodeType>();
    fields.indexedChildMap = new WeakMap<SchemaGraphNodeType, Map<string, SchemaGraphNodeType[]>>();
    fields.nodeMap = new Map<string, SchemaGraphNodeType>();
    fields.relationMap = new WeakMap<SchemaGraphNodeType, SchemaGraphRelationType[]>();
    fields.relationsForSubjectIndex = undefined;
    fields.semanticMap = new WeakMap<SchemaGraphNodeType, SchemaGraphSemanticsType>();
    fields.vocabularies = [];
    fields.rootSchema = normIR.rootSchema;

    SchemaGraph.rebuildNodes(graph, normIR);
    fields.cachedRootNode = (graph.nodeMap).get('');
    SchemaGraph.rebuildChildren(graph, normIR);
    SchemaGraph.rebuildEntries(graph, normIR);
    SchemaGraph.rebuildIndexedChildren(graph, normIR);
    SchemaGraph.rebuildAnchors(graph, normIR);
    SchemaGraph.rebuildDomainMap(graph, normIR);
    SchemaGraph.rebuildEmbeddedIdMap(graph, normIR);

    return graph;
  }

  /**
   * fromQuads — structural inverse of OwlProjection.graph().
   *
   * Ingests a QuadInterface[] carrying an OWL 2 TBox ontology (JSON-LD quads,
   * N-Quads, or any rdf/js-compatible source) and returns a SchemaGraphInterface
   * populated from those quads.
   *
   * Axiom envelope:
   * - Every IRI predicate that OwlProjection emits in the forward direction is
   *   accepted here (forward-emit ⊆ inverse-accept).
   * - Phase-1+ dispatchers may extend the inverse beyond what the forward
   *   projector emits today — all incoming predicates are recorded in
   *   allRelations() without filtering.
   *
   * Limitation:
   * - Does NOT materialise JSON Schema objects from the quads — that is the
   *   phase-1 dispatchers' responsibility.
   * - semantics() returns an empty stub; dispatchers must traverse allRelations().
   *
   * @param quads  - Flat array of rdf/js-compatible quads (prefixed or full IRIs).
   * @param options - Optional baseIRI and additional prefix mappings merged
   *                  with STANDARD_PREFIXES.
   * @returns A SchemaGraphInterface backed by the supplied quads.
   */
  public static fromQuads(
    quads: readonly QuadInterface[],
    options?: { 'baseIRI'?: string;
      'prefixes'?: PrefixMap }
  ): SchemaGraphInterface {
    return new QuadBackedSchemaGraph(quads, options);
  }

  private static rebuildAnchors(graph: SchemaGraph, normIR: NormIRType): void {
    for (const [
      anchor,
      anchorPointer
    ] of Object.entries(normIR.anchors)) {
      const anchorNode = graph.nodeMap.get(anchorPointer);

      if (anchorNode !== undefined) {
        graph.anchorMap.set(anchor, anchorNode);
      }
    }
  }

  private static rebuildChildren(graph: SchemaGraph, normIR: NormIRType): void {
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
  }

  /**
   * Rebuild the property→domain index from the NormIR entries.
   * For every pointer whose entries include a 'properties' key, each listed
   * entry node is the property and the parent node is its domain.
   */
  private static rebuildDomainMap(graph: SchemaGraph, normIR: NormIRType): void {
    for (const [
      pointer,
      entryRecord
    ] of Object.entries(normIR.entries)) {
      if (!('properties' in entryRecord)) {
        continue;
      }
      const parentNode = graph.nodeMap.get(pointer);

      if (parentNode === undefined) {
        continue;
      }

      for (const [
        ,
        entryPointer
      ] of entryRecord['properties']) {
        const entryNode = graph.nodeMap.get(entryPointer);

        if (entryNode !== undefined) {
          graph.domainMap.set(entryNode, parentNode);
        }
      }
    }
  }

  /**
   * Rebuild the embedded-$id index from node schemas.
   * For every non-root node whose schema carries a string $id, record it.
   */
  private static rebuildEmbeddedIdMap(graph: SchemaGraph, normIR: NormIRType): void {
    for (const normNode of normIR.nodes) {
      if (normNode.pointer === '') {
        continue;
      }
      const schema = SchemaGraphSupport.resolveSchemaAtPointer(normIR.rootSchema, normNode.pointer);

      if (isRecord(schema) && typeof schema.$id === 'string' && schema.$id !== '') {
        const node = graph.nodeMap.get(normNode.pointer);

        if (node !== undefined) {
          graph.embeddedIdMap.set(schema.$id, node);
        }
      }
    }
  }

  private static rebuildEntries(graph: SchemaGraph, normIR: NormIRType): void {
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
        const resolved: Array<[string, SchemaGraphNodeType]> = [];

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
  }

  private static rebuildIndexedChildren(graph: SchemaGraph, normIR: NormIRType): void {
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
        const resolved: SchemaGraphNodeType[] = [];

        for (const childPointer of pointers) {
          const childNode = graph.nodeMap.get(childPointer);

          if (childNode !== undefined) {
            resolved.push(childNode);
          }
        }
        indexedMap.set(key, resolved);
      }
    }
  }

  private static rebuildNodes(graph: SchemaGraph, normIR: NormIRType): void {
    for (const normNode of normIR.nodes) {
      const schema = SchemaGraphSupport.resolveSchemaAtPointer(normIR.rootSchema, normNode.pointer);
      const node: SchemaGraphNodeType = {
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
  }

  static resolvePointer(rootSchema: JsonSchemaType, pointer: string): JsonSchemaType {
    return SchemaGraphSupport.resolveSchemaAtPointer(rootSchema, pointer);
  }
  private allRelationsCache: SchemaGraphRelationType[] | undefined = undefined;
  private readonly anchorMap = new Map<string, SchemaGraphNodeType>();
  private readonly cachedRootNode: SchemaGraphNodeType | undefined = undefined;
  private readonly childMap = new WeakMap<SchemaGraphNodeType, Map<string, SchemaGraphNodeType>>();
  /**
   * Explicit property→domain index built during lower().
   * Maps each property node to its owning domain node, recorded when a
   * property child node is created under a parent's `properties` keyword.
   * Replaces pointer-arithmetic domain inference in SchemaGraphRelations.
   */
  private readonly domainMap = new WeakMap<SchemaGraphNodeType, SchemaGraphNodeType>();
  /**
   * Embedded-$id index built during lower().
   * Maps each non-root sub-schema's $id to its graph node, enabling
   * GraphEngine to resolve cross-embedded-$id $refs through the canonical graph
   * rather than a second raw-JSON walk.
   */
  private readonly embeddedIdMap = new Map<string, SchemaGraphNodeType>();
  private readonly entryMap = new WeakMap<
    SchemaGraphNodeType, Map<string, Array<[string, SchemaGraphNodeType]>>
  >();
  private readonly identityMap = new WeakMap<object, SchemaGraphNodeType>();

  private readonly indexedChildMap = new WeakMap<SchemaGraphNodeType, Map<string, SchemaGraphNodeType[]>>();

  private readonly nodeMap = new Map<string, SchemaGraphNodeType>();

  private readonly relationMap = new WeakMap<SchemaGraphNodeType, SchemaGraphRelationType[]>();

  private relationsForSubjectIndex: Map<string, SchemaGraphRelationType[]> | undefined = undefined;

  private readonly semanticMap = new WeakMap<SchemaGraphNodeType, SchemaGraphSemanticsType>();

  private readonly vocabularies: readonly VocabularyPluginInterface[];

  public constructor(public readonly rootSchema: JsonSchemaType, options?: { 'vocabularies'?: readonly VocabularyPluginInterface[] }) {
    this.vocabularies = options?.vocabularies ?? [];
    this.lower(rootSchema, '');
    this.cachedRootNode = this.nodeMap.get('');
  }

  public allRelations(): SchemaGraphRelationType[] {
    if (this.allRelationsCache !== undefined) {
      return this.allRelationsCache;
    }

    const result: SchemaGraphRelationType[] = [];

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

  public child(node: SchemaGraphNodeType, key: string): SchemaGraphNodeType | undefined {
    return this.childMap.get(node)?.get(key);
  }

  /**
   * The forward-projection graph does not retain `rdf:first`/`rdf:rest` chains
   * — RDF lists are materialised at projection time by `OwlProjection` /
   * `ShaclProjection` from the structural relations on each node. There is
   * no list quad to walk here, so this method returns an empty array.
   *
   * The quad-backed graph (`QuadBackedSchemaGraph.collectList`) provides the
   * real implementation for import-side dispatchers.
   */
  public collectList(_head: string): readonly ListItemType[] {
    return [];
  }

  public domainOf(node: SchemaGraphNodeType): SchemaGraphNodeType | undefined {
    return this.domainMap.get(node);
  }

  public embeddedNode(id: string): SchemaGraphNodeType | undefined {
    return this.embeddedIdMap.get(id);
  }

  public embeddedSchemaIds(): IterableIterator<string> {
    return this.embeddedIdMap.keys();
  }

  public entries(node: SchemaGraphNodeType, key: string): Array<[string, SchemaGraphNodeType]> {
    return this.entryMap.get(node)?.get(key) ?? [];
  }

  public getNormIR(): NormIRType {
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

      const childRecord = this.serializeNodeChildren(node);

      if (childRecord !== undefined) {
        children[node.pointer] = childRecord;
      }

      const entryRecord = this.serializeNodeEntries(node);

      if (entryRecord !== undefined) {
        entries[node.pointer] = entryRecord;
      }

      const indexedRecord = this.serializeNodeIndexed(node);

      if (indexedRecord !== undefined) {
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

  public indexedChildren(node: SchemaGraphNodeType, key: string): SchemaGraphNodeType[] {
    return this.indexedChildMap.get(node)?.get(key) ?? [];
  }

  /**
   * Returns the raw value of a JSON Schema keyword from `node.schema`.
   *
   * Only meaningful for nodes whose `schema` is a record (object schema);
   * returns `undefined` for boolean schemas. This method performs a direct
   * property lookup — it does not apply dialect resolution, $ref following,
   * or any semantic transformation. Call it only when you need the literal
   * authored value from the source schema, not a semantically-resolved value.
   */
  public keywordValue(node: SchemaGraphNodeType, key: string): unknown {
    if (!isRecord(node.schema)) {
      return undefined;
    }

    return node.schema[key];
  }

  private lower(schema: JsonSchemaType, pointer: string): void {
    const id = SchemaGraphSupport.nodeIdFromPointer(this.rootSchema, pointer, schema);
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

    // Record embedded-$id index for non-root sub-schemas that carry their own $id.
    // These are later consulted by GraphEngine.resolveRefGraph via embeddedNode().
    if (pointer !== '' && typeof schema.$id === 'string' && schema.$id !== '') {
      this.embeddedIdMap.set(schema.$id, node);
    }

    if (typeof schema.$anchor === 'string') {
      this.anchorMap.set(schema.$anchor, this.nodeForPointer(pointer));
    }
    if (typeof schema.$dynamicAnchor === 'string') {
      this.anchorMap.set(schema.$dynamicAnchor, this.nodeForPointer(pointer));
    }

    for (const [
      key,
      value
    ] of Object.entries(schema)) {
      const childPointer = `${pointer}/${SchemaGraphSupport.escapeJsonPointerSegment(key)}`;

      if (typeof value === 'boolean' || isRecord(value)) {
        this.lowerSchemaKeyword(node, childPointer, value, key);
        continue;
      }
      if (Array.isArray(value)) {
        this.lowerArrayKeyword(node, childPointer, value);
      }
    }
  }

  private lowerArrayKeyword(
    node: SchemaGraphNodeType,
    keyPointer: string,
    value: unknown[]
  ): void {
    const key = keyPointer.slice(keyPointer.lastIndexOf('/') + 1).replaceAll('~1', '/')
      .replaceAll('~0', '~');
    const indexedChildren: SchemaGraphNodeType[] = [];

    for (const [
      index,
      element
    ] of value.entries()) {
      if (typeof element === 'boolean' || isRecord(element)) {
        const elementPointer = `${keyPointer}/${index}`;

        this.lower(element, elementPointer);
        indexedChildren.push(this.nodeForPointer(elementPointer));
      }
    }

    if (indexedChildren.length > 0) {
      this.indexedChildMap.get(node)?.set(key, indexedChildren);
    }
  }

  private lowerSchemaKeyword(
    node: SchemaGraphNodeType,
    childPointer: string,
    value: boolean | Record<string, unknown>,
    keyword?: string
  ): void {
    const key = childPointer.slice(childPointer.lastIndexOf('/') + 1).replaceAll('~1', '/')
      .replaceAll('~0', '~');

    this.lower(value, childPointer);
    this.childMap.get(node)?.set(key, this.nodeForPointer(childPointer));

    if (!isRecord(value)) {
      return;
    }

    const entries: Array<[string, SchemaGraphNodeType]> = [];
    const isPropertiesKeyword = keyword === 'properties';

    for (const entryKey of Object.keys(value)) {
      const entryValue = value[entryKey];

      if (!isRecord(entryValue) && typeof entryValue !== 'boolean') {
        continue;
      }

      const entryPointer = `${childPointer}/${SchemaGraphSupport.escapeJsonPointerSegment(entryKey)}`;
      const entryNode = this.nodeForPointer(entryPointer);

      // Record explicit domain edge: property child → owning object node.
      // This replaces pointer-arithmetic inference in SchemaGraphRelations.
      if (isPropertiesKeyword) {
        this.domainMap.set(entryNode, node);
      }

      entries.push([
        entryKey,
        entryNode
      ]);
    }

    if (entries.length > 0) {
      this.entryMap.get(node)?.set(key, entries);
    }
  }

  public node(schema: Record<string, unknown>): SchemaGraphNodeType | undefined {
    return this.identityMap.get(schema);
  }

  private nodeForPointer(pointer: string): SchemaGraphNodeType {
    const mapNode = this.nodeMap.get(pointer);

    if (mapNode === undefined) {
      throw new GraphError(`Schema graph node not found for pointer: ${pointer}`, {
        'code': 'POINTER_NOT_FOUND',
        pointer
      });
    }

    return mapNode;
  }

  public nodes(): SchemaGraphNodeType[] {
    return [...this.nodeMap.values()];
  }

  public relations(node: SchemaGraphNodeType): SchemaGraphRelationType[] {
    const cached = this.relationMap.get(node);

    if (cached !== undefined) {
      return cached;
    }

    const relations = SchemaGraphRelations.extractRelations(this, node, this.nodeMap);

    this.relationMap.set(node, relations);

    return relations;
  }

  public relationsForSubject(subjectIri: string): readonly SchemaGraphRelationType[] {
    if (this.relationsForSubjectIndex === undefined) {
      const index = new Map<string, SchemaGraphRelationType[]>();

      for (const rel of this.allRelations()) {
        const bucket = index.get(rel.source.id);

        if (bucket === undefined) {
          index.set(rel.source.id, [rel]);
        } else {
          bucket.push(rel);
        }
      }
      this.relationsForSubjectIndex = index;
    }

    return this.relationsForSubjectIndex.get(subjectIri) ?? [];
  }

  public resolveFragment(fragment: string): SchemaGraphNodeType {
    if (fragment === '') {
      return this.rootNode;
    }
    if (fragment.startsWith('/')) {
      return this.resolvePointer(fragment);
    }

    const anchored = this.anchorMap.get(fragment);

    if (anchored === undefined) {
      throw new GraphError(`Unknown schema anchor: #${fragment}`, {
        'code': 'ANCHOR_NOT_FOUND',
        'pointer': fragment
      });
    }

    return anchored;
  }

  private resolveLocalRef(ref: string): SchemaGraphNodeType {
    if (ref === '#') {
      return this.rootNode;
    }
    if (ref.startsWith('#/')) {
      return this.resolvePointer(ref.slice(1));
    }

    return this.resolveFragment(ref.slice(1));
  }

  public resolvePointer(pointer: string): SchemaGraphNodeType {
    if (pointer === '') {
      return this.rootNode;
    }
    if (!pointer.startsWith('/')) {
      throw new GraphError(`Invalid JSON Pointer: ${pointer}`, {
        'code': 'POINTER_INVALID',
        pointer
      });
    }

    const resolved = this.nodeMap.get(pointer);

    if (resolved === undefined) {
      throw new GraphError(`Pointer not found: ${pointer}`, {
        'code': 'POINTER_NOT_FOUND',
        pointer
      });
    }

    return resolved;
  }

  public resolveRefId(ref: string): string {
    if (!ref.startsWith('#')) {
      return ref;
    }

    return this.resolveLocalRef(ref).id;
  }

  public get rootNode(): SchemaGraphNodeType {
    if (this.cachedRootNode !== undefined) {
      return this.cachedRootNode;
    }

    return this.nodeForPointer('');
  }

  public semantics(node: SchemaGraphNodeType): SchemaGraphSemanticsType {
    const cached = this.semanticMap.get(node);

    if (cached !== undefined) {
      return cached;
    }

    const sem = SchemaGraphSupport.extractSemantics(this, node, (ref: string): SchemaGraphNodeType => {
      return this.resolveLocalRef(ref);
    });

    this.semanticMap.set(node, sem);

    return sem;
  }

  private serializeNodeChildren(node: SchemaGraphNodeType): Record<string, string> | undefined {
    const nodeChildren = this.childMap.get(node);

    if (nodeChildren === undefined || nodeChildren.size === 0) {
      return undefined;
    }

    const childRecord: Record<string, string> = {};

    for (const [
      key,
      childNode
    ] of nodeChildren) {
      childRecord[key] = childNode.pointer;
    }

    return childRecord;
  }

  private serializeNodeEntries(node: SchemaGraphNodeType): Record<string, Array<[string, string]>> | undefined {
    const nodeEntries = this.entryMap.get(node);

    if (nodeEntries === undefined || nodeEntries.size === 0) {
      return undefined;
    }

    const entryRecord: Record<string, Array<[string, string]>> = {};

    for (const [
      key,
      entryList
    ] of nodeEntries) {
      entryRecord[key] = entryList.map(([
        name,
        entryNode
      ]: [string, SchemaGraphNodeType
      ]): [string, string] => {
        return [
          name,
          entryNode.pointer
        ];
      });
    }

    return entryRecord;
  }

  private serializeNodeIndexed(node: SchemaGraphNodeType): Record<string, string[]> | undefined {
    const nodeIndexed = this.indexedChildMap.get(node);

    if (nodeIndexed === undefined || nodeIndexed.size === 0) {
      return undefined;
    }

    const indexedRecord: Record<string, string[]> = {};

    for (const [
      key,
      indexedList
    ] of nodeIndexed) {
      indexedRecord[key] = indexedList.map((indexedNode: SchemaGraphNodeType): string => {
        return indexedNode.pointer;
      });
    }

    return indexedRecord;
  }

  public validateStructure(): StructureWarningType[] {
    return SchemaGraphSupport.validateGraphStructure(this.nodeMap);
  }
}
