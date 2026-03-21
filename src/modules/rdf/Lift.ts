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
 */

import type { QuadInterface } from '../../interfaces/quad.js';
import type { SchemaGraphInterface } from '../../interfaces/schema-graph-impl.js';
import type { SchemaGraphNodeInterface } from '../../interfaces/schema-graph.js';
import type { QuadObjectType } from '../../types/quad.js';
import type { SchemaRegistryInterface } from '../../interfaces/schema-registry.js';
import {
  RDF_TYPE_IRI, XSD_IRI_PREFIX
} from '../../constants/prefixes.js';

// ---------------------------------------------------------------------------
// RDF/JS interop
// ---------------------------------------------------------------------------

/**
 * Minimal RDF/JS quad shape (compatible with `n3`, `@rdfjs/types`, etc.).
 * Used to convert external quads into the module's `QuadInterface`.
 */
export interface RdfJsQuadInterface {
  'object': {
    'datatype'?: { 'value': string };
    'language'?: string;
    'termType': string;
    'value': string;
  };
  'predicate': { 'value': string };
  'subject': { 'value': string };
}

/**
 * Normalize a predicate IRI to the module's internal convention.
 * Maps the full `rdf:type` IRI to the prefixed string used internally.
 */
function normalizePredicate(iri: string): string {
  return iri === RDF_TYPE_IRI ? 'rdf:type' : iri;
}

/**
 * Normalize an XSD datatype IRI to the module's prefixed form.
 * `http://www.w3.org/2001/XMLSchema#string` → `xsd:string`
 */
function normalizeDatatype(dt: string): string {
  return dt.startsWith(XSD_IRI_PREFIX)
    ? `xsd:${dt.slice(XSD_IRI_PREFIX.length)}`
    : dt;
}

/**
 * Convert an RDF/JS quad (from `n3`, `eyereasoner`, etc.) to the
 * module's internal `QuadInterface`.
 */
export function fromRdfQuad(rdfQuad: RdfJsQuadInterface): QuadInterface {
  return {
    'object': rdfTermToQuadObject(rdfQuad.object),
    'predicate': normalizePredicate(rdfQuad.predicate.value),
    'subject': rdfQuad.subject.value
  };
}

function rdfTermToQuadObject(term: RdfJsQuadInterface['object']): QuadObjectType {
  if (term.termType === 'Literal') {
    const normalizedDatatype = normalizeDatatype(term.datatype?.value ?? '');

    return {
      'datatype': {
        'termType': 'NamedNode',
        'value': normalizedDatatype
      },
      'language': term.language ?? '',
      'termType': 'Literal',
      'value': coerceLiteralValue(term.value, normalizedDatatype)
    };
  }

  if (term.termType === 'BlankNode') {
    return {
      'termType': 'BlankNode',
      'value': term.value
    };
  }

  return {
    'termType': 'NamedNode',
    'value': term.value
  };
}

function coerceLiteralValue(raw: string, datatype: string): unknown {
  // Strip prefix — datatype is already normalized to xsd:xxx
  const local = datatype.startsWith('xsd:') ? datatype.slice(4) : datatype;

  switch (local) {
    case 'boolean':
      return raw === 'true';
    case 'decimal':
    case 'double':
    case 'float':
      return Number.parseFloat(raw);
    case 'int':
    case 'integer':
    case 'long':
    case 'short':
      return Number.parseInt(raw, 10);
    default:
      return raw;
  }
}

// ---------------------------------------------------------------------------
// Lift internals
// ---------------------------------------------------------------------------

type SubjectGroupType = Map<string, QuadInterface[]>;

function groupBySubject(quads: QuadInterface[]): SubjectGroupType {
  const groups: SubjectGroupType = new Map();

  for (const quad of quads) {
    let list = groups.get(quad.subject);

    if (!list) {
      list = [];
      groups.set(quad.subject, list);
    }
    list.push(quad);
  }

  return groups;
}

function typeOf(quads: QuadInterface[]): string | undefined {
  for (const quad of quads) {
    if (quad.predicate === 'rdf:type' && quad.object.termType === 'NamedNode') {
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

/**
 * Find quads matching a schema property.
 *
 * Pass 1: exact match using the module's IRI convention (`classId#propName`).
 * Pass 2: fragment match — any predicate whose fragment equals `propName`.
 */
function findPropertyQuads(
  subjectQuads: QuadInterface[],
  classId: string,
  propName: string
): QuadInterface[] {
  const exact = `${classId}#${propName}`;
  const byExact = subjectQuads.filter((quad) => {
    return quad.predicate === exact;
  });

  if (byExact.length > 0) {
    return byExact;
  }

  return subjectQuads.filter((quad) => {
    const hash = quad.predicate.lastIndexOf('#');

    return hash !== -1 && quad.predicate.slice(hash + 1) === propName;
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

  for (const [
    propName,
    propNode
  ] of sem.properties) {
    const matching = findPropertyQuads(subjectQuads, classId, propName);

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
 * Lift typed JS objects from RDF quads.
 *
 * Given a schema ID and a set of quads (from ABox projection, a reasoner,
 * or any RDF source), reconstructs plain JS objects matching the schema.
 *
 * Supports:
 * - Internal quads (from `projectAbox`) — 100% lossless round-trip
 * - External quads (from `n3`, `eyereasoner`) — via `fromRdfQuad()` conversion
 * - Structural subtyping — `Compose.extend()` children lift as parent types
 * - Inline nested objects — pointer-based type IRIs resolved within parent graph
 * - Blank node nesting — blank node references followed like named nodes
 *
 * @param schemaId - The `$id` of the target schema.
 * @param quads - RDF quads in the module's internal format.
 * @param registry - Schema registry for graph/schema lookup.
 * @returns Array of reconstructed objects (unvalidated — caller should `parse()` for full validation).
 */
export function liftInstances(
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
