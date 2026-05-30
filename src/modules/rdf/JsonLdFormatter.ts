/**
 * JsonLdFormatter — generic quad-to-JSON-LD converter.
 *
 * Groups quads by subject into {@id, @type, ...} nodes. Inlines
 * singly-referenced blank nodes (bottom-up). Converts rdf:type → @type,
 * RDF lists → @list. Passes through literal values as-is.
 *
 * Pure function, no graph/schema access.
 */

import type { QuadInterface } from '../../interfaces/Quad.js';
import type { QuadObjectType } from '../../types/Quad.js';
import { RDF } from '../../constants/IRI.js';
import { JSONLD } from '../../constants/JSONLD.js';
import { Lists } from './Lists.js';
import { decodeLiteral } from './Terms.js';

const RDF_NS_FULL = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const RDF_FIRST_FULL = `${RDF_NS_FULL}first`;
const RDF_REST_FULL = `${RDF_NS_FULL}rest`;
const RDF_NIL_FULL = `${RDF_NS_FULL}nil`;

function isRdfFirst(value: string): boolean {
  return value === RDF.first || value === RDF_FIRST_FULL;
}

function isRdfRest(value: string): boolean {
  return value === RDF.rest || value === RDF_REST_FULL;
}

function isRdfNil(value: string): boolean {
  return value === RDF.nil || value === RDF_NIL_FULL;
}

/**
 * Walk an `rdf:first` / `rdf:rest` chain rooted at `headValue` (the `.value`
 * of a BlankNode or NamedNode that appears as a list head) and emit the items
 * as JSON-LD values. Returns `undefined` when the chain is not a list
 * (no rdf:first edge) or the head is `rdf:nil` (empty list — `[]` returned).
 */
function walkListHead(
  headValue: string,
  subjectQuads: ReadonlyMap<string, QuadInterface[]>,
  visited: Set<string>
): undefined | unknown[] {
  if (isRdfNil(headValue)) {
    return [];
  }

  const items: unknown[] = [];
  let cursor: string | undefined = headValue;

  while (!visited.has(cursor)) {
    visited.add(cursor);
    const segmentQuads: QuadInterface[] = subjectQuads.get(cursor) ?? [];
    const firstQuad = segmentQuads.find((segment) => {
      return isRdfFirst(segment.predicate.value);
    });
    const restQuad = segmentQuads.find((segment) => {
      return isRdfRest(segment.predicate.value);
    });

    if (firstQuad === undefined) {
      return undefined;
    }

    const narrowedItem = Lists.asQuadObject(firstQuad.object);

    if (narrowedItem !== undefined) {
      const itemValue = objectToJsonLd(narrowedItem);

      items.push(itemValue);
    }

    if (restQuad === undefined) {
      break;
    }
    const rest: QuadInterface['object'] = restQuad.object;

    if (rest.termType === 'NamedNode' && isRdfNil(rest.value)) {
      break;
    }
    if (rest.termType !== 'NamedNode' && rest.termType !== 'BlankNode') {
      break;
    }
    cursor = rest.value;
  }

  return items;
}

function fromQuadsImpl(quads: QuadInterface[]): Array<Record<string, unknown>> {
  // Pre-pass: identify list-segment bnodes (any subject with an rdf:first
  // outgoing edge). These are consumed into `@list` arrays and must not
  // appear as standalone top-level nodes in the output.
  const subjectQuads = new Map<string, QuadInterface[]>();

  for (const entry of quads) {
    const key = entry.subject.value;
    let list = subjectQuads.get(key);

    if (list === undefined) {
      list = [];
      subjectQuads.set(key, list);
    }
    list.push(entry);
  }

  const listSegmentIds = new Set<string>();

  for (const [
    subjectId,
    entries
  ] of subjectQuads) {
    const hasFirst = entries.some((quad) => {
      return isRdfFirst(quad.predicate.value);
    });

    if (hasFirst) {
      listSegmentIds.add(subjectId);
    }
  }

  // Phase 1: group quads by subject
  const subjects = new Map<string, Record<string, unknown>>();

  for (const entry of quads) {
    const subjectValue = entry.subject.value;
    let node = subjects.get(subjectValue);

    if (node === undefined) {
      node = { [JSONLD.id]: subjectValue };
      subjects.set(subjectValue, node);
    }

    const predicateValue = entry.predicate.value;

    if (predicateValue === RDF.type) {
      // @type values are plain strings, not { @id: ... } wrappers
      const narrowedTypeObj = Lists.asQuadObject(entry.object);

      if (narrowedTypeObj === undefined) {
        continue;
      }
      const typeValue = narrowedTypeObj.termType === 'NamedNode' ? narrowedTypeObj.value : objectToJsonLd(narrowedTypeObj);

      // Use Object.hasOwn to guard against prototype-traversal: a predicate IRI of
      // "__proto__" or "constructor" would otherwise read Object.prototype via
      // node[JSONLD.type] and corrupt the accumulator.
      if (Object.hasOwn(node, JSONLD.type)) {
        const existing = node[JSONLD.type];

        if (Array.isArray(existing)) {
          (existing as unknown[]).push(typeValue);
        } else {
          node[JSONLD.type] = [
            existing,
            typeValue
          ];
        }
      } else {
        node[JSONLD.type] = typeValue;
      }
    } else {
      const narrowed = Lists.asQuadObject(entry.object);

      if (narrowed === undefined) {
        continue;
      }
      // If the predicate's object is a bnode/IRI that heads an rdf:first
      // chain, emit `{ @list: [...items] }` instead of an `{ @id: bnode }`
      // reference. The list-segment bnodes themselves are filtered out of
      // the final output below.
      let value: unknown;

      if ((narrowed.termType === 'BlankNode' || narrowed.termType === 'NamedNode')
        && listSegmentIds.has(narrowed.value)) {
        const listItems = walkListHead(narrowed.value, subjectQuads, new Set());

        value = listItems === undefined ? objectToJsonLd(narrowed) : { [JSONLD.list]: listItems };
      } else if (narrowed.termType === 'NamedNode' && isRdfNil(narrowed.value)) {
        value = { [JSONLD.list]: [] };
      } else {
        value = objectToJsonLd(narrowed);
      }

      // Use Object.hasOwn to guard against prototype-traversal: a predicate IRI of
      // "__proto__" or "constructor" would otherwise read Object.prototype via
      // node[predicateValue] and corrupt the accumulator.
      if (Object.hasOwn(node, predicateValue)) {
        const existing = node[predicateValue];

        if (Array.isArray(existing)) {
          (existing as unknown[]).push(value);
        } else {
          node[predicateValue] = [
            existing,
            value
          ];
        }
      } else {
        node[predicateValue] = value;
      }
    }
  }

  // Phase 2: count bnode references for inlining
  const bnodeRefCount = new Map<string, number>();

  for (const entry of quads) {
    const narrowed = Lists.asQuadObject(entry.object);

    if (narrowed !== undefined) {
      countBnodeRefs(narrowed, bnodeRefCount);
    }
  }

  // Phase 3: inline singly-referenced bnodes (bottom-up)
  const inlinedIds = new Set<string>();

  for (const [
    bnodeId,
    count
  ] of bnodeRefCount) {
    if (count === 1 && subjects.has(bnodeId)) {
      inlinedIds.add(bnodeId);
    }
  }

  // Resolve inlined bnodes in all nodes
  for (const node of subjects.values()) {
    inlineBnodes(node, subjects, inlinedIds);
  }

  // Phase 4: emit only non-inlined, non-list-segment nodes, preserving
  // insertion order. List-segment bnodes are consumed into `@list` arrays
  // by their parent edges and must not surface as standalone subjects.
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

function objectToJsonLd(obj: QuadObjectType): unknown {
  if (obj.termType === 'BlankNode') {
    return { [JSONLD.id]: obj.value };
  }
  if (obj.termType === 'NamedNode') {
    return { [JSONLD.id]: obj.value };
  }

  // Literal — decode the rdf/js spec `value: string` back to its typed JS
  // value (number, boolean, Date) based on `datatype.value`.
  return decodeLiteral(obj);
}

function countBnodeRefs(obj: QuadObjectType, counts: Map<string, number>): void {
  if (obj.termType === 'BlankNode') {
    counts.set(obj.value, (counts.get(obj.value) ?? 0) + 1);
  }
}

function inlineBnodes(
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

    node[key] = resolveValue(value, subjects, inlinedIds);
  }
}

function resolveValue(
  value: unknown,
  subjects: Map<string, Record<string, unknown>>,
  inlinedIds: Set<string>
): unknown {
  if (Array.isArray(value)) {
    return value.map((element) => {
      return resolveValue(element, subjects, inlinedIds);
    });
  }

  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;

    // Check if this is a bnode reference that should be inlined
    if (JSONLD.id in obj && typeof obj[JSONLD.id] === 'string' && Object.keys(obj).length === 1) {
      const refId = obj[JSONLD.id] as string;

      if (inlinedIds.has(refId)) {
        const inlined = subjects.get(refId);

        if (inlined !== undefined) {
          // Recursively resolve the inlined node
          inlineBnodes(inlined, subjects, inlinedIds);
          const copy: Record<string, unknown> = {};

          for (const key in inlined) {
            if (key !== JSONLD.id) {
              copy[key] = inlined[key];
            }
          }

          return copy;
        }
      }
    }

    // Recurse into @list
    if (JSONLD.list in obj && Array.isArray(obj[JSONLD.list])) {
      return {
        [JSONLD.list]: (obj[JSONLD.list] as unknown[]).map((element) => {
          return resolveValue(element, subjects, inlinedIds);
        })
      };
    }
  }

  return value;
}

export const JsonLdFormatter = {
  fromQuads(quads: QuadInterface[]): Array<Record<string, unknown>> {
    return fromQuadsImpl(quads);
  }
} as const;
