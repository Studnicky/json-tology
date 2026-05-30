/// <reference types="vite/client" />

// `vite/client` declares the virtual-import shims the playground relies on
// (`*?raw`, `*.css`, …). Only `*.vue` SFC modules need an explicit shim for a
// plain tsserver/tsc project (VitePress wires Vue SFC types at build time).

declare module '*.vue' {
  import type { DefineComponent } from 'vue';

  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
  export default component;
}
