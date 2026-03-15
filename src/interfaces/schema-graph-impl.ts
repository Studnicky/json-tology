import type {
  NormIRInterface,
  SchemaGraphNodeInterface, SchemaGraphRelationInterface,
  SchemaGraphSemanticsInterface, StructureWarningInterface
} from './schema-graph.js';

type JsonSchemaType = boolean | Record<string, unknown>;

export interface SchemaGraphInterface {
  readonly rootSchema: JsonSchemaType;
  readonly rootNode: SchemaGraphNodeInterface;
  allRelations(): SchemaGraphRelationInterface[];
  child(node: SchemaGraphNodeInterface, key: string): SchemaGraphNodeInterface | undefined;
  entries(node: SchemaGraphNodeInterface, key: string): Array<[string, SchemaGraphNodeInterface]>;
  getNormIR(): NormIRInterface;
  indexedChildren(node: SchemaGraphNodeInterface, key: string): SchemaGraphNodeInterface[];
  keywordValue(node: SchemaGraphNodeInterface, key: string): unknown;
  node(schema: Record<string, unknown>): SchemaGraphNodeInterface | undefined;
  nodes(): SchemaGraphNodeInterface[];
  relations(node: SchemaGraphNodeInterface): SchemaGraphRelationInterface[];
  resolveFragment(fragment: string): SchemaGraphNodeInterface;
  resolvePointer(pointer: string): SchemaGraphNodeInterface;
  resolveRefId(ref: string): string;
  semantics(node: SchemaGraphNodeInterface): SchemaGraphSemanticsInterface;
  validateStructure(): StructureWarningInterface[];
}
