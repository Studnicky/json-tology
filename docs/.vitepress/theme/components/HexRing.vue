<script setup lang="ts">
// Honeycomb: 1 JST hex at center + 6 domain hexes touching its edges.
// Each cell links to the canonical home of the technology it represents.

interface NodeDef {
  src: string;
  label: string;
  href: string;
}

const ringNodes: readonly NodeDef[] = [
  { src: 'nodes/typescript-node.svg',  label: 'TypeScript',  href: 'https://www.typescriptlang.org/' },                                  // E
  { src: 'nodes/json-schema-node.svg', label: 'JSON Schema', href: 'https://json-schema.org/' },                                          // SE
  { src: 'nodes/validation-node.svg',  label: 'Validation',  href: 'https://json-schema.org/draft/2020-12/json-schema-validation' },     // SW
  { src: 'nodes/rdf-node.svg',         label: 'RDF',         href: 'https://www.w3.org/TR/rdf12-concepts/' },                             // W
  { src: 'nodes/w3c-node.svg',         label: 'W3C',         href: 'https://www.w3.org/' },                                               // NW
  { src: 'nodes/nodejs-node.svg',      label: 'Node.js',     href: 'https://nodejs.org/api/' }                                            // NE
];

const base = import.meta.env.BASE_URL;

const imgSize = 56;
const HEX_W_RATIO = 304.8 / 400;
const HEX_H_RATIO = 352 / 400;
const visualW = imgSize * HEX_W_RATIO;
const visualH = imgSize * HEX_H_RATIO;

const offsets = [
  { x:  visualW,     y:  0                  },  // E
  { x:  visualW / 2, y:  visualH * 0.75     },  // SE
  { x: -visualW / 2, y:  visualH * 0.75     },  // SW
  { x: -visualW,     y:  0                  },  // W
  { x: -visualW / 2, y: -visualH * 0.75     },  // NW
  { x:  visualW / 2, y: -visualH * 0.75     }   // NE
];

const positions = ringNodes.map((node, i) => ({ ...node, ...offsets[i] }));

const boxW = Math.ceil(2 * visualW + 4);
const boxH = Math.ceil(2.5 * visualH + 4);
</script>

<template>
  <div class="hex-ring">
    <div class="ring-container" :style="{ width: `${boxW}px`, height: `${boxH}px` }">
      <a
        v-for="(pos, i) in positions"
        :key="i"
        class="ring-node"
        :href="pos.href"
        target="_blank"
        rel="noopener"
        :title="pos.label"
        :aria-label="pos.label"
        :style="{
          width: `${imgSize}px`,
          height: `${imgSize}px`,
          marginLeft: `-${imgSize / 2}px`,
          marginTop: `-${imgSize / 2}px`,
          transform: `translate(${pos.x}px, ${pos.y}px)`
        }"
      >
        <img :src="`${base}${pos.src}`" :alt="pos.label" />
      </a>
      <a
        class="ring-center"
        href="/json-tology/"
        title="json-tology"
        aria-label="json-tology home"
        :style="{
          width: `${imgSize}px`,
          height: `${imgSize}px`,
          marginLeft: `-${imgSize / 2}px`,
          marginTop: `-${imgSize / 2}px`
        }"
      >
        <img :src="`${base}nodes/jst-node.svg`" alt="json-tology" />
      </a>
    </div>
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
  display: block;
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
