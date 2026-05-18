/**
 * Lift — reverse projection from RDF quads back to typed JS objects.
 *
 * Inverse of `projectAbox()`: given quads and a target schema ID,
 * reconstructs plain JS objects by mapping property IRIs back to
 * schema property names and deserializing literal values.
 *
 * Handles:
 * - Internal quads (prefixed `rdf:type`, `classId#propName` IRIs)
 * - External quads (full IRI predicates, blank node nesting)
 * - Inline nested objects (pointer-based type IRIs)
 * - Structural subtyping (Compose.extend child → parent lift)
 *
 * After the RDF/JS spec compliance refactor, `QuadInterface` is itself
 * rdf/js-compatible — external quads from `n3`, `eyereasoner`, etc. can
 * be passed directly without a conversion bridge.
 */

import type { QuadInterface } from '../../interfaces/Quad.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';
import type { SchemaGraphNodeInterface } from '../../interfaces/SchemaGraph.js';
import type { QuadObjectType } from '../../types/Quad.js';
import type { SchemaRegistryInterface } from '../../interfaces/SchemaRegistry.js';
import type { SubjectGroupType } from '../../types/SubjectGroup.js';

import { XSD_COERCERS } from '../../constants/XSD_MAPS.js';

import {
  RDF_TYPE_IRI, XSD_IRI_PREFIX, XSD_PREFIX
} from '../../constants/PREFIXES.js';

import { RDF } from '../../constants/IRI.js';

import { Terms } from './Terms.js';

// ---------------------------------------------------------------------------
// Lift internals
// ---------------------------------------------------------------------------

function groupBySubject(quads: QuadInterface[]): SubjectGroupType {
  const groups: SubjectGroupType = new Map();

  for (const quad of quads) {
    const subjectValue = quad.subject.value;
    let list = groups.get(subjectValue);

    if (!list) {
      list = [];
      groups.set(subjectValue, list);
    }
    list.push(quad);
  }

  return groups;
}

function typeOf(quads: QuadInterface[]): string | undefined {
  for (const quad of quads) {
    const predicateValue = quad.predicate.value;

    if ((predicateValue === RDF.type || predicateValue === RDF_TYPE_IRI)
      && quad.object.termType === 'NamedNode') {
      return quad.object.value;
    }
  }

  return undefined;
}

/**
 * Resolve a type IRI to a graph + node pair.
 *
 * Handles both root schemas (`$id` → direct registry lookup) and inline
 * nested objects with pointer-based IDs (`User#/properties/address`).
 */
function resolveNodeForType(
  typeIri: string,
  registry: SchemaRegistryInterface
): undefined | { 'graph': SchemaGraphInterface;
  'node': SchemaGraphNodeInterface } {
  const directGraph = registry.graph(typeIri);

  if (directGraph) {
    return {
      'graph': directGraph,
      'node': directGraph.rootNode
    };
  }

  // Pointer-based ID: 'https://example.com/User#/properties/address'
  const hashSlash = typeIri.indexOf('#/');

  if (hashSlash === -1) {
    return undefined;
  }

  const rootId = typeIri.slice(0, hashSlash);
  const pointer = typeIri.slice(hashSlash + 1);
  const rootGraph = registry.graph(rootId);

  if (!rootGraph) {
    return undefined;
  }

  try {
    return {
      'graph': rootGraph,
      'node': rootGraph.resolvePointer(pointer)
    };
  } catch {
    return undefined;
  }
}

/**
 * Check if `candidateId` is structurally compatible with `targetId` —
 * i.e. the candidate's root properties are a superset of the target's.
 * This handles `Compose.extend()` child → parent lifting.
 */
function isStructurallyCompatible(
  candidateId: string,
  targetId: string,
  registry: SchemaRegistryInterface
): boolean {
  const candidateGraph = registry.graph(candidateId);
  const targetGraph = registry.graph(targetId);

  if (!candidateGraph || !targetGraph) {
    return false;
  }

  const targetProps = targetGraph.semantics(targetGraph.rootNode).properties;
  const candidateProps = candidateGraph.semantics(candidateGraph.rootNode).properties;

  for (const [name] of targetProps) {
    if (!candidateProps.has(name)) {
      return false;
    }
  }

  return true;
}

const PREDICATE_INDEX_THRESHOLD = 3;

function buildPredicateIndex(subjectQuads: QuadInterface[]): Map<string, QuadInterface[]> {
  const index = new Map<string, QuadInterface[]>();

  for (const quad of subjectQuads) {
    const predicateValue = quad.predicate.value;
    let list = index.get(predicateValue);

    if (list === undefined) {
      list = [];
      index.set(predicateValue, list);
    }
    list.push(quad);
  }

  return index;
}

/**
 * Find quads matching a schema property.
 *
 * Pass 1: exact match using the module's IRI convention (`classId#propName`).
 * Pass 2: fragment match — any predicate whose fragment equals `propName`.
 */
function findPropertyQuads(
  subjectQuads: QuadInterface[],
  classId: string,
  propName: string,
  index: Map<string, QuadInterface[]> | undefined
): QuadInterface[] {
  const exact = `${classId}#${propName}`;

  if (index !== undefined) {
    const byExact = index.get(exact);

    if (byExact !== undefined && byExact.length > 0) {
      return byExact;
    }

    const matches: QuadInterface[] = [];

    for (const [
      predicate,
      quads
    ] of index) {
      const hash = predicate.lastIndexOf('#');

      if (hash !== -1 && predicate.slice(hash + 1) === propName) {
        for (const quad of quads) {
          matches.push(quad);
        }
      }
    }

    return matches;
  }

  const byExact = subjectQuads.filter((quad) => {
    return quad.predicate.value === exact;
  });

  if (byExact.length > 0) {
    return byExact;
  }

  return subjectQuads.filter((quad) => {
    const hash = quad.predicate.value.lastIndexOf('#');

    return hash !== -1 && quad.predicate.value.slice(hash + 1) === propName;
  });
}

function resolveLocalRef(
  graph: SchemaGraphInterface,
  node: SchemaGraphNodeInterface
): SchemaGraphNodeInterface {
  const sem = graph.semantics(node);

  if (sem.ref === undefined) {
    return node;
  }
  if (sem.ref.startsWith('#')) {
    return graph.resolveFragment(sem.ref.slice(1));
  }

  return node;
}

function liftSubject(
  subjectQuads: QuadInterface[],
  classId: string,
  graph: SchemaGraphInterface,
  node: SchemaGraphNodeInterface,
  allGroups: SubjectGroupType,
  registry: SchemaRegistryInterface
): Record<string, unknown> {
  const sem = graph.semantics(node);
  const obj: Record<string, unknown> = {};
  const index = sem.properties.size > PREDICATE_INDEX_THRESHOLD
    ? buildPredicateIndex(subjectQuads)
    : undefined;

  for (const [
    propName,
    propNode
  ] of sem.properties) {
    const matching = findPropertyQuads(subjectQuads, classId, propName, index);

    if (matching.length === 0) {
      continue;
    }

    const resolvedNode = resolveLocalRef(graph, propNode);
    const propSem = graph.semantics(resolvedNode);
    const isArray = propSem.schemaTypes.includes('array');

    const nestedNode = propSem.itemsNode
      ? resolveLocalRef(graph, propSem.itemsNode)
      : resolvedNode;

    if (isArray) {
      obj[propName] = matching.map((quad) => {
        return liftSingleValue(quad.object, nestedNode, graph, allGroups, registry);
      });
    } else if (matching.length === 1) {
      obj[propName] = liftSingleValue(matching[0].object, resolvedNode, graph, allGroups, registry);
    } else {
      obj[propName] = matching.map((quad) => {
        return liftSingleValue(quad.object, nestedNode, graph, allGroups, registry);
      });
    }
  }

  return obj;
}

function liftSingleValue(
  obj: QuadObjectType,
  targetNode: SchemaGraphNodeInterface,
  parentGraph: SchemaGraphInterface,
  allGroups: SubjectGroupType,
  registry: SchemaRegistryInterface
): unknown {
  if (obj.termType === 'Literal') {
    return obj.value;
  }

  // Follow both NamedNode and BlankNode references
  if (obj.termType === 'NamedNode' || obj.termType === 'BlankNode') {
    const refQuads = allGroups.get(obj.value);

    if (refQuads) {
      const refType = typeOf(refQuads);

      if (refType !== undefined) {
        // Try resolving via registry (handles pointer-based IDs too)
        const resolved = resolveNodeForType(refType, registry);

        if (resolved) {
          return liftSubject(refQuads, refType, resolved.graph, resolved.node, allGroups, registry);
        }
      }

      // No type or unresolved — try the target node from the parent schema
      const targetSem = parentGraph.semantics(targetNode);

      if (targetSem.properties.size > 0) {
        return liftSubject(refQuads, targetNode.id, parentGraph, targetNode, allGroups, registry);
      }
    }

    // Plain IRI reference — return as string
    return obj.value;
  }

  return obj.items.map((item) => {
    return liftSingleValue(item, targetNode, parentGraph, allGroups, registry);
  });
}

/**
 * Coerce a raw string literal value via XSD datatype prefix.
 * Used when lifting external (non-internal) quads that carry string-serialised values.
 */
function coerceLiteralValue(raw: string, datatype: string): unknown {
  const local = datatype.startsWith(XSD_PREFIX) ? datatype.slice(XSD_PREFIX.length) : datatype;
  const coercer = XSD_COERCERS.get(local);

  return coercer === undefined ? raw : coercer(raw);
}

/**
 * Normalise an XSD datatype IRI to the module's prefixed form.
 * `http://www.w3.org/2001/XMLSchema#string` → `xsd:string`
 */
function normalizeDatatype(dt: string): string {
  return dt.startsWith(XSD_IRI_PREFIX)
    ? `xsd:${dt.slice(XSD_IRI_PREFIX.length)}`
    : dt;
}

/**
 * Lift typed JS objects from RDF quads.
 *
 * Given a schema ID and a set of quads (from ABox projection, a reasoner,
 * or any RDF source that produces rdf/js-compatible quads), reconstructs
 * plain JS objects matching the schema.
 *
 * Supports:
 * - Internal quads (from `projectAbox`) — 100% lossless round-trip
 * - External quads (from `n3`, `eyereasoner`) — pass directly (QuadInterface is
 *   rdf/js-compatible; no conversion bridge required)
 * - Structural subtyping — `Compose.extend()` children lift as parent types
 * - Inline nested objects — pointer-based type IRIs resolved within parent graph
 * - Blank node nesting — blank node references followed like named nodes
 *
 * @param schemaId - The `$id` of the target schema.
 * @param quads - RDF quads in rdf/js-compatible format.
 * @param registry - Schema registry for graph/schema lookup.
 * @returns Array of reconstructed objects (unvalidated — caller should `parse()` for full validation).
 */
function liftInstancesImpl(
  schemaId: string,
  quads: QuadInterface[],
  registry: SchemaRegistryInterface
): unknown[] {
  const targetResolved = resolveNodeForType(schemaId, registry);

  if (!targetResolved) {
    return [];
  }

  const {
    'graph': targetGraph, 'node': targetNode
  } = targetResolved;
  const groups = groupBySubject(quads);
  const results: unknown[] = [];

  for (const [
    , subjectQuads
  ] of groups) {
    const subjectType = typeOf(subjectQuads);

    if (subjectType === undefined) {
      continue;
    }

    if (subjectType === schemaId) {
      // Exact match
      results.push(liftSubject(subjectQuads, schemaId, targetGraph, targetNode, groups, registry));
      continue;
    }

    // Structural compatibility — e.g. Compose.extend child → parent
    if (isStructurallyCompatible(subjectType, schemaId, registry)) {
      results.push(liftSubject(subjectQuads, subjectType, targetGraph, targetNode, groups, registry));
    }
  }

  return results;
}

/**
 * Adapt an external RDF/JS quad (from n3, eyereasoner, etc.) to a QuadInterface.
 *
 * External rdf/js quads are structurally compatible with QuadInterface when they
 * carry term objects (termType + value) on subject, predicate, and object. This
 * adapter handles the common case where the external library uses full IRI strings
 * for rdf:type and XSD datatypes that the internal lift logic expects in prefixed form.
 *
 * Normalisation performed:
 * - rdf:type full IRI → prefixed `rdf:type`
 * - XSD datatype full IRIs → `xsd:localName`
 * - Literal values are coerced from string by XSD datatype
 *
 * All term slots on the returned quad are constructed through the project's
 * `Terms` factory (`Terms.iri`, `Terms.blank`, `Terms.literal`, `Terms.defaultGraph`).
 * Equality semantics therefore follow the rdf/js spec as implemented by
 * `src/modules/rdf/Terms.ts` — `equals()` compares `termType` and `value`
 * (plus `datatype` and `language` for literals) on the normalised term objects,
 * not on whatever shape the external library originally produced.
 */
interface ExternalRdfJsQuadShape {
  'object': { 'datatype'?: { 'value': string };
    'language'?: string;
    'termType': string;
    'value': string };
  'predicate': { 'value': string };
  'subject': { 'value': string };
}

function fromExternalRdfJsQuad(rdfQuad: ExternalRdfJsQuadShape): QuadInterface {
  const normalizedPredicate = rdfQuad.predicate.value === RDF_TYPE_IRI
    ? RDF.type
    : rdfQuad.predicate.value;

  let objectTerm: QuadObjectType;
  const obj = rdfQuad.object;

  if (obj.termType === 'Literal') {
    const normalizedDatatype = normalizeDatatype(obj.datatype?.value ?? '');
    const coercedValue = coerceLiteralValue(obj.value, normalizedDatatype);

    objectTerm = Terms.literal(coercedValue, {
      'datatype': Terms.iri(normalizedDatatype),
      'language': obj.language ?? ''
    });
  } else if (obj.termType === 'BlankNode') {
    objectTerm = Terms.blank(obj.value);
  } else {
    objectTerm = Terms.iri(obj.value);
  }

  return {
    'graph': Terms.defaultGraph(),
    'object': objectTerm,
    'predicate': Terms.iri(normalizedPredicate),
    'subject': Terms.iri(rdfQuad.subject.value)
  };
}

export const Lift = {
  /**
   * Adapt an external RDF/JS quad (from n3, eyereasoner, etc.) into a QuadInterface.
   *
   * Use this when the external library produces quads with string-serialised
   * XSD datatypes and full IRI rdf:type — Lift.fromExternalQuad normalises these
   * to the prefixed forms that json-tology's lift logic expects.
   *
   * If the external library already produces rdf/js-compliant quads with term objects,
   * you can pass them directly to `Lift.instances()` without conversion.
   *
   * @deprecated Prefer passing rdf/js quads directly to `Lift.instances()`.
   *   This method remains for compatibility with libraries that use string-valued
   *   datatypes (full XSD IRIs) rather than the prefixed form json-tology uses internally.
   */
  fromExternalQuad(rdfQuad: ExternalRdfJsQuadShape): QuadInterface {
    return fromExternalRdfJsQuad(rdfQuad);
  },

  instances(
    schemaId: string,
    quads: QuadInterface[],
    registry: SchemaRegistryInterface
  ): unknown[] {
    return liftInstancesImpl(schemaId, quads, registry);
  }
} as const;
