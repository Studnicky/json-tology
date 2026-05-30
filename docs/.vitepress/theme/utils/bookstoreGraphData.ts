import {
  BookListPageSchema,
  bookstoreEntities,
  CustomerSchema,
  EBookSchema,
  OrderSchema,
  PrintBookSchema,
  RareBookSchema,
  ReviewSchema,
  SequelSchema,
  SignedFirstEditionSchema,
  SimilarBookSchema
} from '../../../../examples/docs/bookstore/index.js';
import { aboxFixtures } from '../../../../examples/docs/bookstore/aboxFixtures.js';
import type { QuadInterface } from '../../../../src/interfaces/Quad.js';

// ---------------------------------------------------------------------------
// OWL vocabulary IRIs
// ---------------------------------------------------------------------------

const OWL_CLASS = 'http://www.w3.org/2002/07/owl#Class';
const OWL_OBJECT_PROP = 'http://www.w3.org/2002/07/owl#ObjectProperty';
const OWL_DATATYPE_PROP = 'http://www.w3.org/2002/07/owl#DatatypeProperty';
const OWL_RESTRICTION = 'http://www.w3.org/2002/07/owl#Restriction';
const OWL_ON_PROPERTY = 'http://www.w3.org/2002/07/owl#onProperty';
const OWL_SOME_VALUES_FROM = 'http://www.w3.org/2002/07/owl#someValuesFrom';
const OWL_ALL_VALUES_FROM = 'http://www.w3.org/2002/07/owl#allValuesFrom';
const OWL_HAS_VALUE = 'http://www.w3.org/2002/07/owl#hasValue';
const OWL_CARDINALITY = 'http://www.w3.org/2002/07/owl#cardinality';
const OWL_MIN_CARDINALITY = 'http://www.w3.org/2002/07/owl#minCardinality';
const OWL_MAX_CARDINALITY = 'http://www.w3.org/2002/07/owl#maxCardinality';
const OWL_EQUIVALENT = 'http://www.w3.org/2002/07/owl#equivalentClass';
const OWL_DISJOINT = 'http://www.w3.org/2002/07/owl#disjointWith';
const OWL_COMPLEMENT = 'http://www.w3.org/2002/07/owl#complementOf';
const OWL_SAME_AS = 'http://www.w3.org/2002/07/owl#sameAs';
const RDFS_RANGE = 'http://www.w3.org/2000/01/rdf-schema#range';
const RDFS_DOMAIN = 'http://www.w3.org/2000/01/rdf-schema#domain';
const RDFS_SUBCLASS = 'http://www.w3.org/2000/01/rdf-schema#subClassOf';
const XSD_PREFIX = 'http://www.w3.org/2001/XMLSchema#';
const RDF_LIST = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#List';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NodeData {
  id: string;
  label: string;
  kind: 'entity' | 'instance' | 'literal' | 'primitive';
}

export interface EdgeData {
  id: string;
  source: string;
  target: string;
  label: string;
  kind:
    | 'annotatedEdge'
    | 'complementOf'
    | 'disjointWith'
    | 'domain'
    | 'equivalentClass'
    | 'instanceProperty'
    | 'instanceType'
    | 'range'
    | 'restriction'
    | 'sameAs'
    | 'subClassOf';
}

export interface CytoscapeElements {
  nodes: Array<{ data: NodeData }>;
  edges: Array<{ data: EdgeData }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function iri(val: unknown): string | null {
  if (typeof val === 'string') {
    return val;
  }
  if (val !== null && typeof val === 'object' && typeof (val as Record<string, unknown>)['@id'] === 'string') {
    return (val as Record<string, unknown>)['@id'] as string;
  }

  return null;
}

/**
 * Extracts target IRIs from an owl:equivalentClass value.
 * Handles both simple { '@id': '...' } and complex unionOf/@list shapes
 * that the OWL projection emits for Compose.equivalent().
 */
function equivalentClassTargets(val: unknown): string[] {
  if (!val || typeof val !== 'object') {
    return [];
  }
  const obj = val as Record<string, unknown>;

  // Simple direct IRI reference
  const directIri = iri(val);

  if (directIri) {
    return [directIri];
  }

  // Complex shape: { '@type': 'owl:Class', 'owl:unionOf': { '@list': [...] } }
  const OWL_UNION_OF = 'http://www.w3.org/2002/07/owl#unionOf';
  const unionOf = obj[OWL_UNION_OF];

  if (unionOf && typeof unionOf === 'object') {
    const listObj = unionOf as Record<string, unknown>;
    const list = listObj['@list'];

    if (Array.isArray(list)) {
      const results: string[] = [];

      for (const item of list) {
        const id = iri(item);

        if (id) {
          results.push(id);
        }
      }

      return results;
    }
  }

  return [];
}

function nodeLabel(id: string): string {
  const hash = id.lastIndexOf('#');

  if (hash !== -1) {
    const after = id.slice(hash + 1);
    const slash = after.lastIndexOf('/');

    return slash !== -1 ? after.slice(slash + 1) : after;
  }
  const slash = id.lastIndexOf('/');

  if (slash !== -1) {
    return id.slice(slash + 1);
  }
  const colon = id.lastIndexOf(':');

  if (colon !== -1) {
    return id.slice(colon + 1);
  }

  return id;
}

// Restriction descriptors carry the class-scoped property IDENTIFIER
// (`urn:bookstore:Book#authors`) — the form the type system parses and the
// projection resolves. The emitted TBox (and every property node in this graph)
// uses the flat predicate (`https://bookstore.example/authors`), so a restriction
// edge must target that flat node to stay connected rather than dangling on the
// class-scoped identifier.
const PREDICATE_BASE_IRI = 'https://bookstore.example';

function flatOnProperty(onProperty: string): string {
  const hash = onProperty.lastIndexOf('#');

  return hash === -1 ? onProperty : `${PREDICATE_BASE_IRI}/${onProperty.slice(hash + 1)}`;
}

function isPropertyNode(id: string): boolean {
  return id.includes('#');
}

function isBuiltinType(id: string): boolean {
  return id.startsWith(XSD_PREFIX) || id === RDF_LIST;
}

function refTarget(propSchema: unknown): string | null {
  if (!propSchema || typeof propSchema !== 'object') return null;
  const ps = propSchema as Record<string, unknown>;

  if (typeof ps['$ref'] === 'string') return ps['$ref'];
  if (ps['type'] === 'array' && ps['items'] && typeof ps['items'] === 'object') {
    const items = ps['items'] as Record<string, unknown>;
    if (typeof items['$ref'] === 'string') return items['$ref'];
    // Handle BaseTypes.page() and similar inlined-schema patterns: items
    // carries the full schema object with $id rather than a $ref pointer.
    if (typeof items['$id'] === 'string') return items['$id'];
  }
  return null;
}

/**
 * Yields property maps reachable from a schema: the schema's own
 * `properties` block plus the `properties` block of every entry in
 * `allOf` (recursively). Multi-parent `Compose.subClassOf` bodies
 * declare their fields inside `allOf[N]`; semantically those fields
 * belong to the top-level class, so the second-pass $ref walk needs
 * to see them under the class's own $id.
 */
function* collectPropertyMaps(schema: Record<string, unknown>): Generator<Record<string, unknown>> {
  const own = schema['properties'];
  if (own !== null && typeof own === 'object') {
    yield own as Record<string, unknown>;
  }
  const allOf = schema['allOf'];
  if (Array.isArray(allOf)) {
    for (const member of allOf) {
      if (member !== null && typeof member === 'object') {
        yield* collectPropertyMaps(member as Record<string, unknown>);
      }
    }
  }
}

/**
 * Maps an anonymous body IRI like `urn:bookstore:Foo#/allOf/2` back to its
 * owning top-level class IRI (`urn:bookstore:Foo`) when that class is
 * registered. OWL projects properties declared in `allOf` bodies with the
 * body's anonymous IRI as `rdfs:domain`; for graph rendering we collapse
 * that back to the class the user actually authored.
 */
function resolveTopLevelClass(domainId: string, entityIds: Set<string>): string | null {
  if (entityIds.has(domainId)) return domainId;
  const hash = domainId.indexOf('#');
  if (hash === -1) return null;
  const prefix = domainId.slice(0, hash);
  return entityIds.has(prefix) ? prefix : null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Derives Cytoscape elements (nodes + edges) from the live bookstore registry.
 * Walks both the OWL TBox quads and each schema's properties to ensure
 * every $ref relation is captured as an edge.
 */
export function toCytoscapeElements(): CytoscapeElements {
  const tboxRaw = bookstoreEntities.toTbox().jsonLdObject()['@graph'] as Array<Record<string, unknown>>;
  const registeredSchemas = bookstoreEntities.registry.list() as Array<Record<string, unknown>>;

  const entityIds = new Set<string>(
    registeredSchemas
      .filter((schema) => {
        return schema && typeof schema === 'object' && schema['type'] === 'object';
      })
      .map((schema) => {
        return schema['$id'] as string;
      })
  );

  const nodes: Array<{ data: NodeData }> = [];
  const edges: Array<{ data: EdgeData }> = [];
  const seenNodeIds = new Set<string>();
  const seenEdgeIds = new Set<string>();

  function addNode(id: string, explicit?: { 'kind': NodeData['kind'];
    'label': string }): void {
    if (seenNodeIds.has(id)) {
      return;
    }
    seenNodeIds.add(id);
    nodes.push({
      'data': {
        id,
        'kind': explicit?.kind ?? (entityIds.has(id) ? 'entity' : 'primitive'),
        'label': explicit?.label ?? nodeLabel(id)
      }
    });
  }

  function addEdge(source: string, target: string, edgeLabel: string, kind: EdgeData['kind']): void {
    const edgeId = `${source}__${edgeLabel}__${target}`;

    if (seenEdgeIds.has(edgeId)) {
      return;
    }
    seenEdgeIds.add(edgeId);
    edges.push({
      'data': {
        'id': edgeId,
        kind,
        'label': edgeLabel,
        source,
        target
      }
    });
  }

  // Walk OWL TBox quads
  for (const node of tboxRaw) {
    if (typeof node !== 'object' || node === null) {
      continue;
    }

    const nodeId = node['@id'];

    if (typeof nodeId !== 'string') {
      continue;
    }

    const rawType = node['@type'];
    let types: string[];

    if (Array.isArray(rawType)) {
      types = rawType as string[];
    } else if (rawType) {
      types = [rawType as string];
    } else {
      types = [];
    }

    // Class nodes → graph nodes
    if (types.includes(OWL_CLASS) && !isPropertyNode(nodeId)) {
      addNode(nodeId);

      const subClassOf = node[RDFS_SUBCLASS];

      if (subClassOf) {
        const subs = Array.isArray(subClassOf) ? subClassOf : [subClassOf];

        for (const sub of subs) {
          // Skip inlined owl:Restriction nodes — these are emitted by the OWL
          // projection for every JSON-Schema `required` property and every
          // `items.$ref` array binding (allValuesFrom). User-authored
          // restrictions are read separately below from each schema's
          // `jt:restrictions` annotation, which gives a clean signal.
          if (sub && typeof sub === 'object') {
            const subType = Array.isArray((sub as Record<string, unknown>)['@type'])
              ? (sub as Record<string, unknown>)['@type'] as string[]
              : [(sub as Record<string, unknown>)['@type'] as string];

            if (subType.includes(OWL_RESTRICTION)) {
              continue;
            }
          }

          const targetId = iri(sub);

          if (targetId && !targetId.startsWith('_:') && !isPropertyNode(targetId)) {
            addEdge(nodeId, targetId, 'subClassOf', 'subClassOf');
          }
        }
      }

      const equiv = node[OWL_EQUIVALENT];

      if (equiv) {
        const equivVals = Array.isArray(equiv) ? equiv : [equiv];

        for (const eq of equivVals) {
          for (const targetId of equivalentClassTargets(eq)) {
            if (!isBuiltinType(targetId)) {
              addNode(targetId);
              addEdge(nodeId, targetId, 'equivalentClass', 'equivalentClass');
            }
          }
        }
      }

      const disjoint = node[OWL_DISJOINT];

      if (disjoint) {
        const disjointVals = Array.isArray(disjoint) ? disjoint : [disjoint];

        for (const dj of disjointVals) {
          const targetId = iri(dj);

          if (targetId && !targetId.startsWith('_:')) {
            addNode(targetId);
            addEdge(nodeId, targetId, 'disjointWith', 'disjointWith');
          }
        }
      }

      const complement = node[OWL_COMPLEMENT];

      if (complement) {
        const complementVals = Array.isArray(complement) ? complement : [complement];

        for (const cp of complementVals) {
          const targetId = iri(cp);

          if (targetId && !targetId.startsWith('_:')) {
            addNode(targetId);
            addEdge(nodeId, targetId, 'complementOf', 'complementOf');
          }
        }
      }

      const sameAs = node[OWL_SAME_AS];

      if (sameAs) {
        const sameAsVals = Array.isArray(sameAs) ? sameAs : [sameAs];

        for (const sa of sameAsVals) {
          const targetId = iri(sa);

          if (targetId && !targetId.startsWith('_:')) {
            addNode(targetId);
            addEdge(nodeId, targetId, 'sameAs', 'sameAs');
          }
        }
      }
    }

    // Property nodes → edges between class nodes. Resolve anonymous body
    // IRIs (e.g. `Foo#/allOf/2`) back to the top-level class `Foo` so
    // properties declared inside multi-parent subClassOf bodies still
    // appear with the user-authored class as the edge source.
    if ((types.includes(OWL_OBJECT_PROP) || types.includes(OWL_DATATYPE_PROP)) && isPropertyNode(nodeId)) {
      const domainVal = node[RDFS_DOMAIN];
      const rangeVal = node[RDFS_RANGE];
      const rawDomainId = domainVal ? iri(domainVal) : null;
      const rangeId = rangeVal ? iri(rangeVal) : null;
      const propName = nodeLabel(nodeId);
      const domainId = rawDomainId !== null ? resolveTopLevelClass(rawDomainId, entityIds) : null;

      if (domainId !== null) {
        addNode(domainId);
      }

      if (rangeId && !isBuiltinType(rangeId) && !isPropertyNode(rangeId)) {
        addNode(rangeId);
        if (domainId !== null) {
          addEdge(domainId, rangeId, propName, 'range');
        }
      }
    }
  }

  // Walk registered schemas for $ref relations (authoritative pass).
  // Properties live either on the schema's own `properties` block OR inside
  // any `allOf[N].properties` block — the latter is what multi-parent
  // `Compose.subClassOf(...).body` produces. Both belong to the top-level
  // class identified by `$id`, so we emit the edge from `sourceId`.
  for (const schema of registeredSchemas) {
    if (!schema || typeof schema !== 'object') {
      continue;
    }
    const sourceId = schema['$id'];

    if (typeof sourceId !== 'string') {
      continue;
    }

    for (const props of collectPropertyMaps(schema)) {
      for (const [propName, propSchema] of Object.entries(props)) {
        const target = refTarget(propSchema);

        if (!target) {
          continue;
        }
        if (isBuiltinType(target)) {
          continue;
        }
        addNode(target);
        addEdge(sourceId, target, propName, 'range');
      }
    }
  }

  // User-authored restrictions live on each schema under `jt:restrictions`.
  // Render one edge per descriptor: someValuesFrom/allValuesFrom point at
  // the range class; cardinality/min/max/hasValue point at the constrained
  // property node so the graph still reflects the binding without
  // introducing a phantom literal node.
  for (const schema of registeredSchemas) {
    if (!schema || typeof schema !== 'object') {
      continue;
    }
    const sourceId = schema['$id'];

    if (typeof sourceId !== 'string') {
      continue;
    }
    const restrictions = (schema as Record<string, unknown>)['jt:restrictions'];

    if (!Array.isArray(restrictions)) {
      continue;
    }

    for (const r of restrictions) {
      if (!r || typeof r !== 'object') {
        continue;
      }
      const desc = r as { kind?: string; onProperty?: string; value?: unknown };
      const rawOnPropId = typeof desc.onProperty === 'string' ? desc.onProperty : null;

      if (!rawOnPropId) {
        continue;
      }
      // Target the flat property node the TBox emits, not the class-scoped identifier.
      const onPropId = flatOnProperty(rawOnPropId);
      const propName = nodeLabel(onPropId);

      switch (desc.kind) {
        case 'someValuesFrom':
        case 'allValuesFrom': {
          const target = typeof desc.value === 'string' ? desc.value : null;

          if (target && !isBuiltinType(target)) {
            addNode(target);
            const symbol = desc.kind === 'someValuesFrom' ? '∃' : '∀';

            addEdge(sourceId, target, `${propName} ${symbol}`, 'restriction');
          }
          break;
        }
        case 'hasValue':
          addNode(onPropId);
          addEdge(sourceId, onPropId, `${propName} = ${String(desc.value)}`, 'restriction');
          break;
        case 'cardinality':
          addNode(onPropId);
          addEdge(sourceId, onPropId, `${propName} card = ${String(desc.value)}`, 'restriction');
          break;
        case 'minCardinality':
          addNode(onPropId);
          addEdge(sourceId, onPropId, `${propName} card ≥ ${String(desc.value)}`, 'restriction');
          break;
        case 'maxCardinality':
          addNode(onPropId);
          addEdge(sourceId, onPropId, `${propName} card ≤ ${String(desc.value)}`, 'restriction');
          break;
        default:
          break;
      }
    }
  }

  // ABox sameAs assertions live on the registry, not in toTbox(). Pull them
  // separately so the graph viz shows owl:sameAs identity edges. The IRIs
  // here are individuals (instances), not classes — overwrite their kind
  // so the Vue component can render them with an instance-specific style
  // (dashed border, lighter fill) and the user can tell them apart from
  // the surrounding class nodes at a glance.
  const sameAsPairs = bookstoreEntities.registry.sameAsStore.all();

  for (const [iriA, iriB] of sameAsPairs) {
    addNode(iriA);
    addNode(iriB);
    // Override kind to 'instance' even if the node was already added.
    for (const node of nodes) {
      if (node.data.id === iriA || node.data.id === iriB) {
        node.data.kind = 'instance';
      }
    }
    addEdge(iriA, iriB, 'sameAs', 'sameAs');
  }

  // ──────────────────────────────────────────────────────────────────────
  // ABox projection — single-sourced from examples/docs/bookstore/aboxFixtures.
  //
  // Each fixture is projected to RDF quads via bookstoreEntities.toQuads and
  // rendered as instance nodes (typed by rdf:type → edge to the class node),
  // property-value edges to nested instance nodes / NamedNode IRIs, literal
  // value nodes for datatype/lang-tagged literals, and the annotated edge as
  // its own styled element. No instance data is hand-duplicated here; the
  // fixtures are the sole source.
  // ──────────────────────────────────────────────────────────────────────
  projectAboxFixtures(addNode, addEdge, markInstance);

  return {
    edges,
    nodes
  };

  // ----- closures over nodes used by the ABox projection -----

  function markInstance(id: string): void {
    for (const node of nodes) {
      if (node.data.id === id) {
        node.data.kind = 'instance';
      }
    }
  }
}

type AddNodeFn = (id: string, explicit?: { 'kind': NodeData['kind'];
  'label': string }) => void;
type AddEdgeFn = (source: string, target: string, label: string, kind: EdgeData['kind']) => void;
type MarkInstanceFn = (id: string) => void;

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

/**
 * Fixtures to project, paired with the schema that types them. Single-sourced
 * from aboxFixtures — instance data is never duplicated here. Each entry is
 * projected with `instantiate` (to obtain a branded, validated value) then
 * `toQuads`. A graphIRI is supplied so the annotated-edge fixture (which
 * requires one) projects without error; all fixtures share one ABox graph.
 */
const ABOX_GRAPH_IRI = 'https://bookstore.example/graph/abox';

function aboxFixtureQuads(): QuadInterface[] {
  const quads: QuadInterface[] = [];

  // Each fixture passes through instantiate → toQuads. instantiate brands the
  // value (arrays, formats) so toQuads accepts it; it also preserves
  // conditional then-branch properties (e.g. EBook.epubVersion).
  quads.push(...bookstoreEntities.toQuads(
    CustomerSchema,
    bookstoreEntities.instantiate(CustomerSchema, aboxFixtures.customer),
    { 'graphIRI': ABOX_GRAPH_IRI }
  ));
  quads.push(...bookstoreEntities.toQuads(
    OrderSchema,
    bookstoreEntities.instantiate(OrderSchema, aboxFixtures.order),
    { 'graphIRI': ABOX_GRAPH_IRI }
  ));
  quads.push(...bookstoreEntities.toQuads(
    RareBookSchema,
    bookstoreEntities.instantiate(RareBookSchema, aboxFixtures.rareBook),
    { 'graphIRI': ABOX_GRAPH_IRI }
  ));
  quads.push(...bookstoreEntities.toQuads(
    EBookSchema,
    bookstoreEntities.instantiate(EBookSchema, aboxFixtures.ebook),
    { 'graphIRI': ABOX_GRAPH_IRI }
  ));
  quads.push(...bookstoreEntities.toQuads(
    PrintBookSchema,
    bookstoreEntities.instantiate(PrintBookSchema, aboxFixtures.printBook),
    { 'graphIRI': ABOX_GRAPH_IRI }
  ));
  quads.push(...bookstoreEntities.toQuads(
    SignedFirstEditionSchema,
    bookstoreEntities.instantiate(SignedFirstEditionSchema, aboxFixtures.signedFirstEdition),
    { 'graphIRI': ABOX_GRAPH_IRI }
  ));
  quads.push(...bookstoreEntities.toQuads(
    SimilarBookSchema,
    bookstoreEntities.instantiate(SimilarBookSchema, aboxFixtures.similarBook),
    { 'graphIRI': ABOX_GRAPH_IRI }
  ));
  quads.push(...bookstoreEntities.toQuads(
    SequelSchema,
    bookstoreEntities.instantiate(SequelSchema, aboxFixtures.sequel),
    { 'graphIRI': ABOX_GRAPH_IRI }
  ));
  quads.push(...bookstoreEntities.toQuads(
    BookListPageSchema,
    bookstoreEntities.instantiate(BookListPageSchema, aboxFixtures.bookListPage),
    { 'graphIRI': ABOX_GRAPH_IRI }
  ));
  quads.push(...bookstoreEntities.toQuads(
    ReviewSchema,
    bookstoreEntities.instantiate(ReviewSchema, aboxFixtures.reviewWithAnnotatedEdge),
    { 'graphIRI': ABOX_GRAPH_IRI }
  ));

  return quads;
}

/**
 * Project the ABox fixtures into instance nodes, instanceType / instanceProperty
 * / annotatedEdge edges, and literal value nodes.
 *
 * - A `rdf:type` quad with a registered class object → an instance node + an
 *   `instanceType` edge to the class node.
 * - A NamedNode object that is itself an instance subject → an `instanceProperty`
 *   edge between the two instance nodes.
 * - A NamedNode object that is NOT a subject (e.g. an x-jt-iriRef download URL,
 *   or an external sameAs target) → an `instanceProperty` edge to an instance
 *   node representing the referenced IRI.
 * - A Literal object → a compact `literal` value node + an `instanceProperty`
 *   edge (language tag and datatype shown in the label).
 * - A `Quad`-subject (RDF-star triple-term) quad → an `annotatedEdge` element
 *   annotating the base edge with the annotation predicate + value.
 */
function projectAboxFixtures(
  addNode: AddNodeFn,
  addEdge: AddEdgeFn,
  markInstance: MarkInstanceFn
): void {
  const quads = aboxFixtureQuads();

  // First pass — identify every instance subject (a NamedNode subject that
  // carries an rdf:type to a non-builtin class). owl:sameAs subjects are
  // already rendered separately, so skip them here.
  const subjectTypes = new Map<string, string>();

  for (const quad of quads) {
    if (quad.subject.termType !== 'NamedNode') {
      continue;
    }
    if (quad.predicate.value === RDF_TYPE && quad.object.termType === 'NamedNode') {
      subjectTypes.set(quad.subject.value, quad.object.value);
    }
  }

  // Materialize instance nodes + their type edges to the class node.
  for (const [subjectIri, classIri] of subjectTypes) {
    addNode(subjectIri);
    markInstance(subjectIri);
    addNode(classIri);
    addEdge(subjectIri, classIri, 'a', 'instanceType');
  }

  let literalCounter = 0;

  // Second pass — property edges and literal value nodes.
  for (const quad of quads) {
    if (quad.subject.termType === 'Quad') {
      projectAnnotationQuad(quad, addNode, addEdge, markInstance);
      continue;
    }
    if (quad.subject.termType !== 'NamedNode' || !subjectTypes.has(quad.subject.value)) {
      continue;
    }
    if (quad.predicate.value === RDF_TYPE) {
      continue;
    }
    if (quad.predicate.value === OWL_SAME_AS) {
      // owl:sameAs is rendered by the dedicated sameAs pass.
      continue;
    }

    const subjectIri = quad.subject.value;
    const propLabel = nodeLabel(quad.predicate.value);

    if (quad.object.termType === 'NamedNode') {
      const targetIri = quad.object.value;

      addNode(targetIri);
      markInstance(targetIri);
      addEdge(subjectIri, targetIri, propLabel, 'instanceProperty');
      continue;
    }

    if (quad.object.termType === 'Literal') {
      const literalId = `literal:${subjectIri}#${propLabel}#${literalCounter}`;

      literalCounter++;
      addNode(literalId, {
        'kind': 'literal',
        'label': literalLabel(quad)
      });
      addEdge(subjectIri, literalId, propLabel, 'instanceProperty');
    }
  }
}

/**
 * Build a compact label for a literal value, annotating language-tagged
 * (`@de`) and non-string-datatype literals so the lang/iri-ref/datatype
 * features are visible at a glance.
 */
function literalLabel(quad: QuadInterface): string {
  if (quad.object.termType !== 'Literal') {
    return '';
  }
  const raw = quad.object.value;
  const truncated = raw.length > 24 ? `${raw.slice(0, 21)}…` : raw;
  const language = quad.object.language;

  if (language !== undefined && language !== '') {
    return `"${truncated}"@${language}`;
  }

  return `"${truncated}"`;
}

/**
 * Project an RDF-star annotation quad (triple-term subject) as an
 * `annotatedEdge` element: the annotation predicate + value annotate the base
 * edge between the review instance and the book instance.
 */
function projectAnnotationQuad(
  quad: QuadInterface,
  addNode: AddNodeFn,
  addEdge: AddEdgeFn,
  markInstance: MarkInstanceFn
): void {
  const subject = quad.subject;

  if (subject.termType !== 'Quad') {
    return;
  }
  const baseSubject = subject.subject;
  const baseObject = subject.object;

  if (baseSubject.termType !== 'NamedNode' || baseObject.termType !== 'NamedNode') {
    return;
  }
  addNode(baseSubject.value);
  markInstance(baseSubject.value);
  addNode(baseObject.value);
  markInstance(baseObject.value);

  const annotationLabel = nodeLabel(quad.predicate.value);
  const annotationValue = quad.object.value;

  addEdge(
    baseSubject.value,
    baseObject.value,
    `${nodeLabel(subject.predicate.value)} {${annotationLabel}=${annotationValue}}`,
    'annotatedEdge'
  );
}

/**
 * JSON-LD serialization of the bookstore TBox.
 * Used by the WebVOWL build script to write docs/public/data/bookstore-tbox.jsonld.
 */
export function toJsonLd(): unknown {
  return bookstoreEntities.toTbox().jsonLd();
}

/**
 * Schema literal map keyed by $id — used by the click-to-inspect side panel.
 */
export function toSchemaMap(): Record<string, unknown> {
  const map: Record<string, unknown> = {};

  for (const schema of bookstoreEntities.registry.list() as Array<Record<string, unknown>>) {
    if (schema && typeof schema === 'object' && typeof schema['$id'] === 'string') {
      map[schema['$id']] = schema;
    }
  }

  return map;
}
