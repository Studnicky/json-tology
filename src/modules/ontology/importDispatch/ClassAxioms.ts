/**
 * ClassAxioms dispatcher — OWL 2 §9.1 Class Expression Axioms
 *
 * Responsible for:
 *   owl:Class declaration    — produces a minimal schema stub for each named class
 *   rdfs:subClassOf          — subclass relationships between named classes → allOf: [{ $ref }]
 *   owl:equivalentClass      — structural equivalences → $ref wire shape
 *   owl:disjointWith         — mutual disjointness → disjointWith annotation (symmetric)
 *   owl:complementOf         — complement of a class → not: { $ref } + runtime invariant
 *   owl:disjointUnionOf      — disjoint union → oneOf + registry-level constraint
 *
 * Bucket strategy: structural — each axiom maps to a `schemaDeltas` patch on the
 * subject class (`allOf`/`not`/`disjointWith`/`$ref` additions).
 *
 * Symmetric axioms: `disjointWith` is symmetric in OWL 2 — both directions are
 * emitted in the fragment so the resulting schemas are pairwise consistent.
 */

import type { QuadInterface } from '../../../interfaces/Quad.js';
import type {
  OwlImportContext, OwlImportFragment
} from '../../../interfaces/OwlImport.js';
import type { JsonSchemaDocumentObjectType } from '../../../types/Schema.js';
import type { InvariantInterface } from '../../../interfaces/Invariant.js';
import { Lists } from '../../rdf/Lists.js';

// ---------------------------------------------------------------------------
// Full IRI constants (quads arrive with fully-expanded IRIs after JSON-LD normalisation)
// ---------------------------------------------------------------------------

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const OWL_CLASS = 'http://www.w3.org/2002/07/owl#Class';
const OWL_COMPLEMENT_OF = 'http://www.w3.org/2002/07/owl#complementOf';
const OWL_DISJOINT_UNION_OF = 'http://www.w3.org/2002/07/owl#disjointUnionOf';
const OWL_DISJOINT_WITH = 'http://www.w3.org/2002/07/owl#disjointWith';
const OWL_EQUIVALENT_CLASS = 'http://www.w3.org/2002/07/owl#equivalentClass';
const OWL_UNION_OF = 'http://www.w3.org/2002/07/owl#unionOf';
const RDFS_CLASS = 'http://www.w3.org/2000/01/rdf-schema#Class';
const RDFS_SUBCLASSOF = 'http://www.w3.org/2000/01/rdf-schema#subClassOf';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Extract member IRIs from an owl:unionOf literal value.
 *
 * The forward path serialises equivalentClass as a Literal whose `.value` is
 * the anonymous class node object:
 *   `{ '@type': 'owl:Class', 'owl:unionOf': { '@list': [{ '@id': '...' }, ...] } }`.
 */
function extractUnionMembers(objectValue: unknown): string[] {
  if (typeof objectValue !== 'object' || objectValue === null) {
    return [];
  }
  const obj = objectValue as Record<string, unknown>;
  const unionOf = obj[OWL_UNION_OF];

  if (typeof unionOf !== 'object' || unionOf === null) {
    return [];
  }

  const list = (unionOf as Record<string, unknown>)['@list'];

  if (!Array.isArray(list)) {
    return [];
  }

  const members: string[] = [];

  for (const item of list) {
    if (typeof item === 'object' && item !== null) {
      const id = (item as Record<string, unknown>)['@id'];

      if (typeof id === 'string') {
        members.push(id);
      }
    }
  }

  return members;
}

/**
 * Extract member IRIs from an owl:disjointUnionOf quad object.
 *
 * Supports two encodings:
 *   1. Standard RDF list: `quad.object` is the head of an rdf:first/rdf:rest
 *      chain that materialises elsewhere in `allQuads`. Walked via
 *      `Lists.collect`.
 *   2. Legacy Literal encoding: a serialised union string. Decoded via
 *      `extractUnionMembers`.
 */
/**
 * Walk the bnode's `owl:unionOf` list and return the member IRIs.
 *
 * Given a blank-node identifier that OwlProjection emitted as an anonymous
 * owl:Class with an owl:unionOf list, find its unionOf head among `allQuads`
 * and return the NamedNode IRI of each list member.
 */
function extractEquivalentMembers(
  bnodeId: string,
  allQuads: readonly QuadInterface[]
): string[] {
  const unionPredicates: ReadonlySet<string> = new Set([
    'http://www.w3.org/2002/07/owl#unionOf',
    'owl:unionOf'
  ]);
  const unionQuad = allQuads.find((entry) => {
    return entry.subject.termType === 'BlankNode'
      && entry.subject.value === bnodeId
      && unionPredicates.has(entry.predicate.value);
  });

  if (unionQuad === undefined) {
    return [];
  }

  const head = unionQuad.object;

  if (head.termType !== 'BlankNode' && head.termType !== 'NamedNode') {
    return [];
  }

  return Lists.collect(head, allQuads)
    .filter((item) => {
      return item.termType === 'NamedNode';
    })
    .map((item) => {
      return item.value;
    });
}

function extractListMembers(quad: QuadInterface, allQuads: readonly QuadInterface[]): string[] {
  const obj = quad.object;

  if (obj.termType === 'Literal') {
    return extractUnionMembers(obj.value);
  }
  if (obj.termType !== 'BlankNode' && obj.termType !== 'NamedNode') {
    return [];
  }

  return Lists.collect(obj, allQuads)
    .filter((item) => {
      return item.termType === 'NamedNode';
    })
    .map((item) => {
      return item.value;
    });
}

/**
 * Merge an allOf `{ $ref: refIri }` entry into the delta for `classIri`.
 * Accumulates refs without duplicating. Skips blank nodes and internal
 * fragment subjects (e.g. `urn:bookstore:EBook#/allOf/1`).
 */
function mergeAllOfRef(
  deltas: Map<string, Partial<JsonSchemaDocumentObjectType>>,
  classIri: string,
  refIri: string
): void {
  if (refIri.startsWith('_:') || refIri.includes('#/')) {
    return;
  }

  const existing = deltas.get(classIri) ?? {};
  const existingAllOf = Array.isArray(existing.allOf)
    ? (existing.allOf as Array<Partial<JsonSchemaDocumentObjectType>>)
    : [];

  const alreadyPresent = existingAllOf.some((entry) => {
    return (entry as Record<string, unknown>).$ref === refIri;
  });

  if (alreadyPresent) {
    return;
  }

  const newAllOf = [
    ...existingAllOf,
    { '$ref': refIri }
  ] as readonly JsonSchemaDocumentObjectType[];

  deltas.set(classIri, {
    ...existing,
    'allOf': newAllOf
  });
}

// ---------------------------------------------------------------------------
// Public dispatcher
// ---------------------------------------------------------------------------

/**
 * Process class-level OWL axioms (SubClassOf, EquivalentClasses, DisjointClasses,
 * DisjointUnion, ComplementOf) and return a partial import fragment.
 *
 * @param quads - All quads from the input graph.
 * @param ctx   - Shared import context (graph, curie, IRI sets, reporting helpers).
 * @returns OwlImportFragment with schemaDeltas and/or invariants populated.
 */
export function importClassAxioms(quads: QuadInterface[], ctx: OwlImportContext): OwlImportFragment {
  const schemaDeltas = new Map<string, Partial<JsonSchemaDocumentObjectType>>();
  const invariants: Array<{ 'invariant': InvariantInterface;
    'schemaId': string; }> = [];

  // ------------------------------------------------------------------
  // Pass 1: Emit a minimal stub for every named owl:Class / rdfs:Class.
  // Axiom patches in Pass 2 merge on top of these stubs.
  // ------------------------------------------------------------------
  for (const quad of quads) {
    if (quad.predicate.value !== RDF_TYPE || quad.subject.termType !== 'NamedNode') {
      continue;
    }

    const objValue = quad.object.termType === 'NamedNode'
      || quad.object.termType === 'BlankNode'
      || quad.object.termType === 'Literal'
      ? quad.object.value
      : undefined;

    if (objValue === OWL_CLASS || objValue === RDFS_CLASS) {
      const classIri = quad.subject.value;

      if (!schemaDeltas.has(classIri)) {
        schemaDeltas.set(classIri, {
          'properties': {},
          'required': [],
          'type': 'object'
        });
      }
    }
  }

  // ------------------------------------------------------------------
  // Pass 2: Walk axiom predicates for each named class subject.
  // ------------------------------------------------------------------
  for (const quad of quads) {
    // Only named class subjects are in scope for class axioms.
    if (quad.subject.termType !== 'NamedNode') {
      continue;
    }

    const subjectIri = quad.subject.value;

    if (!ctx.allClassIris.has(subjectIri)) {
      continue;
    }

    const predicate = quad.predicate.value;
    const objTermType = quad.object.termType;

    // Cases ordered alphabetically per perfectionist/sort-switch-case.
    switch (predicate) {
      case OWL_COMPLEMENT_OF:
        // complementOf → not: { $ref: complementTarget } + runtime invariant.
        // TypeScript has no complement type; the structural `not` keyword handles JSON Schema
        // validation while the invariant documents the semantic for downstream tooling.
        if (objTermType === 'NamedNode') {
          const complementTarget = quad.object.value;
          const existing = schemaDeltas.get(subjectIri) ?? {};

          schemaDeltas.set(subjectIri, {
            ...existing,
            'not': { '$ref': complementTarget }
          });

          const capturedTarget = complementTarget;
          const capturedSubjectIri = subjectIri;
          const inv: InvariantInterface = {
            'fn': (_: unknown) => {
              // Real enforcement is via JSON Schema `not` keyword.
              // This invariant carries the complementOf signature for runtime tracing.
              return null;
            },
            'name': `complementOf:${capturedSubjectIri}:not:${capturedTarget}`,
            'pointer': ''
          };

          invariants.push({
            'invariant': inv,
            'schemaId': subjectIri
          });
        }
        break;

      case OWL_DISJOINT_UNION_OF:
        // disjointUnionOf → oneOf: [{ $ref: C1 }, { $ref: C2 }, ...].
        {
          const members = extractListMembers(quad, quads);

          if (members.length > 0) {
            const oneOf = members.map((memberIri) => {
              return { '$ref': memberIri };
            }) as readonly JsonSchemaDocumentObjectType[];

            const existing = schemaDeltas.get(subjectIri) ?? {};

            schemaDeltas.set(subjectIri, {
              ...existing,
              'oneOf': oneOf
            });
          }
        }
        break;

      case OWL_DISJOINT_WITH:
        // disjointWith is symmetric in OWL — emit both directions so pairwise schemas are consistent.
        if (objTermType === 'NamedNode') {
          const otherIri = quad.object.value;

          // Forward direction: subject disjointWith other.
          {
            const existing = schemaDeltas.get(subjectIri) ?? {};

            schemaDeltas.set(subjectIri, {
              ...existing,
              'disjointWith': otherIri
            });
          }

          // Reverse direction: other disjointWith subject (symmetric closure).
          if (ctx.allClassIris.has(otherIri)) {
            const otherExisting = schemaDeltas.get(otherIri) ?? {};

            if (!('disjointWith' in otherExisting)) {
              schemaDeltas.set(otherIri, {
                ...otherExisting,
                'disjointWith': subjectIri
              });
            }
          }
        }
        break;

      case OWL_EQUIVALENT_CLASS:
        // equivalentClass → structural $ref equivalence wire shape.
        //
        // Two encodings are accepted:
        //   1. Direct named-class equivalence: object is a NamedNode IRI.
        //   2. Bnode-wrapped union: object is a BlankNode that carries
        //      `owl:unionOf [...]` whose list members are the equivalent
        //      class IRIs. This is what OwlProjection emits.
        //
        // Wire shape: { $ref: firstMember } — matches Compose.equivalent output.
        switch (objTermType) {
          case 'BlankNode': {
            const members = extractEquivalentMembers(quad.object.value, quads);

            if (members.length > 0) {
              const existing = schemaDeltas.get(subjectIri) ?? {};

              schemaDeltas.set(subjectIri, {
                ...existing,
                '$ref': members[0]
              });
            }

            break;
          }
          case 'Literal': {
          // Legacy: JSON-LD serialised wrapper carried as a Literal.
            const members = extractUnionMembers(quad.object.value);

            if (members.length > 0) {
              const existing = schemaDeltas.get(subjectIri) ?? {};

              schemaDeltas.set(subjectIri, {
                ...existing,
                '$ref': members[0]
              });
            }

            break;
          }
          case 'NamedNode': {
            const existing = schemaDeltas.get(subjectIri) ?? {};

            schemaDeltas.set(subjectIri, {
              ...existing,
              '$ref': quad.object.value
            });

            break;
          }
          case 'Quad':
          case 'Variable':
            // RDF* quoted-triple / SPARQL variable — not a valid equivalentClass value.
            break;
        }
        break;

      case RDFS_SUBCLASSOF:
        // subClassOf → allOf: [{ $ref: parentIri }].
        // NamedNode objects are named parent classes; Literal/BlankNode objects are
        // restriction blank nodes handled by the PropertyRestrictions dispatcher.
        if (objTermType === 'NamedNode') {
          mergeAllOfRef(schemaDeltas, subjectIri, quad.object.value);
        }
        break;

      default:
        // Not a class axiom predicate — leave for other dispatchers.
        break;
    }
  }

  return {
    'characteristics': [],
    'individuals': [],
    invariants,
    'sameAs': [],
    'schemaDeltas': schemaDeltas
  };
}
