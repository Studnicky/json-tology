/**
 * JsonLdFormatter — generic quad-to-JSON-LD converter.
 *
 * Groups quads by subject into {@id, @type, ...} nodes. Inlines
 * singly-referenced blank nodes (bottom-up). Converts rdf:type → @type,
 * RDF lists → @list. Passes through literal values as-is.
 *
 * Pure function, no graph/schema access.
 */

import type { QuadInterface } from '../../interfaces/QuadInterface.js';
import type { QuadObjectType } from '../../types/Quad.js';
import { RDF } from '../../constants/IRI.js';
import { JSONLD } from '../../constants/JSONLD.js';
import { Lists } from '../quads/Lists.js';
import { QuadFactory } from '../quads/QuadFactory.js';
import { Terms } from '../quads/Terms.js';
import { ResourceTermKindEntity } from '../../entities/ResourceTermKindEntity.js';

/**
 * Generic quad-to-JSON-LD converter.
 *
 * @remarks
 * Groups quads by subject into `{ @id, @type, ... }` nodes. Inlines
 * singly-referenced blank nodes (bottom-up). Converts `rdf:type` to `@type`,
 * RDF lists to `@list`. Passes through literal values as-is.
 * Pure function — no graph or schema access required.
 *
 * @defaultValue Returns an empty array when `quads` is empty.
 * @example
 * ```ts
 * const nodes = JsonLdFormatter.fromQuads(quads);
 * ```
 *
 * @category RDF
 * @since 0.1.0
 * @see {@link OwlProjection}
 * @group JsonLdFormatter
 */
export class JsonLdFormatter {
  /** Append a value to a node property, converting to array on first collision. */
  private static appendNodeValue(node: Record<string, unknown>, key: string, value: unknown): void {
    if (Object.hasOwn(node, key)) {
      const existing = node[key];

      if (Array.isArray(existing)) {
        (existing as unknown[]).push(value);
      } else {
        node[key] = [
          existing,
          value
        ];
      }
    } else {
      node[key] = value;
    }
  }

  /**
   * Build per-subject quad index and collect list-segment subject IDs
   * (any subject with an outgoing `rdf:first` edge).
   */
  private static buildSubjectIndex(quads: QuadInterface[]): {
    'listSegmentIds': ReadonlySet<string>;
    'subjectQuads': ReadonlyMap<string, QuadInterface[]>;
  } {
    const subjectQuads = QuadFactory.indexBySubject(quads);
    const listSegmentIds = new Set<string>();

    for (const [
      subjectId,
      entries
    ] of subjectQuads) {
      const hasFirst = entries.some((quad: QuadInterface): boolean => {
        const result = Lists.isRdfFirst(quad.predicate.value);

        return result;
      });

      if (hasFirst) {
        listSegmentIds.add(subjectId);
      }
    }

    return {
      listSegmentIds,
      subjectQuads
    };
  }

  private static countBnodeRefs(object: QuadObjectType, counts: Map<string, number>): void {
    if (object.termType === 'BlankNode') {
      counts.set(object.value, (counts.get(object.value) ?? 0) + 1);
    }
  }

  public static fromQuads(quads: QuadInterface[]): Array<Record<string, unknown>> {
    const result = JsonLdFormatter.fromQuadsImpl(quads);

    return result;
  }

  private static fromQuadsImpl(quads: QuadInterface[]): Array<Record<string, unknown>> {
    const {
      listSegmentIds, subjectQuads
    } = JsonLdFormatter.buildSubjectIndex(quads);

    const subjects = JsonLdFormatter.groupQuadsBySubject(quads, subjectQuads, listSegmentIds);
    const inlinedIds = JsonLdFormatter.resolveInlinedBnodes(quads, subjects);

    // Emit only non-inlined, non-list-segment nodes in insertion order.
    // List-segment bnodes are consumed into `@list` arrays by their parent edges.
    const result: Array<Record<string, unknown>> = [];

    for (const [
      id,
      node
    ] of subjects) {
      if (!inlinedIds.has(id) && !listSegmentIds.has(id)) {
        result.push(node);
      }
    }

    return result;
  }

  /**
   * Group quads by subject into JSON-LD node objects, resolving `rdf:type` to
   * `@type` and list-headed objects to `{ @list }`.
   */
  private static groupQuadsBySubject(
    quads: QuadInterface[],
    subjectQuads: ReadonlyMap<string, QuadInterface[]>,
    listSegmentIds: ReadonlySet<string>
  ): Map<string, Record<string, unknown>> {
    const subjects = new Map<string, Record<string, unknown>>();

    for (const entry of quads) {
      const subjectValue = entry.subject.value;
      let node = subjects.get(subjectValue);

      if (node === undefined) {
        node = {};
        node[JSONLD.id] = subjectValue;
        subjects.set(subjectValue, node);
      }

      const predicateValue = entry.predicate.value;

      if (predicateValue === RDF.type) {
        const narrowedTypeObject = Lists.asQuadObject(entry.object);

        if (narrowedTypeObject === undefined) {
          continue;
        }
        const typeValue = narrowedTypeObject.termType === 'NamedNode'
          ? narrowedTypeObject.value
          : JsonLdFormatter.objectToJsonLd(narrowedTypeObject);

        // Use Object.hasOwn to guard against prototype-traversal: a predicate IRI of
        // "__proto__" or "constructor" would otherwise read Object.prototype via
        // node[JSONLD.type] and corrupt the accumulator.
        JsonLdFormatter.appendNodeValue(node, JSONLD.type, typeValue);
      } else {
        const narrowed = Lists.asQuadObject(entry.object);

        if (narrowed === undefined) {
          continue;
        }
        const value = JsonLdFormatter.resolveNonTypeObjectValue(narrowed, subjectQuads, listSegmentIds);

        // Use Object.hasOwn to guard against prototype-traversal: a predicate IRI of
        // "__proto__" or "constructor" would otherwise read Object.prototype via
        // node[predicateValue] and corrupt the accumulator.
        JsonLdFormatter.appendNodeValue(node, predicateValue, value);
      }
    }

    return subjects;
  }

  private static inlineBnodes(
    node: Record<string, unknown>,
    subjects: Map<string, Record<string, unknown>>,
    inlinedIds: Set<string>
  ): void {
    for (const [
      key,
      value
    ] of Object.entries(node)) {
      if (key === JSONLD.id) {
        continue;
      }

      node[key] = JsonLdFormatter.resolveValue(value, subjects, inlinedIds);
    }
  }

  private static objectToJsonLd(object: QuadObjectType): unknown {
    if (ResourceTermKindEntity.validateObject(object)) {
      const idNode: Record<string, unknown> = {};

      idNode[JSONLD.id] = object.value;

      return idNode;
    }

    // Literal — decode the rdf/js spec `value: string` back to its typed JS
    // value (number, boolean, Date) based on `datatype.value`.
    return Terms.decodeLiteral(object);
  }

  /** Inline a bnode reference object, returning the inlined content or the original reference. */
  private static resolveIdReferenceValue(
    object: Record<string, unknown>,
    subjects: Map<string, Record<string, unknown>>,
    inlinedIds: Set<string>
  ): unknown {
    if (!(JSONLD.id in object) || typeof object[JSONLD.id] !== 'string' || Object.keys(object).length !== 1) {
      return object;
    }
    const referenceId = object[JSONLD.id] as string;

    if (!inlinedIds.has(referenceId)) {
      return object;
    }
    const inlined = subjects.get(referenceId);

    if (inlined === undefined) {
      return object;
    }

    JsonLdFormatter.inlineBnodes(inlined, subjects, inlinedIds);
    const copy: Record<string, unknown> = {};

    for (const key of Object.keys(inlined)) {
      if (key !== JSONLD.id) {
        copy[key] = inlined[key];
      }
    }

    return copy;
  }

  /** Compute the set of bnode IDs that are singly-referenced and inline them. */
  private static resolveInlinedBnodes(
    quads: QuadInterface[],
    subjects: Map<string, Record<string, unknown>>
  ): Set<string> {
    const bnodeReferenceCount = new Map<string, number>();

    for (const entry of quads) {
      const narrowed = Lists.asQuadObject(entry.object);

      if (narrowed !== undefined) {
        JsonLdFormatter.countBnodeRefs(narrowed, bnodeReferenceCount);
      }
    }

    const inlinedIds = new Set<string>();

    for (const [
      bnodeId,
      count
    ] of bnodeReferenceCount) {
      if (count === 1 && subjects.has(bnodeId)) {
        inlinedIds.add(bnodeId);
      }
    }

    for (const node of subjects.values()) {
      JsonLdFormatter.inlineBnodes(node, subjects, inlinedIds);
    }

    return inlinedIds;
  }

  /**
   * Resolve a non-type quad object to its JSON-LD value, handling rdf:first/rdf:rest chains
   * and the rdf:nil empty-list sentinel.
   */
  private static resolveNonTypeObjectValue(
    narrowed: QuadObjectType,
    subjectQuads: ReadonlyMap<string, QuadInterface[]>,
    listSegmentIds: ReadonlySet<string>
  ): unknown {
    if (ResourceTermKindEntity.validate(narrowed.termType)
      && listSegmentIds.has(narrowed.value)) {
      const listItems = JsonLdFormatter.walkListHead(narrowed.value, subjectQuads, new Set());

      if (listItems === undefined) {
        return JsonLdFormatter.objectToJsonLd(narrowed);
      }
      const listNode: Record<string, unknown> = {};

      listNode[JSONLD.list] = listItems;

      return listNode;
    }

    if (narrowed.termType === 'NamedNode' && Lists.isRdfNil(narrowed.value)) {
      const emptyListNode: Record<string, unknown> = {};

      emptyListNode[JSONLD.list] = [];

      return emptyListNode;
    }

    return JsonLdFormatter.objectToJsonLd(narrowed);
  }

  /**
   * Recursively resolve inlined-bnode references within a lifted JSON-LD value.
   */
  private static resolveValue(
    value: unknown,
    subjects: Map<string, Record<string, unknown>>,
    inlinedIds: Set<string>
  ): unknown {
    if (Array.isArray(value)) {
      return value.map((element: unknown): unknown => {
        const result = JsonLdFormatter.resolveValue(element, subjects, inlinedIds);

        return result;
      });
    }

    if (typeof value !== 'object' || value === null) {
      return value;
    }

    const object = value as Record<string, unknown>;

    // Recurse into @list before bnode-inlining check
    if (JSONLD.list in object && Array.isArray(object[JSONLD.list])) {
      const resolvedListNode: Record<string, unknown> = {};

      resolvedListNode[JSONLD.list] = (object[JSONLD.list] as unknown[]).map((element: unknown): unknown => {
        const result = JsonLdFormatter.resolveValue(element, subjects, inlinedIds);

        return result;
      });

      return resolvedListNode;
    }

    return JsonLdFormatter.resolveIdReferenceValue(object, subjects, inlinedIds);
  }

  /**
   * Walk an `rdf:first` / `rdf:rest` chain rooted at `headValue` (the `.value`
   * of a BlankNode or NamedNode that appears as a list head) and emit the items
   * as JSON-LD values. Returns `undefined` when the chain is not a list
   * (no rdf:first edge) or the head is `rdf:nil` (empty list — `[]` returned).
   */
  private static walkListHead(
    headValue: string,
    subjectQuads: ReadonlyMap<string, QuadInterface[]>,
    visited: Set<string>
  ): undefined | unknown[] {
    if (Lists.isRdfNil(headValue)) {
      return [];
    }

    const items: unknown[] = [];
    let cursor: string | undefined = headValue;

    while (!visited.has(cursor)) {
      visited.add(cursor);
      const segmentQuads: QuadInterface[] = subjectQuads.get(cursor) ?? [];
      const firstQuad = segmentQuads.find((segment: QuadInterface): boolean => {
        const result = Lists.isRdfFirst(segment.predicate.value);

        return result;
      });
      const restQuad = segmentQuads.find((segment: QuadInterface): boolean => {
        const result = Lists.isRdfRest(segment.predicate.value);

        return result;
      });

      if (firstQuad === undefined) {
        return undefined;
      }

      const narrowedItem = Lists.asQuadObject(firstQuad.object);

      if (narrowedItem !== undefined) {
        const itemValue = JsonLdFormatter.objectToJsonLd(narrowedItem);

        items.push(itemValue);
      }

      if (restQuad === undefined) {
        break;
      }
      const rest: QuadInterface['object'] = restQuad.object;

      if (rest.termType === 'NamedNode' && Lists.isRdfNil(rest.value)) {
        break;
      }
      if (rest.termType !== 'NamedNode' && rest.termType !== 'BlankNode') {
        break;
      }
      cursor = rest.value;
    }

    return items;
  }
}
