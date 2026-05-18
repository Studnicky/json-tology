<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import type { EdgeData, NodeData } from '../utils/bookstoreGraphData.js';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const containerRef = ref<HTMLDivElement | null>(null);
const loadError = ref<string | null>(null);
const loading = ref(true);
const selectedNode = ref<{ id: string; schema: unknown; edges: EdgeData[] } | null>(null);

// Keep a reference to destroy on unmount
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
    ],
    layout: {
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
    } as Record<string, unknown>
  });

  // Listen for the layout to actually finish before fitting. The cytoscape
  // constructor returns before the embedded `layout` option's run() emits
  // `layoutstop`, so an immediate fit() captures whatever positions exist
  // at construction (often clustered or pre-layout).
  function refit(): void {
    if (cyInstance === null) return;
    cyInstance.fit(undefined, 50);
  }
  (cyInstance as unknown as { one(ev: string, cb: () => void): void }).one('layoutstop', () => {
    refit();
    // Defer the zoom-clamp until fit has settled the zoom value.
    requestAnimationFrame(() => {
      if (cyInstance !== null) {
        const fitZoom = cyInstance.zoom();
        cyInstance.minZoom(fitZoom * 0.25);
        cyInstance.maxZoom(fitZoom * 6);
      }
    });
  });
  // Belt-and-suspenders for two cases the layoutstop listener can't cover:
  // (1) fonts loading after layout completed and shifting node bounds,
  // (2) a ResizeObserver firing because the sidebar drawer toggled.
  setTimeout(refit, 250);
  if (containerRef.value !== null && typeof ResizeObserver !== 'undefined') {
    const resizeObserver = new ResizeObserver(() => {
      // resize() tells Cytoscape to re-read the container dimensions and
      // resize its internal canvas. Without this, fit() would compute zoom
      // against stale dimensions and the graph stays clipped.
      cyInstance?.resize();
      refit();
    });
    resizeObserver.observe(containerRef.value);
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
    <!-- Loading indicator -->
    <div v-if="loading" class="graph-loading">
      Loading graph data...
    </div>

    <!-- Error -->
    <div v-if="loadError" class="graph-error">
      <p><strong>Graph failed to load:</strong> {{ loadError }}</p>
    </div>

    <!-- Cytoscape container -->
    <div
      v-show="!loading && !loadError"
      ref="containerRef"
      class="cy-container"
      aria-label="Bookstore ontology graph"
    />

    <!-- Navigation pane: zoom + fit controls (bottom-right) -->
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

    <!-- Side panel for selected node -->
    <div v-if="selectedNode" class="graph-panel">
      <div class="graph-panel-header">
        <strong>{{ selectedNode.id.split(':').pop() }}</strong>
        <button class="graph-panel-close" @click="closePanel">✕</button>
      </div>
      <div class="graph-panel-iri">
        <code>{{ selectedNode.id }}</code>
      </div>
      <div v-if="selectedNode.edges.length > 0" class="graph-panel-edges">
        <p><strong>Relations:</strong></p>
        <ul>
          <li v-for="edge in selectedNode.edges" :key="edge.id">
            <span class="edge-kind">{{ edge.kind }}</span>
            {{ edge.label }} →
            <code>{{ edge.source === selectedNode.id ? edge.target.split(':').pop() : edge.source.split(':').pop() }}</code>
          </li>
        </ul>
      </div>
      <div v-if="selectedNode.schema" class="graph-panel-schema">
        <p><strong>Schema:</strong></p>
        <pre>{{ schemaText(selectedNode.schema) }}</pre>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bookstore-graph-container {
  position: relative;
  width: 100%;
  min-height: 720px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  overflow: hidden;
  background: var(--vp-c-bg-soft);
}

.cy-container {
  width: 100%;
  height: 720px;
}

.graph-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 720px;
  color: var(--vp-c-text-2);
  font-size: 14px;
}

.graph-error {
  padding: 16px;
  color: var(--vp-c-danger-1, #cc0000);
}

.graph-panel {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 280px;
  max-height: 500px;
  overflow-y: auto;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  padding: 12px;
  font-size: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  z-index: 10;
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

.graph-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 14px;
}

.graph-panel-close {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--vp-c-text-2);
  font-size: 14px;
  padding: 0 4px;
}

.graph-panel-iri {
  margin-bottom: 8px;
  word-break: break-all;
}

.graph-panel-iri code {
  font-size: 10px;
  color: var(--vp-c-text-2);
}

.graph-panel-edges ul {
  list-style: none;
  padding: 0;
  margin: 4px 0 8px;
}

.graph-panel-edges li {
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

.graph-panel-schema pre {
  font-size: 10px;
  max-height: 200px;
  overflow: auto;
  background: var(--vp-c-bg-soft);
  padding: 6px;
  border-radius: 4px;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
