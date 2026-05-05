<script setup lang="ts">
// Six SVG nodes arranged in a regular hex ring around the JST node
// at the center. Sits in the sidebar header.

interface NodeDef {
  src: string;
  label: string;
}

const ringNodes: readonly NodeDef[] = [
  { src: 'nodes/typescript-node.svg', label: 'TypeScript' },
  { src: 'nodes/json-schema-node.svg', label: 'JSON Schema' },
  { src: 'nodes/validation-node.svg', label: 'Validation' },
  { src: 'nodes/rdf-node.svg', label: 'RDF' },
  { src: 'nodes/w3c-node.svg', label: 'W3C' },
  { src: 'nodes/nodejs-node.svg', label: 'Node.js' }
];

const base = import.meta.env.BASE_URL;

// Six positions on a regular hexagon. Angles run from the top
// (12 o'clock) clockwise. Radius in pixels relative to container center.
const radius = 56;
const positions = ringNodes.map((node, i) => {
  const angleRad = (Math.PI / 3) * i - Math.PI / 2;
  return {
    ...node,
    x: Math.round(radius * Math.cos(angleRad)),
    y: Math.round(radius * Math.sin(angleRad))
  };
});
</script>

<template>
  <div class="hex-ring">
    <a class="ring-container" href="/json-tology/" aria-label="json-tology home">
      <div
        v-for="(pos, i) in positions"
        :key="i"
        class="ring-node"
        :style="{ transform: `translate(${pos.x}px, ${pos.y}px)` }"
        :title="pos.label"
      >
        <img :src="`${base}${pos.src}`" :alt="pos.label" />
      </div>
      <div class="ring-center" title="json-tology">
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
  padding: 16px 0 12px;
  border-bottom: 1px solid var(--vp-c-divider);
  margin-bottom: 12px;
}

.ring-container {
  position: relative;
  width: 168px;
  height: 168px;
  display: block;
}

.ring-node,
.ring-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transition: transform 0.2s ease, filter 0.2s ease;
}

.ring-node {
  width: 36px;
  height: 36px;
  margin-left: -18px;
  margin-top: -18px;
}

.ring-center {
  width: 60px;
  height: 60px;
  margin-left: -30px;
  margin-top: -30px;
  filter: drop-shadow(0 2px 6px rgba(8, 113, 122, 0.35));
}

.ring-node:hover,
.ring-center:hover {
  filter: drop-shadow(0 2px 8px rgba(36, 165, 181, 0.55));
}

.ring-node img,
.ring-center img {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
