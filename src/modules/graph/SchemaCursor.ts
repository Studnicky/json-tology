/**
 * SchemaCursor — a lazy, immutable selection of class IRIs in the TBox.
 *
 * Navigation (`subClassOf`) and terminals (`one`/`all`/`iris`/`count`/`properties`)
 * operate over class IRIs, lifting each to its authored JSON Schema object via the
 * injected `schemaOf` function.
 *
 * Constructed by `AboxGraph.class(classIri)` and by the `domain()`/`range()`
 * accessors on the object returned by `AboxGraph.predicate(name)`.
 */

import type { SchemaCursorInterface } from '../../interfaces/SchemaCursorInterface.js';
import type { AboxGraph } from './AboxGraph.js';

import { GraphError } from '../../errors/GraphError.js';
import { GraphErrorCode } from '../../constants/ERROR_CODES.js';

export class SchemaCursor implements SchemaCursorInterface {
  private readonly graph: AboxGraph;
  private readonly iriList: readonly string[];
  private readonly schemaOf: (classIri: string) => unknown;

  /**
   * @param iriList - The current class IRI selection.
   * @param graph - The owning graph, providing TBox navigation.
   * @param schemaOf - Lifts a class IRI to its authored JSON Schema object.
   */
  public constructor(
    iriList: readonly string[],
    graph: AboxGraph,
    schemaOf: (classIri: string) => unknown
  ) {
    this.iriList = iriList;
    this.graph = graph;
    this.schemaOf = schemaOf;
  }

  public all(): unknown[] {
    return this.iriList.map((iri) => {
      return this.schemaOf(iri);
    });
  }

  public count(): number {
    return this.iriList.length;
  }

  public iris(): string[] {
    return [...this.iriList];
  }

  public one(): unknown {
    if (this.iriList.length !== 1) {
      throw new GraphError(
        `SchemaCursor.one() requires exactly one class, found ${this.iriList.length}`,
        { 'code': GraphErrorCode.CURSOR_CARDINALITY }
      );
    }

    return this.schemaOf(this.iriList[0]);
  }

  public properties(): string[] {
    const result = new Set<string>();

    for (const classIri of this.iriList) {
      for (const predIri of this.graph.classProperties(classIri)) {
        result.add(predIri);
      }
    }

    return [...result];
  }

  public subClassOf(opts?: { 'transitive'?: boolean }): SchemaCursorInterface {
    const transitive = opts?.transitive === true;

    if (!transitive) {
      const next = new Set<string>();

      for (const classIri of this.iriList) {
        for (const superClass of this.graph.classSuperclasses(classIri, false)) {
          next.add(superClass);
        }
      }

      return new SchemaCursor([...next], this.graph, this.schemaOf);
    }

    // Transitive: BFS up the superclass chain, cycle-guarded.
    const visited = new Set<string>(this.iriList);
    const queue = [...this.iriList];
    const accumulated = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift();

      if (current === undefined) {
        continue;
      }

      for (const superClass of this.graph.classSuperclasses(current, false)) {
        accumulated.add(superClass);

        if (!visited.has(superClass)) {
          visited.add(superClass);
          queue.push(superClass);
        }
      }
    }

    return new SchemaCursor([...accumulated], this.graph, this.schemaOf);
  }
}
