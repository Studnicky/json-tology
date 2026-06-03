import type { AboxGraph } from './AboxGraph.js';
import type { CursorInterface } from '../../interfaces/CursorInterface.js';
import type { AboxLiftFnType } from '../../types/AboxGraph.js';

import { GraphError } from '../../errors/GraphError.js';

/**
 * Lazy, immutable selection of resource IRIs over an {@link AboxGraph}.
 *
 * Navigation (`objects`/`subjects`) and refinement (`ofType`/`where`/`having`)
 * return a new Cursor; terminals (`one`/`all`/`iris`/`count`) materialize the
 * current selection into typed instances or scalar results.  The owning graph
 * is held by a type-only reference — the Cursor calls the graph's public
 * navigation surface (`objectsVia`, `subjectsVia`, `typesOf`, `valuesVia`,
 * `resolvePredicate`) without creating a runtime import cycle.
 *
 * @remarks
 * All Cursor instances are immutable: every navigation or refinement operation
 * returns a new Cursor backed by the same graph and lift function.  Terminals
 * materialize eagerly — repeated calls re-lift each IRI.
 *
 * @example
 * ```ts
 * const people = graph.cursor().ofType('schema:Person');
 * const manager = people.having('schema:name', 'Alice').one();
 * ```
 *
 * @category Graph
 * @since 0.17.0
 * @see {@link CursorInterface}
 * @group Graph
 */
export class Cursor implements CursorInterface {
  private readonly graph: AboxGraph;
  private readonly iriList: readonly string[];
  private readonly lift: AboxLiftFnType;

  /**
   * @param iriList - The current resource IRI selection.
   * @param graph - The owning graph, providing the navigation index.
   * @param lift - Memoised IRI → typed-instance lift.
   */
  public constructor(iriList: readonly string[], graph: AboxGraph, lift: AboxLiftFnType) {
    this.iriList = iriList;
    this.graph = graph;
    this.lift = lift;
  }

  public all(): unknown[] {
    return this.iriList.map((iri: string): unknown => {
      return this.lift(iri);
    });
  }

  public closure(predicate: string | string[]): CursorInterface {
    const predicateIris = this.resolvePredicates(predicate);
    const visited = new Set<string>(this.iriList);
    const queue = [...this.iriList];
    const accumulated = new Set<string>(this.iriList);

    while (queue.length > 0) {
      const current = queue.shift();

      if (current === undefined) {
        continue;
      }

      for (const predicateIri of predicateIris) {
        for (const object of this.graph.objectsVia(current, predicateIri)) {
          if (!visited.has(object)) {
            visited.add(object);
            accumulated.add(object);
            queue.push(object);
          }
        }
      }
    }

    return new Cursor([...accumulated], this.graph, this.lift);
  }

  public count(): number {
    return this.iriList.length;
  }

  public distinct(): CursorInterface {
    return new Cursor([...new Set(this.iriList)], this.graph, this.lift);
  }

  public first(): unknown {
    if (this.iriList.length === 0) {
      return undefined;
    }

    return this.lift(this.iriList[0]);
  }

  public having(predicate: string, value: unknown): CursorInterface {
    const predicateIri = this.graph.resolvePredicate(predicate);
    const next = this.iriList.filter((iri: string): boolean => {
      return this.graph.valuesVia(iri, predicateIri).some((candidate: unknown): boolean => {
        return candidate === value;
      });
    });

    return new Cursor(next, this.graph, this.lift);
  }

  public intersect(other: CursorInterface): CursorInterface {
    const otherSet = new Set(other.iris());
    const next = this.iriList.filter((iri: string): boolean => {
      return otherSet.has(iri);
    });

    return new Cursor(next, this.graph, this.lift);
  }

  public iris(): string[] {
    return [...this.iriList];
  }

  public limit(n: number): CursorInterface {
    return new Cursor(this.iriList.slice(0, n), this.graph, this.lift);
  }

  public none(): boolean {
    return this.iriList.length === 0;
  }

  public objects(predicate: string | string[]): CursorInterface {
    const predicateIris = this.resolvePredicates(predicate);
    const next = new Set<string>();

    for (const iri of this.iriList) {
      for (const predicateIri of predicateIris) {
        for (const object of this.graph.objectsVia(iri, predicateIri)) {
          next.add(object);
        }
      }
    }

    return new Cursor([...next], this.graph, this.lift);
  }

  public ofType(classIri: string): CursorInterface {
    const next = this.iriList.filter((iri: string): boolean => {
      return this.graph.typesOf(iri).includes(classIri);
    });

    return new Cursor(next, this.graph, this.lift);
  }

  public one(): unknown {
    if (this.iriList.length !== 1) {
      throw new GraphError(
        'CURSOR_CARDINALITY',
        `Cursor.one() requires exactly one resource, found ${this.iriList.length}`
      );
    }

    return this.lift(this.iriList[0]);
  }

  public orderBy(compare: (left: unknown, right: unknown) => number): CursorInterface {
    const sorted = [...this.iriList].sort((leftIri: string, rightIri: string): number => {
      return compare(this.lift(leftIri), this.lift(rightIri));
    });

    return new Cursor(sorted, this.graph, this.lift);
  }

  private resolvePredicates(predicate: string | string[]): string[] {
    const tokens = Array.isArray(predicate) ? predicate : [predicate];

    return tokens.map((token: string): string => {
      return this.graph.resolvePredicate(token);
    });
  }

  public resources(): unknown[] {
    return this.all();
  }

  public some(): boolean {
    return this.iriList.length > 0;
  }

  public subgraph(depth: number): CursorInterface {
    const visited = new Set<string>(this.iriList);
    let frontier = [...this.iriList];

    for (let hop = 0; hop < depth; hop++) {
      const nextFrontier: string[] = [];

      for (const iri of frontier) {
        for (const neighbour of this.graph.neighboursOf(iri)) {
          if (!visited.has(neighbour)) {
            visited.add(neighbour);
            nextFrontier.push(neighbour);
          }
        }
      }

      frontier = nextFrontier;

      if (frontier.length === 0) {
        break;
      }
    }

    return new Cursor([...visited], this.graph, this.lift);
  }

  public subjects(predicate: string | string[]): CursorInterface {
    const predicateIris = this.resolvePredicates(predicate);
    const next = new Set<string>();

    for (const iri of this.iriList) {
      for (const predicateIri of predicateIris) {
        for (const subject of this.graph.subjectsVia(iri, predicateIri)) {
          next.add(subject);
        }
      }
    }

    return new Cursor([...next], this.graph, this.lift);
  }

  public union(other: CursorInterface): CursorInterface {
    return new Cursor([
      ...this.iriList,
      ...other.iris()
    ], this.graph, this.lift);
  }

  public where(fn: (instance: unknown) => boolean): CursorInterface {
    const next = this.iriList.filter((iri: string): boolean => {
      return fn(this.lift(iri));
    });

    return new Cursor(next, this.graph, this.lift);
  }
}
