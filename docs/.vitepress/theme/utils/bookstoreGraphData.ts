import { bookstoreEntities } from '../../../../examples/docs/bookstore/index.js';

// ---------------------------------------------------------------------------
// OWL vocabulary IRIs
// ---------------------------------------------------------------------------

const OWL_CLASS = 'http://www.w3.org/2002/07/owl#Class';
const OWL_OBJECT_PROP = 'http://www.w3.org/2002/07/owl#ObjectProperty';
const OWL_DATATYPE_PROP = 'http://www.w3.org/2002/07/owl#DatatypeProperty';
const OWL_EQUIVALENT = 'http://www.w3.org/2002/07/owl#equivalentClass';
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
  kind: 'entity' | 'primitive';
}

export interface EdgeData {
  id: string;
  source: string;
  target: string;
  label: string;
  kind: 'subClassOf' | 'domain' | 'range' | 'equivalentClass';
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
  if (!propSchema || typeof propSchema !== 'object') {
    return null;
  }
  const ps = propSchema as Record<string, unknown>;

  if (typeof ps['$ref'] === 'string') {
    return ps['$ref'];
  }
  if (ps['type'] === 'array' && ps['items'] && typeof ps['items'] === 'object') {
    const items = ps['items'] as Record<string, unknown>;

    if (typeof items['$ref'] === 'string') {
      return items['$ref'];
    }
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
