import type {
  ListItemType,
  NormIRInterface,
  SchemaGraphNodeInterface, SchemaGraphRelationInterface,
  SchemaGraphSemanticsInterface, StructureWarningInterface
} from './SchemaGraph.js';
import type { JsonSchemaType } from '../types/Schema.js';

export interface SchemaGraphInterface {
  allRelations(): SchemaGraphRelationInterface[];
  child(node: SchemaGraphNodeInterface, key: string): SchemaGraphNodeInterface | undefined;
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
  entries(node: SchemaGraphNodeInterface, key: string): Array<[string, SchemaGraphNodeInterface]>;
  getNormIR(): NormIRInterface;
  indexedChildren(node: SchemaGraphNodeInterface, key: string): SchemaGraphNodeInterface[];
  keywordValue(node: SchemaGraphNodeInterface, key: string): unknown;
  node(schema: Record<string, unknown>): SchemaGraphNodeInterface | undefined;
  nodes(): SchemaGraphNodeInterface[];
  relations(node: SchemaGraphNodeInterface): SchemaGraphRelationInterface[];
  /**
   * Return every relation whose source IRI matches `subjectIri`. Use this
   * to walk all sibling predicates of a blank-node restriction / negative
   * property assertion / similar construct without scanning `allRelations()`
   * end-to-end.
   *
   * Implementations should build a subject index lazily on first call and
   * cache it for the lifetime of the graph.
   */
  relationsForSubject(subjectIri: string): readonly SchemaGraphRelationInterface[];
  resolveFragment(fragment: string): SchemaGraphNodeInterface;
  resolvePointer(pointer: string): SchemaGraphNodeInterface;
  resolveRefId(ref: string): string;
  readonly 'rootNode': SchemaGraphNodeInterface;
  readonly 'rootSchema': JsonSchemaType;
  semantics(node: SchemaGraphNodeInterface): SchemaGraphSemanticsInterface;
  validateStructure(): StructureWarningInterface[];
}
