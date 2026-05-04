<template>
  <div class="webvowl-frame-container">
    <iframe
      v-if="iframeSrc"
      :src="iframeSrc"
      title="WebVOWL ontology viewer"
      class="webvowl-iframe"
      loading="lazy"
    ></iframe>
    <div v-else class="webvowl-error">
      WebVOWL viewer unavailable in this environment.
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

// The published JSON-LD URL of the bookstore TBox.
// In dev, webvowl cannot reach localhost — viewer will fail to fetch.
// In prod (GitHub Pages), this resolves correctly.
const TBOX_URL = 'https://studnicky.github.io/json-tology/data/bookstore-tbox.jsonld';
const WEBVOWL_BASE = 'https://service.webvowl.visualdataweb.org/webvowl/index.html';

const iframeSrc = computed(() => `${WEBVOWL_BASE}#iri=${encodeURIComponent(TBOX_URL)}`);
</script>

<style scoped>
.webvowl-frame-container {
  position: relative;
  width: 100%;
  height: 720px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  overflow: hidden;
}
.webvowl-iframe {
  width: 100%;
  height: 100%;
  border: 0;
}
.webvowl-error {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 720px;
  color: var(--vp-c-text-2);
}
</style>
