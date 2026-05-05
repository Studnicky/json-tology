<script setup lang="ts">
// Reads __JT_VERSION__ injected at build time by vite.define in
// docs/.vitepress/config.ts (sourced from package.json).
declare const __JT_VERSION__: string;
const version = __JT_VERSION__;
</script>

<template>
  <a class="version-badge" :href="`https://github.com/Studnicky/json-tology/releases/tag/v${version}`" target="_blank" rel="noopener">
    v{{ version }}
  </a>
</template>

<style scoped>
.version-badge {
  display: inline-block;
  margin-left: 12px;
  padding: 2px 8px;
  font-size: 12px;
  font-weight: 600;
  font-family: var(--vp-font-family-mono);
  color: var(--vp-c-brand-1);
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  text-decoration: none;
  line-height: 1.4;
  transition: background 0.15s, border-color 0.15s;
}

.version-badge:hover {
  background: var(--vp-c-bg-mute);
  border-color: var(--vp-c-brand-1);
}
</style>
