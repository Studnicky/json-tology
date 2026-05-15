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
import { RDF_TYPE_IRI } from '../../constants/PREFIXES.js';
import { RDF } from '../../constants/IRI.js';
import { JSONLD } from '../../constants/JSONLD.js';

function fromQuadsImpl(quads: QuadInterface[]): Array<Record<string, unknown>> {
  // Phase 1: group quads by subject
  const subjects = new Map<string, Record<string, unknown>>();

  for (const entry of quads) {
    let node = subjects.get(entry.subject);

    if (node === undefined) {
      node = { [JSONLD.id]: entry.subject };
      subjects.set(entry.subject, node);
    }

    if (entry.predicate === RDF.type || entry.predicate === RDF_TYPE_IRI) {
      // @type values are plain strings, not { @id: ... } wrappers
      const typeValue = entry.object.termType === 'NamedNode' ? entry.object.value : objectToJsonLd(entry.object);
      const existing = node[JSONLD.type];

      if (existing === undefined) {
        node[JSONLD.type] = typeValue;
      } else if (Array.isArray(existing)) {
        (existing as unknown[]).push(typeValue);
      } else {
        node[JSONLD.type] = [
          existing,
          typeValue
        ];
      }
    } else {
      const value = objectToJsonLd(entry.object);
      const existing = node[entry.predicate];

      if (existing === undefined) {
        node[entry.predicate] = value;
      } else if (Array.isArray(existing)) {
        (existing as unknown[]).push(value);
      } else {
        node[entry.predicate] = [
          existing,
          value
        ];
      }
    }
  }

  // Phase 2: count bnode references for inlining
  const bnodeRefCount = new Map<string, number>();

  for (const entry of quads) {
    countBnodeRefs(entry.object, bnodeRefCount);
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

  // Phase 4: emit only non-inlined nodes, preserving insertion order
  const result: Array<Record<string, unknown>> = [];

  for (const [
    id,
    node
  ] of subjects) {
    if (!inlinedIds.has(id)) {
      result.push(node);
    }
  }

  return result;
}

function objectToJsonLd(obj: QuadObjectType): unknown {
  switch (obj.termType) {
    case 'BlankNode':
      return { [JSONLD.id]: obj.value };
    case 'List':
      return {
        [JSONLD.list]: obj.items.map((item) => {
          return objectToJsonLd(item);
        })
      };
    case 'Literal':
      return obj.value;
    case 'NamedNode':
      return { [JSONLD.id]: obj.value };
  }

  return undefined;
}

function countBnodeRefs(obj: QuadObjectType, counts: Map<string, number>): void {
  if (obj.termType === 'BlankNode') {
    counts.set(obj.value, (counts.get(obj.value) ?? 0) + 1);
  } else if (obj.termType === 'List') {
    for (const item of obj.items) {
      countBnodeRefs(item, counts);
    }
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
