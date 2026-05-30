<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, HighlightStyle, indentOnInput, syntaxHighlighting } from '@codemirror/language';
import { javascript } from '@codemirror/lang-javascript';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { tags } from '@lezer/highlight';

import { getExampleSource, runExample } from '../utils/playgroundRuntime';

// A genuinely runnable code example. The CodeMirror editor is prefilled with the
// verbatim, gate-verified source of a real .ts example (resolved from its repo
// path, the single source of truth). Pressing Execute transpiles the edited
// TypeScript in the browser, resolves its imports against the real library and
// the example tree, runs it, and fills the output panel with captured console
// output. Nothing is faked: the same code, executed for real.

const props = defineProps<{ src: string }>();

interface OutputLineType {
  readonly stream: 'log' | 'info' | 'warn' | 'error';
  readonly text: string;
}

const original = computed(() => getExampleSource(props.src) ?? '');
const code = ref(original.value);
const output = ref<OutputLineType[]>([]);
const errorText = ref<string | null>(null);
const running = ref(false);
const hasRun = ref(false);
const edited = ref(false);
const editorHost = ref<HTMLElement | null>(null);
const root = ref<HTMLElement | null>(null);
const cmReady = ref(false);

let view: EditorView | undefined;
let observer: IntersectionObserver | undefined;

// Mid-tone token colors chosen to read on both the light and dark VitePress
// backgrounds, so no theme observer is needed.
const highlightStyle = HighlightStyle.define([
  { color: '#8a64d6', tag: tags.keyword },
  { color: '#1a8055', tag: [tags.string, tags.special(tags.string)] },
  { color: '#7d7d7d', fontStyle: 'italic', tag: [tags.comment, tags.lineComment, tags.blockComment] },
  { color: '#b5811f', tag: [tags.number, tags.bool, tags.null] },
  { color: '#2b78c4', tag: [tags.function(tags.variableName), tags.function(tags.propertyName)] },
  { color: '#b5530a', tag: [tags.typeName, tags.className, tags.namespace] },
  { color: '#a52d6e', tag: [tags.propertyName, tags.attributeName] }
]);

const baseTheme = EditorView.theme({
  '&': { backgroundColor: 'var(--vp-code-block-bg, var(--vp-c-bg-alt))', color: 'var(--vp-c-text-1)', fontSize: '0.82rem' },
  '&.cm-focused': { outline: 'none' },
  '.cm-activeLine': { backgroundColor: 'transparent' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent' },
  '.cm-content': { fontFamily: 'var(--vp-font-family-mono)' },
  '.cm-cursor': { borderLeftColor: 'var(--vp-c-brand-1)' },
  '.cm-gutters': { backgroundColor: 'transparent', border: 'none', color: 'var(--vp-c-text-3, var(--vp-c-text-2))' },
  '.cm-scroller': { fontFamily: 'var(--vp-font-family-mono)', lineHeight: '1.6', maxHeight: '32rem' }
});

function format(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value instanceof Error) {
    return value.stack ?? `${value.name}: ${value.message}`;
  }
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

function makeConsole(sink: OutputLineType[]): Console {
  const emit = (stream: OutputLineType['stream']) => {
    return (...args: unknown[]): void => {
      sink.push({ stream, text: args.map(format).join(' ') });
    };
  };

  return {
    ...console,
    debug: emit('log'),
    error: emit('error'),
    info: emit('info'),
    log: emit('log'),
    warn: emit('warn')
  };
}

function mountEditor(): void {
  if (cmReady.value || !editorHost.value) {
    return;
  }
  cmReady.value = true;

  view = new EditorView({
    parent: editorHost.value,
    state: EditorState.create({
      doc: original.value,
      extensions: [
        lineNumbers(),
        history(),
        bracketMatching(),
        indentOnInput(),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        javascript({ typescript: true }),
        syntaxHighlighting(highlightStyle),
        baseTheme,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            code.value = update.state.doc.toString();
            edited.value = code.value !== original.value;
          }
        })
      ]
    })
  });
}

// Lazy-mount: only instantiate CodeMirror once the example scrolls near the
// viewport, so a page with dozens of examples does not build dozens of editors
// up front. Until then the source renders as a static <pre> (also SSR-visible).
onMounted(() => {
  if (!root.value || typeof IntersectionObserver === 'undefined') {
    mountEditor();

    return;
  }

  observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      mountEditor();
      observer?.disconnect();
    }
  }, { rootMargin: '300px' });

  observer.observe(root.value);
});

onBeforeUnmount(() => {
  observer?.disconnect();
  view?.destroy();
});

async function run(): Promise<void> {
  running.value = true;
  hasRun.value = true;
  errorText.value = null;
  output.value = [];

  const sink: OutputLineType[] = [];

  try {
    await runExample(code.value, props.src, makeConsole(sink));
    output.value = [...sink];
  } catch (caught) {
    output.value = [...sink];
    errorText.value = format(caught);
  } finally {
    running.value = false;
  }
}

function reset(): void {
  view?.dispatch({ changes: { from: 0, insert: original.value, to: view.state.doc.length } });
  output.value = [];
  errorText.value = null;
  hasRun.value = false;
  edited.value = false;
}
</script>

<template>
  <div v-if="!original" class="runnable runnable--error">
    <strong>Unknown example:</strong> {{ src }}
  </div>
  <div v-else ref="root" class="runnable">
    <div ref="editorHost" class="runnable__editor">
      <pre v-if="!cmReady" class="runnable__pre">{{ original }}</pre>
    </div>

    <div class="runnable__exec">
      <div class="runnable__controls">
        <button type="button" class="runnable__run" :disabled="running" @click="run">
          {{ running ? 'Running…' : '▶ Execute' }}
        </button>
        <button v-if="edited" type="button" class="runnable__reset" @click="reset">
          Reset
        </button>
      </div>

      <div class="runnable__output" :class="{ 'runnable__output--error': errorText }">
        <div class="runnable__output-label">Output</div>
        <span v-if="!hasRun" class="runnable__placeholder">Press Execute to run this example against the real library.</span>
        <span v-else-if="output.length === 0 && !errorText" class="runnable__placeholder">(no console output)</span>
        <template v-else>
          <pre
            v-for="(line, index) in output"
            :key="index"
            class="runnable__line"
            :class="`runnable__line--${line.stream}`"
          >{{ line.text }}</pre>
          <pre v-if="errorText" class="runnable__line runnable__line--error">{{ errorText }}</pre>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.runnable {
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  margin: 1rem 0 1.5rem;
  overflow: hidden;
  background: var(--vp-c-bg-soft);
}

.runnable--error {
  color: var(--vp-c-danger-1);
  border-color: var(--vp-c-danger-1);
  padding: 0.75rem 1rem;
}

.runnable__editor {
  background: var(--vp-code-block-bg, var(--vp-c-bg-alt));
}
.runnable__editor :deep(.cm-editor) {
  padding: 0.35rem 0.25rem;
}

.runnable__pre {
  margin: 0;
  padding: 0.85rem 1rem;
  max-height: 32rem;
  overflow: auto;
  font-family: var(--vp-font-family-mono);
  font-size: 0.82rem;
  line-height: 1.6;
  color: var(--vp-c-text-1);
  white-space: pre;
}

.runnable__exec {
  display: flex;
  align-items: stretch;
  border-top: 1px solid var(--vp-c-divider);
}

.runnable__controls {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.6rem 0.7rem;
  border-right: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  flex: 0 0 auto;
}

.runnable__run {
  background: var(--vp-c-brand-1);
  color: #fff;
  border: none;
  padding: 0.3rem 0.85rem;
  border-radius: 4px;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  white-space: nowrap;
}
.runnable__run:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.runnable__reset {
  background: transparent;
  color: var(--vp-c-text-2);
  border: 1px solid var(--vp-c-divider);
  padding: 0.3rem 0.7rem;
  border-radius: 4px;
  font-size: 0.8rem;
  cursor: pointer;
}

.runnable__output {
  flex: 1 1 auto;
  min-width: 0;
  padding: 0.6rem 1rem;
  background: var(--vp-c-bg);
  overflow-x: auto;
}
.runnable__output--error {
  background: var(--vp-c-danger-soft);
}

.runnable__output-label {
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: 0.68rem;
  color: var(--vp-c-text-3, var(--vp-c-text-2));
  margin-bottom: 0.4rem;
}

.runnable__placeholder {
  color: var(--vp-c-text-3, var(--vp-c-text-2));
  font-style: italic;
  font-size: 0.82rem;
}

.runnable__line {
  margin: 0;
  padding: 0.05rem 0;
  font-family: var(--vp-font-family-mono);
  font-size: 0.82rem;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}
.runnable__line--warn {
  color: var(--vp-c-warning-1);
}
.runnable__line--error {
  color: var(--vp-c-danger-1);
}

@media (max-width: 640px) {
  .runnable__exec {
    flex-direction: column;
  }
  .runnable__controls {
    flex-direction: row;
    border-right: none;
    border-bottom: 1px solid var(--vp-c-divider);
  }
}
</style>
