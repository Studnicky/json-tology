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
  zoom(): number;
  minZoom(level: number): void;
  maxZoom(level: number): void;
  userZoomingEnabled(enabled: boolean): void;
  on(event: string, selector: string | ((event: unknown) => void), handler?: (event: unknown) => void): void;
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
      }
    ],
    layout: {
      name: 'cose',
      animate: false,
      fit: true,
      padding: 80,
      nodeRepulsion: () => 7000,
      idealEdgeLength: () => 75,
      gravity: 90,
      numIter: 1500,
      randomize: false,
      componentSpacing: 50,
      boundingBox: { x1: 60, y1: 40, w: 940, h: 640 }
    } as Record<string, unknown>
  });

  // Bound zoom. After the layout's initial fit, the current zoom is the
  // "everything visible" level. That becomes the floor (no zoom-out past
  // full-graph) and we cap zoom-in at 3x for legibility on hover.
  cyInstance.fit(undefined, 60);
  const fitZoom = cyInstance.zoom();
  cyInstance.minZoom(fitZoom);
  cyInstance.maxZoom(fitZoom * 3);

  // After a user drags a node and releases, refit so the full graph stays
  // in frame. Keeps nodes from getting pushed off-screen.
  cyInstance.on('dragfree', 'node', () => {
    cyInstance?.fit(undefined, 60);
  });

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
