import { bookstoreEntities } from '../../../../examples/docs/bookstore/index.js';

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
  kind: 'entity' | 'instance' | 'primitive';
}

export interface EdgeData {
  id: string;
  source: string;
  target: string;
  label: string;
  kind:
    | 'complementOf'
    | 'disjointWith'
    | 'domain'
    | 'equivalentClass'
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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Derives Cytoscape elements (nodes + edges) from the live bookstore registry.
 * Walks both the OWL TBox quads and each schema's properties to ensure
 * every $ref relation is captured as an edge.
 */
export function toCytoscapeElements(): CytoscapeElements {
  const tboxRaw = bookstoreEntities.toTbox().raw() as Array<Record<string, unknown>>;
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

  function addNode(id: string): void {
    if (seenNodeIds.has(id)) {
      return;
    }
    seenNodeIds.add(id);
    nodes.push({
      'data': {
        id,
        'kind': entityIds.has(id) ? 'entity' : 'primitive',
        'label': nodeLabel(id)
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

    // Property nodes → edges between class nodes
    if ((types.includes(OWL_OBJECT_PROP) || types.includes(OWL_DATATYPE_PROP)) && isPropertyNode(nodeId)) {
      const domainVal = node[RDFS_DOMAIN];
      const rangeVal = node[RDFS_RANGE];
      const domainId = domainVal ? iri(domainVal) : null;
      const rangeId = rangeVal ? iri(rangeVal) : null;
      const propName = nodeLabel(nodeId);

      if (domainId && !isPropertyNode(domainId)) {
        addNode(domainId);
      }

      if (rangeId && !isBuiltinType(rangeId) && !isPropertyNode(rangeId)) {
        addNode(rangeId);
        if (domainId) {
          addEdge(domainId, rangeId, propName, 'range');
        }
      }
    }
  }

  // Walk registered schemas for $ref relations (authoritative pass)
  for (const schema of registeredSchemas) {
    if (!schema || typeof schema !== 'object') {
      continue;
    }
    const sourceId = schema['$id'];

    if (typeof sourceId !== 'string') {
      continue;
    }
    const props = schema['properties'];

    if (!props || typeof props !== 'object') {
      continue;
    }

    for (const [propName, propSchema] of Object.entries(props as Record<string, unknown>)) {
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
      const onPropId = typeof desc.onProperty === 'string' ? desc.onProperty : null;

      if (!onPropId) {
        continue;
      }
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

  return {
    edges,
    nodes
  };
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
