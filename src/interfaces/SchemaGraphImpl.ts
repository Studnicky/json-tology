import type {
  NormIRInterface,
  SchemaGraphNodeInterface, SchemaGraphRelationInterface,
  SchemaGraphSemanticsInterface, StructureWarningInterface
} from './SchemaGraph.js';
import type { JsonSchemaType } from '../types/Schema.js';

export interface SchemaGraphInterface {
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
  readonly 'rootNode': SchemaGraphNodeInterface;
  readonly 'rootSchema': JsonSchemaType;
  semantics(node: SchemaGraphNodeInterface): SchemaGraphSemanticsInterface;
  validateStructure(): StructureWarningInterface[];
}
