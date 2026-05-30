<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import type { EdgeData, NodeData } from '../utils/bookstoreGraphData.js';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const containerRef = ref<HTMLDivElement | null>(null);
const wrapperRef = ref<HTMLDivElement | null>(null);
const loadError = ref<string | null>(null);
const loading = ref(true);

// Tab state
const activeLayer = ref<'tbox' | 'abox'>('tbox');

// Inspector state — extended with definitionId/layer from node data
interface SelectedNode {
  id: string;
  label: string;
  kind: NodeData['kind'];
  layer: 'tbox' | 'abox';
  schema: unknown;
  jsonLd: unknown;
  definitionId: string | undefined;
  definitionLabel: string | undefined;
  definitionSchema: unknown;
  definitionJsonLd: unknown;
  edges: EdgeData[];
}
const selectedNode = ref<SelectedNode | null>(null);

// Inspector representation sub-tab: 'schema' | 'jsonld'
const inspectorTab = ref<'schema' | 'jsonld'>('schema');

// Keep a reference to destroy on unmount
interface CyLayoutHandle {
  run(): void;
}

interface CyElement {
  id(): string;
  data(): NodeData | EdgeData;
  group(): string;
  position(pos?: { x: number; y: number }): { x: number; y: number };
  select(): void;
  pan(): void;
}

interface CyCollection {
  [Symbol.iterator](): Iterator<CyElement>;
  length: number;
  nodes(): CyCollection;
  edges(): CyCollection;
  filter(selector: string | ((el: CyElement) => boolean)): CyCollection;
  map<T>(fn: (el: CyElement) => T): T[];
}

interface CyHandle {
  destroy(): void;
  fit(elements?: unknown, padding?: number): void;
  resize(): void;
  zoom(): number;
  zoom(opts: { level: number; renderedPosition: { x: number; y: number } }): void;
  maxZoom(): number;
  minZoom(level: number): void;
  maxZoom(level: number): void;
  width(): number;
  height(): number;
  userZoomingEnabled(enabled: boolean): void;
  on(event: string, selector: string | ((event: unknown) => void), handler?: (event: unknown) => void): void;
  one(event: string, handler: () => void): void;
  layout(options: Record<string, unknown>): CyLayoutHandle;
  add(elements: unknown): void;
  remove(selector: string): void;
  elements(): CyCollection;
  $id(id: string): CyElementSingle;
  center(elements?: unknown): void;
}

interface CyElementSingle {
  length: number;
  data(): NodeData;
  select(): void;
  pan(): void;
}

let cyInstance: CyHandle | null = null;

// Loaded data — kept in module-level refs so tab switching can rebuild elements
let allNodes: Array<{ data: NodeData; position: { x: number; y: number } }> = [];
let allEdges: Array<{ data: EdgeData }> = [];
let schemaMap: Record<string, unknown> = {};
let jsonLdMap: Record<string, unknown> = {};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function schemaText(schema: unknown): string {
  return JSON.stringify(schema, null, 2);
}

function jsonLdText(fragment: unknown): string {
  return JSON.stringify(fragment, null, 2);
}

function nodeLabel(id: string): string {
  const hash = id.lastIndexOf('#');
  if (hash !== -1) {
    const after = id.slice(hash + 1);
    const slash = after.lastIndexOf('/');
    return slash !== -1 ? after.slice(slash + 1) : after;
  }
  const slash = id.lastIndexOf('/');
  if (slash !== -1) return id.slice(slash + 1);
  const colon = id.lastIndexOf(':');
  if (colon !== -1) return id.slice(colon + 1);
  return id;
}

/** Returns the label for a node id from the loaded allNodes array, or derives it. */
function labelForId(id: string): string {
  const found = allNodes.find(n => n.data.id === id);
  return found ? found.data.label : nodeLabel(id);
}

/** Build the cytoscape elements for the given layer, filtering cross-layer edges. */
function buildLayerElements(layer: 'tbox' | 'abox'): Array<{ data: NodeData | EdgeData; position?: { x: number; y: number } }> {
  const layerNodeIds = new Set(
    allNodes
      .filter(n => n.data.layer === layer)
      .map(n => n.data.id)
  );

  const nodes = allNodes
    .filter(n => n.data.layer === layer)
    .map(n => ({ data: n.data, position: n.position }));

  // Keep an edge only when both endpoints are in the active layer.
  // instanceType edges connect abox→tbox; drop them from both views
  // (they are cross-layer) to avoid dangling edges. A "Defined by" link is
  // shown in the inspector instead.
  const edges = allEdges
    .filter(e => layerNodeIds.has(e.data.source) && layerNodeIds.has(e.data.target))
    .map(e => ({ data: e.data }));

  return [...nodes, ...edges] as Array<{ data: NodeData | EdgeData; position?: { x: number; y: number } }>;
}

/**
 * Run the fcose force-directed layout for the current layer and fit. fcose
 * with `nodeDimensionsIncludeLabels` separates nodes so labels do not overlap,
 * and `randomize: false` seeds from the baked positions so the result is
 * deterministic — the same readable layout is computed before every paint.
 */
function applyLayout(): void {
  if (!cyInstance) return;
  // The ABox has ~3x the nodes and many disconnected instance clusters joined
  // only by long sameAs edges. Pull it tighter (shorter ideal edges, lower
  // repulsion, stronger gravity, packed components) so it does not sprawl into
  // empty space; keep the TBox looser so its class hierarchy stays legible.
  const isAbox = activeLayer.value === 'abox';
  cyInstance.layout({
    name: 'fcose',
    animate: false,
    fit: true,
    padding: 50,
    quality: 'proof',
    nodeDimensionsIncludeLabels: true,
    nodeRepulsion: () => (isAbox ? 4500 : 7000),
    idealEdgeLength: () => (isAbox ? 55 : 95),
    edgeElasticity: () => 0.45,
    gravity: isAbox ? 0.5 : 0.25,
    gravityRange: isAbox ? 2.8 : 3.8,
    numIter: 2500,
    randomize: false,
    packComponents: true,
    componentSpacing: isAbox ? 50 : 120,
    tile: false
  } as Record<string, unknown>).run();
  // Fit the whole layer into view (the user zooms in to read individual labels;
  // the tighter ABox params above keep the fitted graph compact rather than
  // sprawling into empty space).
  cyInstance.fit(undefined, 50);
}

/** Build and render elements for the given layer into the existing cytoscape instance. */
function switchLayer(layer: 'tbox' | 'abox'): void {
  if (!cyInstance) return;
  // Clear current elements
  cyInstance.remove('node');
  cyInstance.remove('edge');
  // Add new layer elements
  cyInstance.add(buildLayerElements(layer));
  applyLayout();
  // Reset zoom bounds for the new layout
  const fitZoom = cyInstance.zoom();
  cyInstance.minZoom(fitZoom * 0.25);
  cyInstance.maxZoom(fitZoom * 6);
}

/** Resolve the full SelectedNode shape for a given node id. */
function resolveSelectedNode(nodeId: string): SelectedNode | null {
  const nodeEl = allNodes.find(n => n.data.id === nodeId);
  if (!nodeEl) return null;
  const nd = nodeEl.data;

  // Schema: TBox → own schema; ABox → its definition's schema
  const schema = nd.layer === 'tbox'
    ? (schemaMap[nodeId] ?? null)
    : (nd.definitionId ? (schemaMap[nd.definitionId] ?? null) : null);

  const jsonLd = jsonLdMap[nodeId] ?? null;

  const definitionId = nd.definitionId;
  const definitionLabel = definitionId ? labelForId(definitionId) : undefined;
  const definitionSchema = definitionId ? (schemaMap[definitionId] ?? null) : null;
  const definitionJsonLd = definitionId ? (jsonLdMap[definitionId] ?? null) : null;

  const allEdgeData = allEdges.map(e => e.data);
  const related = allEdgeData.filter(e => e.source === nodeId || e.target === nodeId);

  return {
    id: nodeId,
    label: nd.label,
    kind: nd.kind,
    layer: nd.layer,
    schema,
    jsonLd,
    definitionId,
    definitionLabel,
    definitionSchema,
    definitionJsonLd,
    edges: related
  };
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

onMounted(async () => {
  try {
    const base = import.meta.env.BASE_URL;
    const [graphResp, schemaResp, jsonLdResp] = await Promise.all([
      fetch(`${base}data/bookstore-graph.json`),
      fetch(`${base}data/bookstore-schemas.json`),
      fetch(`${base}data/bookstore-jsonld.json`)
    ]);
    if (!graphResp.ok) throw new Error(`graph fetch ${graphResp.status}`);
    if (!schemaResp.ok) throw new Error(`schema fetch ${schemaResp.status}`);
    if (!jsonLdResp.ok) throw new Error(`jsonld fetch ${jsonLdResp.status}`);

    type GraphData = { nodes: Array<{ data: NodeData; position: { x: number; y: number } }>; edges: Array<{ data: EdgeData }> };
    const [graphData, schemaData, jsonLdData] = await Promise.all([
      graphResp.json() as Promise<GraphData>,
      schemaResp.json() as Promise<Record<string, unknown>>,
      jsonLdResp.json() as Promise<Record<string, unknown>>
    ]);

    allNodes = graphData.nodes;
    allEdges = graphData.edges;
    schemaMap = schemaData;
    jsonLdMap = jsonLdData;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    loadError.value = `Could not load graph data: ${msg}. Did you run \`npm run build:bookstore-tbox\` (or \`docs:build\`)?`;
    loading.value = false;
    return;
  }

  // Dynamically import Cytoscape (client-only — never runs during SSR)
  let cytoscape: typeof import('cytoscape').default;

  try {
    const [cytoscapeModule, fcoseModule] = await Promise.all([
      import('cytoscape'),
      import('cytoscape-fcose')
    ]);
    cytoscape = cytoscapeModule.default;
    cytoscape.use(fcoseModule.default);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    loadError.value = `Cytoscape failed to load: ${msg}`;
    loading.value = false;
    return;
  }

  loading.value = false;

  if (!containerRef.value) return;

  // Wait until the container actually has non-zero dimensions before
  // constructing Cytoscape. VitePress's reactive layout sometimes mounts the
  // component before the surrounding flex/grid math has settled, and
  // Cytoscape's renderer falls back to a 300×150 canvas if construction runs
  // against a zero-sized container — leaving the graph invisible inside an
  // otherwise-correctly-sized div.
  async function waitForContainerSize(el: HTMLElement): Promise<void> {
    for (let attempt = 0; attempt < 60; attempt++) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) return;
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
  }
  await waitForContainerSize(containerRef.value);

  // Build initial elements for the default 'tbox' layer
  const initialElements = buildLayerElements('tbox');

  cyInstance = cytoscape({
    container: containerRef.value,
    elements: initialElements,
    style: [
      // Entity nodes — W3C blue
      {
        selector: 'node[kind = "entity"]',
        style: {
          'background-color': '#005a9c',
          'color': '#ffffff',
          'label': 'data(label)',
          'font-size': '12px',
          'text-valign': 'center',
          'text-halign': 'center',
          'width': '80px',
          'height': '36px',
          'shape': 'roundrectangle',
          'text-wrap': 'ellipsis',
          'text-max-width': '72px'
        }
      },
      // Primitive nodes — lighter blue
      {
        selector: 'node[kind = "primitive"]',
        style: {
          'background-color': '#a8d1f0',
          'color': '#003366',
          'label': 'data(label)',
          'font-size': '11px',
          'text-valign': 'center',
          'text-halign': 'center',
          'width': '72px',
          'height': '28px',
          'shape': 'roundrectangle',
          'text-wrap': 'ellipsis',
          'text-max-width': '64px'
        }
      },
      // ABox instance nodes — gold-tinted ellipse with dashed border to
      // mark them as individuals (concrete, ABox) rather than classes (TBox).
      {
        selector: 'node[kind = "instance"]',
        style: {
          'background-color': '#fbf3d4',
          'border-color': '#daa520',
          'border-width': 1.5,
          'border-style': 'dashed',
          'color': '#5a4710',
          'label': 'data(label)',
          'font-size': '11px',
          'font-style': 'italic',
          'text-valign': 'center',
          'text-halign': 'center',
          'width': '88px',
          'height': '32px',
          'shape': 'ellipse',
          'text-wrap': 'ellipsis',
          'text-max-width': '80px'
        }
      },
      // Literal value nodes — small gray tag carrying a datatype/lang literal
      {
        selector: 'node[kind = "literal"]',
        style: {
          'background-color': '#f3f3f3',
          'border-color': '#bdbdbd',
          'border-width': 1,
          'border-style': 'solid',
          'color': '#555555',
          'label': 'data(label)',
          'font-size': '9px',
          'font-family': 'monospace',
          'text-valign': 'center',
          'text-halign': 'center',
          'width': '72px',
          'height': '22px',
          'shape': 'round-tag',
          'text-wrap': 'ellipsis',
          'text-max-width': '66px'
        }
      },
      // Selected node
      {
        selector: 'node:selected',
        style: {
          'border-width': '3px',
          'border-color': '#ffa500'
        }
      },
      // subClassOf edges — solid gray
      {
        selector: 'edge[kind = "subClassOf"]',
        style: {
          'line-color': '#888888',
          'target-arrow-color': '#888888',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          'line-style': 'solid',
          'label': 'data(label)',
          'font-size': '9px',
          'color': '#888888',
          'text-rotation': 'autorotate',
          'text-margin-y': '-8px',
          'width': 2
        }
      },
      // equivalentClass edges — green dashed
      {
        selector: 'edge[kind = "equivalentClass"]',
        style: {
          'line-color': '#28a745',
          'target-arrow-color': '#28a745',
          'target-arrow-shape': 'none',
          'curve-style': 'bezier',
          'line-style': 'dashed',
          'label': 'data(label)',
          'font-size': '9px',
          'color': '#28a745',
          'text-rotation': 'autorotate',
          'text-margin-y': '-8px',
          'width': 2
        }
      },
      // range edges — blue arrows
      {
        selector: 'edge[kind = "range"]',
        style: {
          'line-color': '#0070c0',
          'target-arrow-color': '#0070c0',
          'target-arrow-shape': 'vee',
          'curve-style': 'bezier',
          'line-style': 'solid',
          'label': 'data(label)',
          'font-size': '9px',
          'color': '#0070c0',
          'text-rotation': 'autorotate',
          'text-margin-y': '-8px',
          'width': 1.5
        }
      },
      // domain edges — orange (less common, explicit overrides only)
      {
        selector: 'edge[kind = "domain"]',
        style: {
          'line-color': '#cc7700',
          'target-arrow-color': '#cc7700',
          'target-arrow-shape': 'vee',
          'curve-style': 'bezier',
          'line-style': 'dotted',
          'label': 'data(label)',
          'font-size': '9px',
          'color': '#cc7700',
          'text-rotation': 'autorotate',
          'text-margin-y': '-8px',
          'width': 1.5
        }
      },
      // disjointWith edges — red dashed (no arrow, the relation is symmetric)
      {
        selector: 'edge[kind = "disjointWith"]',
        style: {
          'line-color': '#d63a3a',
          'target-arrow-color': '#d63a3a',
          'target-arrow-shape': 'none',
          'curve-style': 'bezier',
          'line-style': 'dashed',
          'label': 'data(label)',
          'font-size': '9px',
          'color': '#d63a3a',
          'text-rotation': 'autorotate',
          'text-margin-y': '-8px',
          'width': 2
        }
      },
      // complementOf edges — purple solid
      {
        selector: 'edge[kind = "complementOf"]',
        style: {
          'line-color': '#8a2be2',
          'target-arrow-color': '#8a2be2',
          'target-arrow-shape': 'tee',
          'curve-style': 'bezier',
          'line-style': 'solid',
          'label': 'data(label)',
          'font-size': '9px',
          'color': '#8a2be2',
          'text-rotation': 'autorotate',
          'text-margin-y': '-8px',
          'width': 2
        }
      },
      // restriction edges — teal dotted (class -> constrained property)
      {
        selector: 'edge[kind = "restriction"]',
        style: {
          'line-color': '#08717a',
          'target-arrow-color': '#08717a',
          'target-arrow-shape': 'circle',
          'curve-style': 'bezier',
          'line-style': 'dotted',
          'label': 'data(label)',
          'font-size': '9px',
          'color': '#08717a',
          'text-rotation': 'autorotate',
          'text-margin-y': '-8px',
          'width': 1.5
        }
      },
      // sameAs edges — gold dashed, symmetric (no arrow)
      {
        selector: 'edge[kind = "sameAs"]',
        style: {
          'line-color': '#daa520',
          'target-arrow-color': '#daa520',
          'target-arrow-shape': 'none',
          'curve-style': 'bezier',
          'line-style': 'dashed',
          'label': 'data(label)',
          'font-size': '9px',
          'color': '#daa520',
          'text-rotation': 'autorotate',
          'text-margin-y': '-8px',
          'width': 2
        }
      },
      // instanceType edges (ABox) — gold solid arrow: individual → its class
      {
        selector: 'edge[kind = "instanceType"]',
        style: {
          'line-color': '#b8860b',
          'target-arrow-color': '#b8860b',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          'line-style': 'solid',
          'label': 'data(label)',
          'font-size': '9px',
          'color': '#b8860b',
          'text-rotation': 'autorotate',
          'text-margin-y': '-8px',
          'width': 1.5
        }
      },
      // instanceProperty edges (ABox) — light-gold solid: individual → value
      {
        selector: 'edge[kind = "instanceProperty"]',
        style: {
          'line-color': '#cdb35a',
          'target-arrow-color': '#cdb35a',
          'target-arrow-shape': 'vee',
          'curve-style': 'bezier',
          'line-style': 'solid',
          'label': 'data(label)',
          'font-size': '8px',
          'color': '#9a8230',
          'text-rotation': 'autorotate',
          'text-margin-y': '-6px',
          'width': 1
        }
      },
      // annotatedEdge (RDF-star) — magenta solid, thicker, with annotation in label
      {
        selector: 'edge[kind = "annotatedEdge"]',
        style: {
          'line-color': '#c2185b',
          'target-arrow-color': '#c2185b',
          'target-arrow-shape': 'vee',
          'curve-style': 'bezier',
          'line-style': 'solid',
          'label': 'data(label)',
          'font-size': '9px',
          'color': '#c2185b',
          'text-rotation': 'autorotate',
          'text-margin-y': '-8px',
          'width': 2.5
        }
      }
    ]
  });

  // Run the fcose layout for the initial layer and fit.
  applyLayout();

  // Clamp zoom range to the just-settled fit value.
  const fitZoom = cyInstance.zoom();
  cyInstance.minZoom(fitZoom * 0.25);
  cyInstance.maxZoom(fitZoom * 6);

  // Observe the wrapper so Cytoscape re-centres whenever the wrapper
  // height transitions (e.g. inspector open/close). containerRef covers
  // canvas-only resizes; wrapperRef covers the height transition animation.
  const observeTarget = wrapperRef.value ?? containerRef.value;
  if (observeTarget !== null && typeof ResizeObserver !== 'undefined') {
    const resizeObserver = new ResizeObserver(() => {
      // resize() tells Cytoscape to re-read the container dimensions and
      // resize its internal canvas. Without this, fit() would compute zoom
      // against stale dimensions and the graph stays clipped.
      cyInstance?.resize();
      cyInstance?.fit(undefined, 50);
    });
    resizeObserver.observe(observeTarget);
    onUnmounted(() => { resizeObserver.disconnect(); });
  }

  // Click handler: open side panel
  cyInstance.on('tap', 'node', (event: { target: { data(): NodeData } }) => {
    const nodeData = event.target.data();
    const resolved = resolveSelectedNode(nodeData.id);
    if (resolved) {
      selectedNode.value = resolved;
      inspectorTab.value = 'schema';
    }
  });

  // Click on background — deselect
  cyInstance.on('tap', (event: { target: { group?: () => string } }) => {
    if (event.target === (cyInstance as unknown as { [key: string]: unknown })) {
      selectedNode.value = null;
    }
  });
});

onUnmounted(() => {
  cyInstance?.destroy();
  cyInstance = null;
});

// ---------------------------------------------------------------------------
// Tab switching
// ---------------------------------------------------------------------------

function selectLayer(layer: 'tbox' | 'abox'): void {
  if (activeLayer.value === layer) return;
  activeLayer.value = layer;
  selectedNode.value = null;
  inspectorTab.value = 'schema';
  switchLayer(layer);
}

// ---------------------------------------------------------------------------
// Inspector actions
// ---------------------------------------------------------------------------

function closePanel(): void {
  selectedNode.value = null;
}

function viewDefinitionInTbox(definitionId: string): void {
  selectLayer('tbox');
  // After tab switch rebuilds the graph, select and centre the definition node.
  // Use requestAnimationFrame to let the DOM + cytoscape update settle.
  requestAnimationFrame(() => {
    if (!cyInstance) return;
    const el = cyInstance.$id(definitionId);
    if (el.length > 0) {
      el.select();
      cyInstance.center(el);
      const resolved = resolveSelectedNode(definitionId);
      if (resolved) {
        selectedNode.value = resolved;
        inspectorTab.value = 'schema';
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Nav controls
// ---------------------------------------------------------------------------

function zoomIn(): void {
  if (!cyInstance) return;
  const next = cyInstance.zoom() * 1.25;
  cyInstance.zoom({ level: Math.min(next, cyInstance.maxZoom()), renderedPosition: { x: cyInstance.width() / 2, y: cyInstance.height() / 2 } });
}

function zoomOut(): void {
  if (!cyInstance) return;
  const next = cyInstance.zoom() / 1.25;
  cyInstance.zoom({ level: Math.max(next, cyInstance.minZoom()), renderedPosition: { x: cyInstance.width() / 2, y: cyInstance.height() / 2 } });
}

function fitGraph(): void {
  cyInstance?.fit(undefined, 60);
}
</script>

<template>
  <div class="bookstore-graph-container">
    <!-- Tab bar: TBox / ABox -->
    <div class="graph-tabs" role="tablist" aria-label="Graph layer">
      <button
        class="graph-tab"
        :class="{ 'graph-tab--active': activeLayer === 'tbox' }"
        role="tab"
        :aria-selected="activeLayer === 'tbox'"
        aria-controls="graph-layer-panel"
        @click="selectLayer('tbox')"
      >
        TBox <span class="graph-tab-sub">(schema)</span>
      </button>
      <button
        class="graph-tab"
        :class="{ 'graph-tab--active': activeLayer === 'abox' }"
        role="tab"
        :aria-selected="activeLayer === 'abox'"
        aria-controls="graph-layer-panel"
        @click="selectLayer('abox')"
      >
        ABox <span class="graph-tab-sub">(data)</span>
      </button>
    </div>

    <!-- Color legend: explains node kinds (left) + edge kinds (right) -->
    <div class="graph-legend">
      <div class="graph-legend-body">
        <!-- Left column: node kinds (filtered by active layer) -->
        <div class="graph-legend-col">
          <h4 class="graph-legend-heading">Nodes</h4>
          <ul class="graph-legend-list">
            <!-- TBox nodes -->
            <template v-if="activeLayer === 'tbox'">
              <li class="graph-legend-row">
                <span class="graph-legend-swatch">
                  <svg width="80" height="24" aria-hidden="true">
                    <rect x="1" y="1" width="78" height="22" rx="6" ry="6" fill="#005a9c" />
                    <text x="40" y="16" text-anchor="middle" fill="#ffffff" font-size="11" font-family="sans-serif">Entity</text>
                  </svg>
                </span>
                <span class="graph-legend-label">
                  <strong>Entity</strong> — registered top-level class (Customer, Order, Book, Review, …)
                </span>
              </li>
              <li class="graph-legend-row">
                <span class="graph-legend-swatch">
                  <svg width="80" height="24" aria-hidden="true">
                    <rect x="1" y="1" width="78" height="22" rx="6" ry="6" fill="#a8d1f0" />
                    <text x="40" y="16" text-anchor="middle" fill="#003366" font-size="11" font-family="sans-serif">Primitive</text>
                  </svg>
                </span>
                <span class="graph-legend-label">
                  <strong>Primitive</strong> — named scalar / constrained type (Email, Iso8601, Amount, …)
                </span>
              </li>
            </template>
            <!-- ABox nodes -->
            <template v-if="activeLayer === 'abox'">
              <li class="graph-legend-row">
                <span class="graph-legend-swatch">
                  <svg width="80" height="24" aria-hidden="true">
                    <ellipse cx="40" cy="12" rx="38" ry="10" fill="#fbf3d4" stroke="#daa520" stroke-width="1.5" stroke-dasharray="3,2" />
                    <text x="40" y="16" text-anchor="middle" fill="#5a4710" font-size="11" font-style="italic" font-family="sans-serif">Instance</text>
                  </svg>
                </span>
                <span class="graph-legend-label">
                  <strong>Instance</strong> — ABox individual (Bastian Bux, neverending-1979-thienemann, …)
                </span>
              </li>
              <li class="graph-legend-row">
                <span class="graph-legend-swatch">
                  <svg width="80" height="24" aria-hidden="true">
                    <rect x="1" y="1" width="78" height="22" rx="6" ry="6" fill="#f3f3f3" stroke="#bdbdbd" stroke-width="1" />
                    <text x="40" y="16" text-anchor="middle" fill="#555555" font-size="9" font-family="monospace">"literal"</text>
                  </svg>
                </span>
                <span class="graph-legend-label">
                  <strong>Literal</strong> — datatype / language-tagged value node
                </span>
              </li>
            </template>
          </ul>
        </div>

        <!-- Right column: edge kinds (filtered by active layer) -->
        <div class="graph-legend-col">
          <h4 class="graph-legend-heading">Edges</h4>
          <ul class="graph-legend-list">
            <!-- TBox edges -->
            <template v-if="activeLayer === 'tbox'">
              <li class="graph-legend-row">
                <span class="graph-legend-swatch">
                  <svg width="64" height="16" aria-hidden="true">
                    <line x1="2" y1="8" x2="54" y2="8" stroke="#888888" stroke-width="2" />
                    <polygon points="54,4 62,8 54,12" fill="#888888" />
                  </svg>
                </span>
                <span class="graph-legend-label">
                  <strong>subClassOf</strong> — <code>rdfs:subClassOf</code> (taxonomic narrowing)
                </span>
              </li>
              <li class="graph-legend-row">
                <span class="graph-legend-swatch">
                  <svg width="64" height="16" aria-hidden="true">
                    <line x1="2" y1="8" x2="62" y2="8" stroke="#28a745" stroke-width="2" stroke-dasharray="5,3" />
                  </svg>
                </span>
                <span class="graph-legend-label">
                  <strong>equivalentClass</strong> — <code>owl:equivalentClass</code> (alias / structural identity)
                </span>
              </li>
              <li class="graph-legend-row">
                <span class="graph-legend-swatch">
                  <svg width="64" height="16" aria-hidden="true">
                    <line x1="2" y1="8" x2="54" y2="8" stroke="#0070c0" stroke-width="2" />
                    <polyline points="54,3 62,8 54,13" fill="none" stroke="#0070c0" stroke-width="2" />
                  </svg>
                </span>
                <span class="graph-legend-label">
                  <strong>range</strong> — <code>rdfs:range</code> (property → typed target)
                </span>
              </li>
              <li class="graph-legend-row">
                <span class="graph-legend-swatch">
                  <svg width="64" height="16" aria-hidden="true">
                    <line x1="2" y1="8" x2="54" y2="8" stroke="#cc7700" stroke-width="2" stroke-dasharray="1,3" />
                    <polyline points="54,3 62,8 54,13" fill="none" stroke="#cc7700" stroke-width="2" />
                  </svg>
                </span>
                <span class="graph-legend-label">
                  <strong>domain</strong> — <code>rdfs:domain</code> (explicit override)
                </span>
              </li>
              <li class="graph-legend-row">
                <span class="graph-legend-swatch">
                  <svg width="64" height="16" aria-hidden="true">
                    <line x1="2" y1="8" x2="62" y2="8" stroke="#d63a3a" stroke-width="2" stroke-dasharray="5,3" />
                  </svg>
                </span>
                <span class="graph-legend-label">
                  <strong>disjointWith</strong> — <code>owl:disjointWith</code> (no shared instances)
                </span>
              </li>
              <li class="graph-legend-row">
                <span class="graph-legend-swatch">
                  <svg width="64" height="16" aria-hidden="true">
                    <line x1="2" y1="8" x2="56" y2="8" stroke="#8a2be2" stroke-width="2" />
                    <line x1="56" y1="3" x2="56" y2="13" stroke="#8a2be2" stroke-width="2" />
                  </svg>
                </span>
                <span class="graph-legend-label">
                  <strong>complementOf</strong> — <code>owl:complementOf</code> (negation)
                </span>
              </li>
              <li class="graph-legend-row">
                <span class="graph-legend-swatch">
                  <svg width="64" height="16" aria-hidden="true">
                    <line x1="2" y1="8" x2="54" y2="8" stroke="#08717a" stroke-width="2" stroke-dasharray="1,3" />
                    <circle cx="58" cy="8" r="3" fill="none" stroke="#08717a" stroke-width="1.5" />
                  </svg>
                </span>
                <span class="graph-legend-label">
                  <strong>restriction</strong> — <code>owl:Restriction</code> (cardinality / hasValue / …)
                </span>
              </li>
            </template>
            <!-- ABox edges -->
            <template v-if="activeLayer === 'abox'">
              <li class="graph-legend-row">
                <span class="graph-legend-swatch">
                  <svg width="64" height="16" aria-hidden="true">
                    <line x1="2" y1="8" x2="54" y2="8" stroke="#b8860b" stroke-width="2" />
                    <polygon points="54,4 62,8 54,12" fill="#b8860b" />
                  </svg>
                </span>
                <span class="graph-legend-label">
                  <strong>instanceType</strong> — <code>rdf:type</code> (individual → its class)
                </span>
              </li>
              <li class="graph-legend-row">
                <span class="graph-legend-swatch">
                  <svg width="64" height="16" aria-hidden="true">
                    <line x1="2" y1="8" x2="54" y2="8" stroke="#cdb35a" stroke-width="1.5" />
                    <polyline points="54,3 62,8 54,13" fill="none" stroke="#cdb35a" stroke-width="1.5" />
                  </svg>
                </span>
                <span class="graph-legend-label">
                  <strong>instanceProperty</strong> — property assertion (individual → value)
                </span>
              </li>
              <li class="graph-legend-row">
                <span class="graph-legend-swatch">
                  <svg width="64" height="16" aria-hidden="true">
                    <line x1="2" y1="8" x2="62" y2="8" stroke="#daa520" stroke-width="2" stroke-dasharray="5,3" />
                  </svg>
                </span>
                <span class="graph-legend-label">
                  <strong>sameAs</strong> — <code>owl:sameAs</code> (ABox identity)
                </span>
              </li>
              <li class="graph-legend-row">
                <span class="graph-legend-swatch">
                  <svg width="64" height="16" aria-hidden="true">
                    <line x1="2" y1="8" x2="54" y2="8" stroke="#c2185b" stroke-width="2.5" />
                    <polyline points="54,3 62,8 54,13" fill="none" stroke="#c2185b" stroke-width="2" />
                  </svg>
                </span>
                <span class="graph-legend-label">
                  <strong>annotatedEdge</strong> — RDF-star annotation on a property assertion
                </span>
              </li>
            </template>
          </ul>
        </div>
      </div>
    </div>

    <!-- Graph wrapper: contracts when inspector is open -->
    <div
      id="graph-layer-panel"
      ref="wrapperRef"
      class="graph-wrapper"
      :class="{ 'has-panel': selectedNode !== null }"
      role="tabpanel"
      :aria-label="activeLayer === 'tbox' ? 'TBox schema graph' : 'ABox data graph'"
    >
      <!-- Loading indicator -->
      <div v-if="loading" class="graph-loading">
        Loading graph data...
      </div>

      <!-- Error -->
      <div v-if="loadError" class="graph-error">
        <p><strong>Graph failed to load:</strong> {{ loadError }}</p>
      </div>

      <!-- Cytoscape canvas -->
      <div
        v-show="!loading && !loadError"
        ref="containerRef"
        class="cy-container"
        aria-label="Bookstore ontology graph"
      />

      <!-- Navigation pane: zoom + fit controls (bottom-right of wrapper) -->
      <div
        v-show="!loading && !loadError"
        class="graph-nav"
        role="toolbar"
        aria-label="Graph navigation"
      >
        <button class="graph-nav-btn" title="Zoom in" @click="zoomIn">＋</button>
        <button class="graph-nav-btn" title="Zoom out" @click="zoomOut">－</button>
        <button class="graph-nav-btn" title="Fit to view" @click="fitGraph">⤢</button>
      </div>
    </div>

    <!-- Inspector panel: appears BELOW the graph when a node is selected -->
    <div v-if="selectedNode" class="graph-inspector">
      <!-- Header: label + kind/layer badge + dismiss -->
      <div class="graph-inspector-header">
        <div class="graph-inspector-title">
          <span class="graph-inspector-name-row">
            <strong>{{ selectedNode.label }}</strong>
            <span class="graph-inspector-badge" :class="`graph-inspector-badge--${selectedNode.kind}`">
              {{ selectedNode.kind }} · {{ selectedNode.layer }}
            </span>
          </span>
          <code class="graph-inspector-iri">{{ selectedNode.id }}</code>
        </div>
        <button class="graph-inspector-close" aria-label="Close inspector" @click="closePanel">✕</button>
      </div>

      <!-- "Defined by" section for ABox nodes -->
      <div v-if="selectedNode.layer === 'abox' && selectedNode.definitionId" class="graph-inspector-defined-by">
        <span class="graph-inspector-defined-label">Defined by:</span>
        <strong>{{ selectedNode.definitionLabel }}</strong>
        <code class="graph-inspector-iri">{{ selectedNode.definitionId }}</code>
        <button
          class="graph-inspector-view-tbox-btn"
          @click="viewDefinitionInTbox(selectedNode.definitionId!)"
        >
          View in TBox
        </button>
      </div>

      <!-- Body: relations + the selected node's OWN representation -->
      <div class="graph-inspector-body">
        <!-- Left column: relations -->
        <div class="graph-inspector-col">
          <h4 class="graph-inspector-col-heading">Relations</h4>
          <div class="graph-inspector-scroll">
            <ul v-if="selectedNode.edges.length > 0" class="graph-inspector-edges">
              <li v-for="edge in selectedNode.edges" :key="edge.id">
                <span class="edge-kind">{{ edge.kind }}</span>
                <span>{{ edge.label }}</span>
                →
                <code>{{ edge.source === selectedNode.id ? edge.target.split(':').pop() : edge.source.split(':').pop() }}</code>
              </li>
            </ul>
            <p v-else class="graph-inspector-empty">No relations for this node.</p>
          </div>
        </div>

        <!-- Right column: the node's own representation -->
        <div class="graph-inspector-col">
          <!-- TBox node IS a type → show its JSON Schema / OWL JSON-LD -->
          <template v-if="selectedNode.layer === 'tbox'">
            <h4 class="graph-inspector-col-heading">This {{ selectedNode.kind }} — {{ selectedNode.label }}</h4>
            <div class="graph-inspector-reptabs" role="tablist" aria-label="Representation">
              <button class="graph-inspector-reptab" :class="{ 'graph-inspector-reptab--active': inspectorTab === 'schema' }" role="tab" :aria-selected="inspectorTab === 'schema'" @click="inspectorTab = 'schema'">JSON Schema</button>
              <button class="graph-inspector-reptab" :class="{ 'graph-inspector-reptab--active': inspectorTab === 'jsonld' }" role="tab" :aria-selected="inspectorTab === 'jsonld'" @click="inspectorTab = 'jsonld'">JSON-LD (OWL)</button>
            </div>
            <div class="graph-inspector-scroll">
              <pre v-if="inspectorTab === 'schema' && selectedNode.schema" class="graph-inspector-pre">{{ schemaText(selectedNode.schema) }}</pre>
              <pre v-else-if="inspectorTab === 'jsonld' && selectedNode.jsonLd" class="graph-inspector-pre">{{ jsonLdText(selectedNode.jsonLd) }}</pre>
              <p v-else class="graph-inspector-empty">No {{ inspectorTab === 'schema' ? 'JSON Schema' : 'JSON-LD' }} for this node.</p>
            </div>
          </template>

          <!-- ABox node is an individual → show its instance data as JSON-LD -->
          <template v-else>
            <h4 class="graph-inspector-col-heading">Individual data — JSON-LD</h4>
            <p class="graph-inspector-caption">The RDF this value projects to via <code>toQuads</code>.</p>
            <div class="graph-inspector-scroll">
              <pre v-if="selectedNode.jsonLd" class="graph-inspector-pre">{{ jsonLdText(selectedNode.jsonLd) }}</pre>
              <p v-else class="graph-inspector-empty">No JSON-LD fragment for this individual.</p>
            </div>
          </template>
        </div>
      </div>

      <!-- ABox only: the TYPE DEFINITION (shown once), clearly separated from the individual above -->
      <div v-if="selectedNode.layer === 'abox' && selectedNode.definitionId" class="graph-inspector-definition-detail">
        <h4 class="graph-inspector-col-heading">
          Type definition — {{ selectedNode.definitionLabel }}
          <span class="graph-inspector-badge graph-inspector-badge--entity">TBox</span>
        </h4>
        <p class="graph-inspector-caption">The schema and ontology that types the individual above.</p>
        <div class="graph-inspector-reptabs" role="tablist" aria-label="Definition representation">
          <button class="graph-inspector-reptab" :class="{ 'graph-inspector-reptab--active': inspectorTab === 'schema' }" role="tab" :aria-selected="inspectorTab === 'schema'" @click="inspectorTab = 'schema'">JSON Schema</button>
          <button class="graph-inspector-reptab" :class="{ 'graph-inspector-reptab--active': inspectorTab === 'jsonld' }" role="tab" :aria-selected="inspectorTab === 'jsonld'" @click="inspectorTab = 'jsonld'">JSON-LD (OWL)</button>
        </div>
        <div class="graph-inspector-scroll">
          <pre v-if="inspectorTab === 'schema' && selectedNode.definitionSchema" class="graph-inspector-pre">{{ schemaText(selectedNode.definitionSchema) }}</pre>
          <pre v-else-if="inspectorTab === 'jsonld' && selectedNode.definitionJsonLd" class="graph-inspector-pre">{{ jsonLdText(selectedNode.definitionJsonLd) }}</pre>
          <p v-else class="graph-inspector-empty">No {{ inspectorTab === 'schema' ? 'JSON Schema' : 'JSON-LD' }} for this type.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Outer container — flex column so inspector flows below the graph */
.bookstore-graph-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  overflow: hidden;
  background: var(--vp-c-bg-soft);
}

/* Tab bar */
.graph-tabs {
  display: flex;
  background: var(--vp-c-bg);
  border-bottom: 1px solid var(--vp-c-divider);
  padding: 0 12px;
  gap: 2px;
}

.graph-tab {
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  color: var(--vp-c-text-2);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  line-height: 1.4;
  transition: color 0.12s ease, border-color 0.12s ease;
  margin-bottom: -1px;
}

.graph-tab:hover {
  color: var(--vp-c-text-1);
}

.graph-tab--active {
  color: var(--vp-c-brand-1);
  border-bottom-color: var(--vp-c-brand-1);
}

.graph-tab-sub {
  font-size: 11px;
  font-weight: 400;
  color: var(--vp-c-text-3, var(--vp-c-text-2));
}

/* Color legend — sits above the graph wrapper */
.graph-legend {
  width: 100%;
  background: var(--vp-c-bg);
  border-bottom: 1px solid var(--vp-c-divider);
  padding: 12px 16px;
  font-size: 12px;
}

.graph-legend-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

@media (max-width: 720px) {
  .graph-legend-body {
    grid-template-columns: 1fr;
  }
}

.graph-legend-heading {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.graph-legend-list {
  list-style: none;
  padding-left: 0;
  margin: 0;
}

.graph-legend-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
  line-height: 1.4;
}

.graph-legend-row:last-child {
  margin-bottom: 0;
}

.graph-legend-swatch {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
}

.graph-legend-label {
  font-size: 12px;
  color: var(--vp-c-text-1);
}

.graph-legend-label code {
  font-size: 11px;
  background: var(--vp-c-bg-soft);
  padding: 1px 4px;
  border-radius: 3px;
  color: var(--vp-c-text-2);
}

/* Graph wrapper — transitions its height when the inspector opens/closes */
.graph-wrapper {
  position: relative;
  width: 100%;
  height: 720px;
  transition: height 240ms ease;
  flex-shrink: 0;
}

.graph-wrapper.has-panel {
  height: 460px;
}

.cy-container {
  width: 100%;
  height: 100%;
}

.graph-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--vp-c-text-2);
  font-size: 14px;
}

.graph-error {
  padding: 16px;
  color: var(--vp-c-danger-1, #cc0000);
}

/* Navigation pane — bottom-right zoom / fit controls */
.graph-nav {
  position: absolute;
  bottom: 12px;
  right: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  padding: 4px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  z-index: 9;
}

.graph-nav-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  color: var(--vp-c-text-1);
  cursor: pointer;
  font-size: 16px;
  font-weight: 600;
  line-height: 1;
  padding: 0;
  transition: background 0.12s ease, border-color 0.12s ease;
}

.graph-nav-btn:hover {
  background: var(--vp-c-brand-soft);
  border-color: var(--vp-c-brand-3);
  color: var(--vp-c-brand-1);
}

.graph-nav-btn:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 1px;
}

/* Inspector panel — in-flow below the graph */
.graph-inspector {
  width: 100%;
  background: var(--vp-c-bg);
  border-top: 1px solid var(--vp-c-divider);
  padding: 12px 16px 16px;
  font-size: 12px;
}

.graph-inspector-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.graph-inspector-title {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.graph-inspector-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.graph-inspector-name-row strong {
  font-size: 14px;
  color: var(--vp-c-text-1);
}

/* Kind/layer badge */
.graph-inspector-badge {
  font-size: 9px;
  padding: 1px 6px;
  border-radius: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

.graph-inspector-badge--entity {
  background: #005a9c22;
  color: #005a9c;
}

.graph-inspector-badge--primitive {
  background: #a8d1f022;
  color: #003366;
}

.graph-inspector-badge--instance {
  background: #fbf3d4;
  color: #5a4710;
  border: 1px dashed #daa520;
}

.graph-inspector-badge--literal {
  background: #f3f3f3;
  color: #555555;
  border: 1px solid #bdbdbd;
}

.graph-inspector-iri {
  font-size: 10px;
  color: var(--vp-c-text-2);
  word-break: break-all;
}

.graph-inspector-close {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--vp-c-text-2);
  font-size: 14px;
  padding: 0 4px;
  flex-shrink: 0;
  line-height: 1;
}

.graph-inspector-close:hover {
  color: var(--vp-c-text-1);
}

/* "Defined by" section (ABox nodes) */
.graph-inspector-defined-by {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
  padding: 6px 10px;
  background: var(--vp-c-bg-soft);
  border-radius: 6px;
  font-size: 12px;
}

.graph-inspector-defined-label {
  color: var(--vp-c-text-2);
  font-weight: 500;
}

.graph-inspector-view-tbox-btn {
  margin-left: auto;
  padding: 3px 10px;
  font-size: 11px;
  font-weight: 500;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  border: 1px solid var(--vp-c-brand-3);
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.12s ease;
}

.graph-inspector-view-tbox-btn:hover {
  background: var(--vp-c-brand-3);
  color: var(--vp-c-bg);
}

/* Representation sub-tabs */
.graph-inspector-reptabs {
  display: flex;
  gap: 2px;
  margin-bottom: 10px;
  border-bottom: 1px solid var(--vp-c-divider);
}

.graph-inspector-reptab {
  padding: 4px 12px;
  font-size: 11px;
  font-weight: 500;
  color: var(--vp-c-text-2);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  margin-bottom: -1px;
  transition: color 0.12s ease, border-color 0.12s ease;
}

.graph-inspector-reptab:hover {
  color: var(--vp-c-text-1);
}

.graph-inspector-reptab--active {
  color: var(--vp-c-brand-1);
  border-bottom-color: var(--vp-c-brand-1);
}

/* Caption under sub-tab heading (ABox schema note) */
.graph-inspector-caption {
  margin: 0 0 4px;
  font-size: 10px;
  color: var(--vp-c-text-2);
  font-style: italic;
}

/* Two-column grid body */
.graph-inspector-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 12px;
}

@media (max-width: 720px) {
  .graph-inspector-body {
    grid-template-columns: 1fr;
  }
}

.graph-inspector-col-heading {
  margin: 0 0 6px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--vp-c-text-2);
}

.graph-inspector-col-subheading {
  margin: 0 0 4px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--vp-c-text-3, var(--vp-c-text-2));
}

/* Scrollable inner body — ~16 lines tall */
.graph-inspector-scroll {
  max-height: 240px;
  overflow-y: auto;
  font-size: 11px;
  line-height: 1.45;
}

/* RDF column */
.graph-inspector-edges {
  list-style: none;
  padding: 0;
  margin: 0;
}

.graph-inspector-edges li {
  margin-bottom: 4px;
}

.edge-kind {
  display: inline-block;
  font-size: 9px;
  padding: 1px 4px;
  border-radius: 3px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  margin-right: 4px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

/* JSON Schema / JSON-LD column */
.graph-inspector-pre {
  margin: 0;
  font-size: 11px;
  line-height: 1.45;
  background: var(--vp-c-bg-soft);
  padding: 6px 8px;
  border-radius: 4px;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-x: auto;
}

.graph-inspector-empty {
  margin: 0;
  color: var(--vp-c-text-3, var(--vp-c-text-2));
  font-style: italic;
}

/* ABox definition detail panel */
.graph-inspector-definition-detail {
  border-top: 1px solid var(--vp-c-divider);
  padding-top: 10px;
  margin-top: 4px;
}

.graph-inspector-definition-cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 6px;
}

@media (max-width: 720px) {
  .graph-inspector-definition-cols {
    grid-template-columns: 1fr;
  }
}
</style>
