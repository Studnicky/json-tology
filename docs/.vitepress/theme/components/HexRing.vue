<script setup lang="ts">
// Honeycomb: 1 JST hex at center + 6 domain hexes touching its edges.
// Uses pointy-top hex tessellation math.
//
//   neighbor center offsets (pointy-top):
//     E/W:     ± visualWidth
//     NE/NW/SE/SW: ± visualWidth/2 along x, ± visualHeight·3/4 along y
//
// The SVG viewBox is 0 0 400 400 (square) but the hex visual bounds
// inside it are 304.8 × 352 (an aspect ratio of √3/2). So when we
// render the <img> at imgSize × imgSize, the visible hex is
// 0.762·imgSize wide and 0.88·imgSize tall.

interface NodeDef {
  src: string;
  label: string;
}

const ringNodes: readonly NodeDef[] = [
  { src: 'nodes/typescript-node.svg',  label: 'TypeScript'  },  // E
  { src: 'nodes/json-schema-node.svg', label: 'JSON Schema' },  // SE
  { src: 'nodes/validation-node.svg',  label: 'Validation'  },  // SW
  { src: 'nodes/rdf-node.svg',         label: 'RDF'         },  // W
  { src: 'nodes/w3c-node.svg',         label: 'W3C'         },  // NW
  { src: 'nodes/nodejs-node.svg',      label: 'Node.js'     }   // NE
];

const base = import.meta.env.BASE_URL;

const imgSize = 56;
const HEX_W_RATIO = 304.8 / 400;
const HEX_H_RATIO = 352 / 400;
const visualW = imgSize * HEX_W_RATIO;
const visualH = imgSize * HEX_H_RATIO;

// Six positions, ordered to match ringNodes above (E, SE, SW, W, NW, NE).
const offsets = [
  { x:  visualW,     y:  0                  },  // E
  { x:  visualW / 2, y:  visualH * 0.75     },  // SE
  { x: -visualW / 2, y:  visualH * 0.75     },  // SW
  { x: -visualW,     y:  0                  },  // W
  { x: -visualW / 2, y: -visualH * 0.75     },  // NW
  { x:  visualW / 2, y: -visualH * 0.75     }   // NE
];

const positions = ringNodes.map((node, i) => ({ ...node, ...offsets[i] }));

// Container bounding box: must hold the center hex plus a full hex on
// every side. Width = 2·visualW (right-edge of E hex to left-edge of W).
// Height = 2·(visualH · 0.75 + visualH/2) = 2.5·visualH.
const boxW = Math.ceil(2 * visualW + 4);
const boxH = Math.ceil(2.5 * visualH + 4);
</script>

<template>
  <div class="hex-ring">
    <a class="ring-container" :style="{ width: `${boxW}px`, height: `${boxH}px` }" href="/json-tology/" aria-label="json-tology home">
      <div
        v-for="(pos, i) in positions"
        :key="i"
        class="ring-node"
        :style="{
          width: `${imgSize}px`,
          height: `${imgSize}px`,
          marginLeft: `-${imgSize / 2}px`,
          marginTop: `-${imgSize / 2}px`,
          transform: `translate(${pos.x}px, ${pos.y}px)`
        }"
        :title="pos.label"
      >
        <img :src="`${base}${pos.src}`" :alt="pos.label" />
      </div>
      <div
        class="ring-center"
        :style="{
          width: `${imgSize}px`,
          height: `${imgSize}px`,
          marginLeft: `-${imgSize / 2}px`,
          marginTop: `-${imgSize / 2}px`
        }"
        title="json-tology"
      >
        <img :src="`${base}nodes/jst-node.svg`" alt="json-tology" />
      </div>
    </a>
  </div>
</template>

<style scoped>
.hex-ring {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 14px 0 10px;
  border-bottom: 1px solid var(--vp-c-divider);
  margin-bottom: 10px;
}

.ring-container {
  position: relative;
  display: block;
}

.ring-node,
.ring-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transition: filter 0.18s ease;
}

.ring-center {
  filter: drop-shadow(0 1px 4px rgba(8, 113, 122, 0.45));
}

.ring-node:hover,
.ring-center:hover {
  filter: drop-shadow(0 2px 8px rgba(36, 165, 181, 0.6));
}

.ring-node img,
.ring-center img {
  width: 100%;
  height: 100%;
  display: block;
  pointer-events: none;
}
</style>
