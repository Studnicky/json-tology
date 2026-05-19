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
const selectedNode = ref<{ id: string; schema: unknown; edges: EdgeData[] } | null>(null);

// Keep a reference to destroy on unmount
interface CyLayoutHandle {
  run(): void;
}
interface CyHandle {
  destroy(): void;
  fit(elements?: unknown, padding?: number): void;
  resize(): void;
  zoom(): number;
  minZoom(level: number): void;
  maxZoom(level: number): void;
  userZoomingEnabled(enabled: boolean): void;
  on(event: string, selector: string | ((event: unknown) => void), handler?: (event: unknown) => void): void;
  one(event: string, handler: () => void): void;
  layout(options: Record<string, unknown>): CyLayoutHandle;
}
let cyInstance: CyHandle | null = null;

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

onMounted(async () => {
  // Import graph utilities (client-only — never runs during SSR)
  let graphData: { nodes: Array<{ data: NodeData }>; edges: Array<{ data: EdgeData }> };
  let schemaMap: Record<string, unknown>;

  try {
    const base = import.meta.env.BASE_URL;
    const [graphResp, schemaResp] = await Promise.all([
      fetch(`${base}data/bookstore-graph.json`),
      fetch(`${base}data/bookstore-schemas.json`)
    ]);
    if (!graphResp.ok) throw new Error(`graph fetch ${graphResp.status}`);
    if (!schemaResp.ok) throw new Error(`schema fetch ${schemaResp.status}`);
    [graphData, schemaMap] = await Promise.all([
      graphResp.json() as Promise<typeof graphData>,
      schemaResp.json() as Promise<typeof schemaMap>
    ]);
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

  // Build Cytoscape elements
  const elements = [
    ...graphData.nodes.map(n => ({ data: n.data })),
    ...graphData.edges.map(e => ({ data: e.data }))
  ];

  cyInstance = cytoscape({
    container: containerRef.value,
    elements,
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
      }
    ]
    // No layout option here — fcose runs synchronously below so re-layout
    // and fit are guaranteed to fire IMMEDIATELY after the cytoscape render
    // returns, rather than racing the constructor's deferred layoutstop.
  });

  // Run fcose synchronously (animate: false) and fit the viewport in the
  // same tick as the cytoscape render, so the first paint already shows
  // the laid-out graph instead of clustered pre-layout positions.
  function refit(): void {
    if (cyInstance === null) return;
    cyInstance.fit(undefined, 50);
  }
  cyInstance.layout({
    name: 'fcose',
    animate: false,
    fit: true,
    padding: 50,
    quality: 'proof',
    nodeDimensionsIncludeLabels: true,
    nodeRepulsion: () => 6500,
    idealEdgeLength: () => 80,
    edgeElasticity: () => 0.45,
    gravity: 0.3,
    gravityRangeCompound: 1.5,
    gravityCompound: 1.0,
    gravityRange: 3.8,
    numIter: 2500,
    randomize: false,
    uniformNodeDimensions: false,
    packComponents: true,
    tile: false
  }).run();
  refit();

  // Clamp zoom range to the just-settled fit value.
  const fitZoom = cyInstance.zoom();
  cyInstance.minZoom(fitZoom * 0.25);
  cyInstance.maxZoom(fitZoom * 6);

  // Observe the wrapper so Cytoscape re-centres whenever the wrapper
  // height transitions (e.g. inspector open/close).  containerRef covers
  // canvas-only resizes; wrapperRef covers the height transition animation.
  const observeTarget = wrapperRef.value ?? containerRef.value;
  if (observeTarget !== null && typeof ResizeObserver !== 'undefined') {
    const resizeObserver = new ResizeObserver(() => {
      // resize() tells Cytoscape to re-read the container dimensions and
      // resize its internal canvas. Without this, fit() would compute zoom
      // against stale dimensions and the graph stays clipped.
      cyInstance?.resize();
      refit();
    });
    resizeObserver.observe(observeTarget);
    onUnmounted(() => { resizeObserver.disconnect(); });
  }

  // Click handler: open side panel
  const allEdges = graphData.edges.map(e => e.data);

  cyInstance.on('tap', 'node', (event: { target: { data(): NodeData } }) => {
    const nodeData = event.target.data();
    const nodeId = nodeData.id;
    const schema = schemaMap[nodeId] ?? null;
    const related = allEdges.filter(
      e => e.source === nodeId || e.target === nodeId
    );
    selectedNode.value = { id: nodeId, schema, edges: related };
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

function closePanel(): void {
  selectedNode.value = null;
}

function schemaText(schema: unknown): string {
  return JSON.stringify(schema, null, 2);
}

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

function rerunLayout(): void {
  if (!cyInstance) return;
  const layout = cyInstance.layout({
    name: 'fcose',
    animate: false,
    quality: 'proof',
    nodeRepulsion: () => 8000,
    idealEdgeLength: () => 90,
    gravity: 0.25,
    gravityRangeCompound: 1.5,
    gravityCompound: 1.0,
    gravityRange: 3.8,
    numIter: 2500,
    randomize: true,
    uniformNodeDimensions: false,
    packComponents: true,
    tile: false
  } as Record<string, unknown>);
  layout.run();
  cyInstance.fit(undefined, 60);
}
</script>

<template>
  <div class="bookstore-graph-container">
    <!-- Color legend: explains node kinds (left) + edge kinds (right) -->
    <div class="graph-legend">
      <div class="graph-legend-body">
        <!-- Left column: node kinds -->
        <div class="graph-legend-col">
          <h4 class="graph-legend-heading">Nodes</h4>
          <ul class="graph-legend-list">
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
          </ul>
        </div>

        <!-- Right column: edge kinds -->
        <div class="graph-legend-col">
          <h4 class="graph-legend-heading">Edges</h4>
          <ul class="graph-legend-list">
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
          </ul>
        </div>
      </div>
    </div>

    <!-- Graph wrapper: contracts when inspector is open -->
    <div
      ref="wrapperRef"
      class="graph-wrapper"
      :class="{ 'has-panel': selectedNode !== null }"
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
        <button class="graph-nav-btn" title="Re-run layout" @click="rerunLayout">⟳</button>
      </div>
    </div>

    <!-- Inspector panel: appears BELOW the graph when a node is selected -->
    <div v-if="selectedNode" class="graph-inspector">
      <!-- Header: label + IRI + dismiss -->
      <div class="graph-inspector-header">
        <div class="graph-inspector-title">
          <strong>{{ selectedNode.id.split(':').pop() }}</strong>
          <code class="graph-inspector-iri">{{ selectedNode.id }}</code>
        </div>
        <button class="graph-inspector-close" aria-label="Close inspector" @click="closePanel">✕</button>
      </div>

      <!-- Two-column body: RDF | JSON Schema -->
      <div class="graph-inspector-body">
        <!-- Left column: RDF relations -->
        <div class="graph-inspector-col">
          <h4 class="graph-inspector-col-heading">RDF</h4>
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

        <!-- Right column: JSON Schema -->
        <div class="graph-inspector-col">
          <h4 class="graph-inspector-col-heading">JSON Schema</h4>
          <div class="graph-inspector-scroll">
            <pre v-if="selectedNode.schema" class="graph-inspector-pre">{{ schemaText(selectedNode.schema) }}</pre>
            <p v-else class="graph-inspector-empty">(no schema registered for this node)</p>
          </div>
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

/* Color legend — sits above the graph wrapper, visually connects via
   border-bottom-only divider so it reads as part of the same composition. */
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

/* Navigation pane — bottom-right zoom / fit / rerun-layout controls */
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
  margin-bottom: 12px;
}

.graph-inspector-title {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.graph-inspector-title strong {
  font-size: 14px;
  color: var(--vp-c-text-1);
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

/* Two-column grid body */
.graph-inspector-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
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

/* JSON Schema column */
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
</style>
