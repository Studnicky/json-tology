/**
 * build-bookstore-graph.mjs
 *
 * Generates Cytoscape-format graph data from the bookstore ontology TBox.
 *
 * Reads entities.toTbox().raw() and transforms OWL quads into:
 *   docs/public/data/bookstore-graph.json  — Cytoscape elements
 *   docs/public/data/bookstore-schemas.json — schema literals by $id
 *
 * Run via: npm run build:bookstore-graph
 */

import {
  mkdirSync, unlinkSync, writeFileSync
} from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DATA_DIR = join(ROOT, 'docs', 'public', 'data');
const BOOKSTORE_INDEX = join(ROOT, 'examples', 'docs', 'bookstore', 'index.js');

// ---------------------------------------------------------------------------
// Extract TBox data via tsx by writing a temp TS extractor file.
// We use a file (not --eval) to avoid CJS/ESM resolution quirks with tsx.
// ---------------------------------------------------------------------------

const tmpFile = join(tmpdir(), `bookstore-extract-${randomUUID()}.ts`);
const extractorContent = `
import { bookstoreEntities as entities } from ${JSON.stringify(BOOKSTORE_INDEX)};

const tboxRaw = entities.toTbox().raw();
const registeredSchemas = entities.registry.list();

process.stdout.write(JSON.stringify({ tboxRaw, registeredSchemas }));
`;

writeFileSync(tmpFile, extractorContent, 'utf8');

let extractResult;

try {
  extractResult = execFileSync(
    'npx',
    [
      'tsx',
      tmpFile
    ],
    {
      'cwd': ROOT,
      'encoding': 'utf8',
      'stdio': [
        'pipe',
        'pipe',
        'inherit'
      ]
    }
  );
} finally {
  unlinkSync(tmpFile);
}

const {
  registeredSchemas, tboxRaw
} = JSON.parse(extractResult);

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
// Helper functions
// ---------------------------------------------------------------------------

/** Extract IRI string from a node value ({ '@id': string } | string). */
function iri(val) {
  if (typeof val === 'string') {
    return val;
  }
  if (val && typeof val['@id'] === 'string') {
    return val['@id'];
  }

  return null;
}

/** Last segment of an IRI (after last #, /, or :). */
function label(id) {
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

/** True if id contains a fragment — indicates a property node rather than a class node. */
function isPropertyNode(id) {
  return id.includes('#');
}

/** True if the IRI is an XSD datatype or rdf:List (not a bookstore class node). */
function isBuiltinType(id) {
  return id.startsWith(XSD_PREFIX) || id === RDF_LIST;
}

// ---------------------------------------------------------------------------
// Identify entity vs primitive schemas
// ---------------------------------------------------------------------------

const entityIds = new Set(registeredSchemas
  .filter((schema) => {
    return schema && typeof schema === 'object' && schema.type === 'object';
  })
  .map((schema) => {
    return schema['$id'];
  }));

// ---------------------------------------------------------------------------
// Build Cytoscape nodes and edges from OWL quads
// ---------------------------------------------------------------------------

const nodes = [];
const edges = [];
const seenNodeIds = new Set();
const seenEdgeIds = new Set();

function addNode(id) {
  if (seenNodeIds.has(id)) {
    return;
  }
  seenNodeIds.add(id);
  nodes.push({
    'data': {
      id,
      'kind': entityIds.has(id) ? 'entity' : 'primitive',
      'label': label(id)
    }
  });
}

function addEdge(source, target, edgeLabel, kind) {
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

for (const node of tboxRaw) {
  if (typeof node !== 'object' || node === null) {
    continue;
  }

  const nodeId = node['@id'];

  if (typeof nodeId !== 'string') {
    continue;
  }

  const rawType = node['@type'];
  let types;

  if (Array.isArray(rawType)) {
    types = rawType;
  } else if (rawType) {
    types = [rawType];
  } else {
    types = [];
  }

  // --- Class nodes → graph nodes ---
  if (types.includes(OWL_CLASS) && !isPropertyNode(nodeId)) {
    addNode(nodeId);

    // Named subClassOf edges (skip blank-node restrictions)
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

    // equivalentClass edges
    const equiv = node[OWL_EQUIVALENT];

    if (equiv) {
      const equivs = Array.isArray(equiv) ? equiv : [equiv];

      for (const eq of equivs) {
        const targetId = iri(eq);

        if (targetId && !isBuiltinType(targetId)) {
          addEdge(nodeId, targetId, 'equivalentClass', 'equivalentClass');
        }
      }
    }
  }

  // --- Property nodes → edges between class nodes ---
  if ((types.includes(OWL_OBJECT_PROP) || types.includes(OWL_DATATYPE_PROP)) && isPropertyNode(nodeId)) {
    const domainVal = node[RDFS_DOMAIN];
    const rangeVal = node[RDFS_RANGE];

    const domainId = domainVal ? iri(domainVal) : null;
    const rangeId = rangeVal ? iri(rangeVal) : null;

    const propName = label(nodeId);

    // Ensure domain class is a node
    if (domainId && !isPropertyNode(domainId)) {
      addNode(domainId);
    }

    // Add range edge only for named bookstore classes (not XSD datatypes, not rdf:List)
    if (rangeId && !isBuiltinType(rangeId) && !isPropertyNode(rangeId)) {
      addNode(rangeId);
      if (domainId) {
        addEdge(domainId, rangeId, propName, 'range');
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Build schema literal map keyed by $id
// ---------------------------------------------------------------------------

const schemasMap = {};

for (const schema of registeredSchemas) {
  if (schema && typeof schema === 'object' && typeof schema['$id'] === 'string') {
    schemasMap[schema['$id']] = schema;
  }
}

// ---------------------------------------------------------------------------
// Write output
// ---------------------------------------------------------------------------

mkdirSync(DATA_DIR, { 'recursive': true });

const graphData = {
  edges,
  nodes
};

writeFileSync(join(DATA_DIR, 'bookstore-graph.json'), JSON.stringify(graphData, null, 2));
writeFileSync(join(DATA_DIR, 'bookstore-schemas.json'), JSON.stringify(schemasMap, null, 2));

const graphBytes = JSON.stringify(graphData).length;

console.log(`bookstore-graph.json: ${nodes.length} nodes, ${edges.length} edges (${graphBytes} bytes)`);
console.log(`bookstore-schemas.json: ${Object.keys(schemasMap).length} schemas`);
