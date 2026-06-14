import type {
  ListItemType,
  NormIRType,
  SchemaGraphNodeType, SchemaGraphRelationType,
  SchemaGraphSemanticsType, StructureWarningType
} from '../types/SchemaGraph.js';
import type { JsonSchemaType } from '../types/Schema.js';

export interface SchemaGraphInterface {
  allRelations(): SchemaGraphRelationType[];
  child(node: SchemaGraphNodeType, key: string): SchemaGraphNodeType | undefined;
  /**
   * Walk the RDF list rooted at `head` (an IRI or blank-node id) and return
   * each list item as a {@link ListItemType}. Returns an empty array for
   * `rdf:nil`, unresolved heads, or non-list inputs.
   *
   * Quad-backed graphs walk the underlying `rdf:first`/`rdf:rest` chain;
   * the forward-projection graph does not store RDF list quads and returns
   * an empty array.
   */
  collectList(head: string): readonly ListItemType[];
  /**
   * Return the owning-domain node for a property node that was recorded
   * during graph construction. When a sub-schema appears under
   * `properties/<name>`, `lower()` records its parent as the domain node.
   * Returns `undefined` for non-property nodes or when no domain was recorded.
   *
   * This replaces pointer-arithmetic domain inference in relation extraction.
   */
  domainOf(node: SchemaGraphNodeType): SchemaGraphNodeType | undefined;
  /**
   * Look up a sub-schema node by its embedded `$id`. Built during
   * `lower()` for any non-root schema object that carries its own `$id`.
   * Returns `undefined` when no embedded sub-schema with that id exists.
   */
  embeddedNode(id: string): SchemaGraphNodeType | undefined;
  /**
   * Enumerate every embedded sub-schema `$id` recorded during `lower()` for
   * non-root schema objects that carry their own `$id`. This is the single
   * source of embedded-$id knowledge — registration-time ref-resolvability
   * validation consults this rather than performing a second raw walk.
   * Returns an empty iterator for graphs with no embedded sub-schemas.
   */
  embeddedSchemaIds(): IterableIterator<string>;
  entries(node: SchemaGraphNodeType, key: string): Array<[string, SchemaGraphNodeType]>;
  getNormIR(): NormIRType;
  indexedChildren(node: SchemaGraphNodeType, key: string): SchemaGraphNodeType[];
  keywordValue(node: SchemaGraphNodeType, key: string): unknown;
  node(schema: Record<string, unknown>): SchemaGraphNodeType | undefined;
  nodes(): SchemaGraphNodeType[];
  relations(node: SchemaGraphNodeType): SchemaGraphRelationType[];
  /**
   * Return every relation whose source IRI matches `subjectIri`. Use this
   * to walk all sibling predicates of a blank-node restriction / negative
   * property assertion / similar construct without scanning `allRelations()`
   * end-to-end.
   *
   * Implementations should build a subject index lazily on first call and
   * cache it for the lifetime of the graph.
   */
  relationsForSubject(subjectIri: string): readonly SchemaGraphRelationType[];
  resolveFragment(fragment: string): SchemaGraphNodeType;
  resolvePointer(pointer: string): SchemaGraphNodeType;
  resolveRefId(ref: string): string;
  readonly 'rootNode': SchemaGraphNodeType;
  readonly 'rootSchema': JsonSchemaType;
  semantics(node: SchemaGraphNodeType): SchemaGraphSemanticsType;
  validateStructure(): StructureWarningType[];
}
