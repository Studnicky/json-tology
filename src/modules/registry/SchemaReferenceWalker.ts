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
    this.walkAssert(node, parentSchemaId, embeddedIds, knownIds, resolve);
  }

  public collectRefsInNode(
    node: unknown,
    embeddedIds: Set<string>,
    out: Set<string>,
    knownIds: (id: string) => boolean,
    resolve: (id: string) => string
  ): void {
    if (Array.isArray(node)) {
      for (const item of node) {
        this.collectRefsInNode(item, embeddedIds, out, knownIds, resolve);
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
        out.add(resolved === referenceIri ? referenceIri : resolved);
      }
    }

    for (const value of Object.values(node)) {
      this.collectRefsInNode(value, embeddedIds, out, knownIds, resolve);
    }
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

  private walkAssert(
    node: unknown,
    parentSchemaId: string,
    embeddedIds: Set<string>,
    knownIds: (id: string) => boolean,
    resolve: (id: string) => string
  ): void {
    if (Array.isArray(node)) {
      for (const item of node) {
        this.walkAssert(item, parentSchemaId, embeddedIds, knownIds, resolve);
      }

      return;
    }

    if (!DataType.isRecord(node)) {
      return;
    }

    const reference = node.$ref;

    if (typeof reference === 'string' && !reference.startsWith('#') && !knownIds(reference) && !knownIds(resolve(reference))) {
      const referenceIri = SchemaIri.parseReference(reference).id;
      const resolved = resolve(referenceIri);

      if (!knownIds(resolved) && !knownIds(referenceIri) && !embeddedIds.has(referenceIri)) {
        throw new GraphError(
          `unresolved $ref: ${reference} (referenced from ${parentSchemaId})`,
          {
            'code': GRAPH_ERROR_CODE.REF_UNRESOLVED,
            'pointer': reference
          }
        );
      }
    }

    for (const value of Object.values(node)) {
      this.walkAssert(value, parentSchemaId, embeddedIds, knownIds, resolve);
    }
  }
}
