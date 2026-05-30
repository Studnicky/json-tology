/**
 * Cursor — a lazy, immutable selection of resource IRIs over an {@link AboxGraph}.
 *
 * Navigation (`objects`/`subjects`) and refinement (`ofType`/`where`/`having`)
 * return a NEW Cursor; terminals (`one`/`all`/`iris`/`count`/…) materialize the
 * current selection into typed instances or scalar results.
 *
 * The owning graph is held by a type-only reference (no runtime import cycle):
 * the Cursor calls the graph's public navigation surface (`objectsVia`,
 * `subjectsVia`, `typesOf`, `valuesVia`, `resolvePredicate`).
 */

import type { AboxGraph } from './AboxGraph.js';
import type { CursorInterface } from '../../interfaces/CursorInterface.js';
import type { AboxLiftFnType } from '../../types/AboxGraph.js';

import { GraphError } from '../../errors/GraphError.js';

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
    return this.iriList.map((iri) => {
      return this.lift(iri);
    });
  }

  public count(): number {
    return this.iriList.length;
  }

  public first(): unknown {
    if (this.iriList.length === 0) {
      return undefined;
    }

    return this.lift(this.iriList[0]);
  }

  public having(predicate: string, value: unknown): CursorInterface {
    const predicateIri = this.graph.resolvePredicate(predicate);
    const next = this.iriList.filter((iri) => {
      return this.graph.valuesVia(iri, predicateIri).some((candidate) => {
        return candidate === value;
      });
    });

    return new Cursor(next, this.graph, this.lift);
  }

  public iris(): string[] {
    return [...this.iriList];
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
    const next = this.iriList.filter((iri) => {
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

  private resolvePredicates(predicate: string | string[]): string[] {
    const tokens = Array.isArray(predicate) ? predicate : [predicate];

    return tokens.map((token) => {
      return this.graph.resolvePredicate(token);
    });
  }

  public resources(): unknown[] {
    return this.all();
  }

  public some(): boolean {
    return this.iriList.length > 0;
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

  public where(fn: (instance: unknown) => boolean): CursorInterface {
    const next = this.iriList.filter((iri) => {
      return fn(this.lift(iri));
    });

    return new Cursor(next, this.graph, this.lift);
  }
}
