/**
 * SchemaRefWalker
 *
 * Stateless tree walker. Collects embedded $id values and cross-schema $ref
 * IRIs from a JSON Schema tree. Dependency-free: registry state is injected
 * via callbacks so the walker remains pure and independently testable.
 */

import type { LoggerInterface } from '../../interfaces/LoggerInterface.js';
import type { SchemaRefWalkerInterface } from '../../interfaces/SchemaRefWalkerInterface.js';

import { GraphError } from '../../errors/GraphError.js';
import { GraphErrorCode } from '../../constants/ERROR_CODES.js';
import { DataType } from '../data/DataType.js';
import { LogScope } from '../data/LogScope.js';
import { SchemaIri } from '../graph/SchemaIri.js';
import { SILENT_LOGGER } from '../../constants/LOGGER.js';

export class SchemaRefWalker implements SchemaRefWalkerInterface {
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
    this.logger.trace(LogScope.format('SchemaRefWalker', 'assertResolvable', `asserting cross-schema refs resolvable for ${parentSchemaId}`));
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

    const ref = node.$ref;

    if (typeof ref === 'string' && !ref.startsWith('#')) {
      const refIri = SchemaIri.parseRef(ref).id;
      const resolved = resolve(refIri);

      if (!knownIds(resolved) && !knownIds(refIri) && !embeddedIds.has(refIri)) {
        out.add(resolved === refIri ? refIri : resolved);
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
    this.logger.trace(LogScope.format('SchemaRefWalker', 'collectUnresolved', 'collecting unresolved cross-schema refs'));

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

    const ref = node.$ref;

    if (typeof ref === 'string' && !ref.startsWith('#')) {
      const refIri = SchemaIri.parseRef(ref).id;
      const resolved = resolve(refIri);

      if (!knownIds(resolved) && !knownIds(refIri) && !embeddedIds.has(refIri)) {
        throw new GraphError(
          `unresolved $ref: ${ref} (referenced from ${parentSchemaId})`,
          {
            'code': GraphErrorCode.REF_UNRESOLVED,
            'pointer': ref
          }
        );
      }
    }

    for (const value of Object.values(node)) {
      this.walkAssert(value, parentSchemaId, embeddedIds, knownIds, resolve);
    }
  }
}
