/**
 * SchemaReferenceWalker
 *
 * Stateless tree walker. Collects embedded $id values and cross-schema $ref
 * IRIs from a JSON Schema tree. Dependency-free: registry state is injected
 * via callbacks so the walker remains pure and independently testable.
 */

import type { LoggerInterface } from '../../interfaces/LoggerInterface.js';
import type { SchemaReferenceWalkerInterface } from '../../interfaces/SchemaReferenceWalkerInterface.js';

import { GraphError } from '../../errors/GraphError.js';
import { GRAPH_ERROR_CODE } from '../../constants/ERROR_CODES.js';
import { DataType } from '../data/DataType.js';
import { LogScope } from '../data/LogScope.js';
import { SchemaIri } from '../graph/SchemaIri.js';
import { SILENT_LOGGER } from '../../constants/LOGGER.js';

export class SchemaReferenceWalker implements SchemaReferenceWalkerInterface {
  private readonly logger: LoggerInterface;

  public constructor(options?: { 'logger'?: LoggerInterface }) {
    this.logger = options?.logger ?? SILENT_LOGGER;
  }

  public assertResolvable(
    node: unknown,
    parentSchemaId: string,
    embeddedIds: Set<string>,
    knownIds: (id: string) => boolean,
    resolve: (id: string) => string
  ): void {
    this.logger.trace(LogScope.format('SchemaReferenceWalker', 'assertResolvable', `asserting cross-schema refs resolvable for ${parentSchemaId}`));
    this.walkUnresolvedRefs(node, embeddedIds, knownIds, resolve, (reference) => {
      throw new GraphError(
        `unresolved $ref: ${reference} (referenced from ${parentSchemaId})`,
        {
          'code': GRAPH_ERROR_CODE.REF_UNRESOLVED,
          'pointer': reference
        }
      );
    });
  }

  public collectRefsInNode(
    node: unknown,
    embeddedIds: Set<string>,
    out: Set<string>,
    knownIds: (id: string) => boolean,
    resolve: (id: string) => string
  ): void {
    this.walkUnresolvedRefs(node, embeddedIds, knownIds, resolve, (_reference, resolved, referenceIri) => {
      out.add(resolved === referenceIri ? referenceIri : resolved);
    });
  }

  public collectUnresolved(
    schema: Record<string, unknown>,
    embeddedIds: Set<string>,
    knownIds: (id: string) => boolean,
    resolve: (id: string) => string
  ): ReadonlySet<string> {
    this.logger.trace(LogScope.format('SchemaReferenceWalker', 'collectUnresolved', 'collecting unresolved cross-schema refs'));

    const unresolved = new Set<string>();

    this.collectRefsInNode(schema, embeddedIds, unresolved, knownIds, resolve);

    return unresolved;
  }

  /**
   * Shared traversal core for both public entry points. Walks arrays and
   * records recursively; for each non-fragment `$ref` that resolves to neither
   * a known id nor an embedded id, invokes `onUnresolved` with the reference
   * as authored plus its resolved and parsed forms. `assertResolvable` throws
   * from the callback; `collectRefsInNode` accumulates into a set instead —
   * the traversal and resolution logic itself is identical either way.
   */
  private walkUnresolvedRefs(
    node: unknown,
    embeddedIds: Set<string>,
    knownIds: (id: string) => boolean,
    resolve: (id: string) => string,
    onUnresolved: (reference: string, resolved: string, referenceIri: string) => void
  ): void {
    if (Array.isArray(node)) {
      for (const item of node) {
        this.walkUnresolvedRefs(item, embeddedIds, knownIds, resolve, onUnresolved);
      }

      return;
    }

    if (!DataType.isRecord(node)) {
      return;
    }

    const reference = node.$ref;

    // A `#`-bearing absolute IRI reference (e.g. `https://ns#Class`) may itself be a
    // registered hash-namespace `$id`; check the reference as authored (and its
    // CURIE/relative-expanded form) before falling to document#fragment
    // semantics, which would otherwise strip the fragment and look up a base
    // IRI that was never registered.
    if (typeof reference === 'string' && !reference.startsWith('#') && !knownIds(reference) && !knownIds(resolve(reference))) {
      const referenceIri = SchemaIri.parseReference(reference).id;
      const resolved = resolve(referenceIri);

      if (!knownIds(resolved) && !knownIds(referenceIri) && !embeddedIds.has(referenceIri)) {
        onUnresolved(reference, resolved, referenceIri);
      }
    }

    for (const value of Object.values(node)) {
      this.walkUnresolvedRefs(value, embeddedIds, knownIds, resolve, onUnresolved);
    }
  }
}
