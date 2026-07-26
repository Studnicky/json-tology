import type { ComputedFunctionInterface } from '../../interfaces/ComputedFunctionInterface.js';
import type { ComputedStoreInterface } from '../../interfaces/ComputedStoreInterface.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphInterface.js';
import { SchemaError } from '../../errors/SchemaError.js';
import { SCHEMA_ERROR_CODE } from '../../constants/ERROR_CODES.js';
import { DataType } from '../data/DataType.js';

export class ComputedStore implements ComputedStoreInterface {
  private readonly store = new Map<string, Map<string, ComputedFunctionInterface>>();

  public add(schemaId: string, name: string, computeFunction: ComputedFunctionInterface): void {
    let entry = this.store.get(schemaId);

    if (entry === undefined) {
      entry = new Map();
      this.store.set(schemaId, entry);
    }
    entry.set(name, computeFunction);
  }

  public getMap(schemaId: string): Record<string, ComputedFunctionInterface> {
    const entry = this.store.get(schemaId);

    if (entry === undefined) {
      return {};
    }

    return Object.fromEntries(entry);
  }

  public has(schemaId: string): boolean {
    const entry = this.store.get(schemaId);

    return entry !== undefined && entry.size > 0;
  }

  public remove(schemaId: string, name: string): void {
    this.store.get(schemaId)?.delete(name);
  }

  public validateAgainstGraph(graph: SchemaGraphInterface): void {
    const schemaId = DataType.isRecord(graph.rootSchema) && typeof graph.rootSchema.$id === 'string'
      ? graph.rootSchema.$id
      : undefined;

    if (schemaId === undefined) {
      return;
    }

    const rootNode = graph.rootNode;
    const sem = graph.semantics(rootNode);

    for (const [
      propName,
      propNode
    ] of sem.properties) {
      const propSchema = propNode.schema;

      if (!DataType.isRecord(propSchema)) {
        continue;
      }

      if (propSchema['jt:computed'] !== true) {
        continue;
      }

      const registered = this.store.get(schemaId)?.has(propName) === true;

      if (!registered) {
        throw new SchemaError(
          `Schema "${schemaId}" has jt:computed property "${propName}" but no compute function is registered. Call addComputed() before or provide computeds at construction time.`,
          {
            'code': SCHEMA_ERROR_CODE.COMPUTED_FN_MISSING,
            schemaId
          }
        );
      }
    }
  }
}
