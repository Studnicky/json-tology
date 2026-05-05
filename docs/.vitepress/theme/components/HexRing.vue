<script setup lang="ts">
// Six hex SVG nodes arranged in a ring around a virtual seventh
// (the json-tology core) at the center. Sits in the sidebar header.

interface NodeDef {
  src: string;
  label: string;
}

const nodes: readonly NodeDef[] = [
  { src: 'nodes/typescript-node.svg', label: 'TypeScript' },
  { src: 'nodes/json-schema-node.svg', label: 'JSON Schema' },
  { src: 'nodes/validation-node.svg', label: 'Validation' },
  { src: 'nodes/rdf-node.svg', label: 'RDF' },
  { src: 'nodes/w3c-node.svg', label: 'W3C' },
  { src: 'nodes/nodejs-node.svg', label: 'Node.js' }
];

const base = import.meta.env.BASE_URL;

// Ring math: six positions around a regular hexagon. Angles run from
// the top (12 o'clock) clockwise. Radius is in pixels relative to
// the container's center.
const radius = 56;
const positions = nodes.map((node, i) => {
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
    <div class="ring-container">
      <div
        v-for="(pos, i) in positions"
        :key="i"
        class="ring-node"
        :style="{
          transform: `translate(${pos.x}px, ${pos.y}px)`
        }"
        :title="pos.label"
      >
        <img :src="`${base}${pos.src}`" :alt="pos.label" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.hex-ring {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 16px 0 8px;
  border-bottom: 1px solid var(--vp-c-divider);
  margin-bottom: 12px;
}

.ring-container {
  position: relative;
  width: 160px;
  height: 160px;
}

.ring-node {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 36px;
  height: 36px;
  margin-left: -18px;
  margin-top: -18px;
  transition: transform 0.2s ease, filter 0.2s ease;
}

.ring-node:hover {
  filter: drop-shadow(0 2px 4px rgba(0, 90, 156, 0.35));
}

.ring-node img {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
