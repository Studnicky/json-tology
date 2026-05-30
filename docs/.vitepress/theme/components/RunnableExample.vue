<script setup lang="ts">
import { computed, ref } from 'vue';
import { transform } from 'sucrase';
import { PLAYGROUND_EXAMPLES } from '../utils/playgroundExamples';

// A genuinely runnable code example. The editor is prefilled with the verbatim,
// gate-verified source of a real .ts example; pressing Run transpiles the
// (possibly edited) TypeScript in the browser via sucrase, resolves its imports
// against the statically-bundled module scope, executes it, and shows the
// captured console output. Nothing is faked — the same code, run for real.

const props = defineProps<{ id: string }>();

interface OutputLineType {
  readonly stream: 'log' | 'info' | 'warn' | 'error';
  readonly text: string;
}

const example = computed(() => PLAYGROUND_EXAMPLES[props.id]);

const code = ref(example.value?.source ?? '');
const output = ref<OutputLineType[]>([]);
const errorText = ref<string | null>(null);
const running = ref(false);
const hasRun = ref(false);

const edited = computed(() => code.value !== (example.value?.source ?? ''));

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

async function run(): Promise<void> {
  const target = example.value;

  if (!target) {
    errorText.value = `Unknown example: ${props.id}`;

    return;
  }

  running.value = true;
  hasRun.value = true;
  errorText.value = null;
  output.value = [];

  const sink: OutputLineType[] = [];

  try {
    const { code: js } = transform(code.value, {
      filePath: 'example.ts',
      transforms: ['typescript', 'imports']
    });

    const requireShim = (specifier: string): unknown => {
      const resolved = target.modules[specifier];

      if (resolved === undefined) {
        throw new Error(`Cannot resolve import '${specifier}' in this playground`);
      }

      return resolved;
    };

    const moduleObject = { exports: {} as Record<string, unknown> };
    // eslint-disable-next-line no-new-func -- the playground's purpose is to execute user-edited example source; sucrase output is CJS evaluated with an injected require shim and captured console.
    const factory = new Function('require', 'exports', 'module', 'console', `return (async () => {\n${js}\n})();`) as (
      require: (specifier: string) => unknown,
      exports: Record<string, unknown>,
      module: { exports: Record<string, unknown> },
      console: Console
    ) => Promise<void>;

    await factory(requireShim, moduleObject.exports, moduleObject, makeConsole(sink));
    output.value = [...sink];
  } catch (caught) {
    output.value = [...sink];
    errorText.value = format(caught);
  } finally {
    running.value = false;
  }
}

function reset(): void {
  code.value = example.value?.source ?? '';
  output.value = [];
  errorText.value = null;
  hasRun.value = false;
}

function onTab(event: KeyboardEvent): void {
  event.preventDefault();
  const area = event.target as HTMLTextAreaElement;
  const { selectionStart, selectionEnd } = area;

  code.value = `${code.value.slice(0, selectionStart)}  ${code.value.slice(selectionEnd)}`;
  void Promise.resolve().then(() => {
    area.selectionStart = selectionStart + 2;
    area.selectionEnd = selectionStart + 2;
  });
}
</script>

<template>
  <div v-if="!example" class="runnable runnable--error">
    <strong>Unknown example:</strong> {{ id }}
  </div>
  <div v-else class="runnable">
    <textarea
      v-model="code"
      class="runnable__editor"
      spellcheck="false"
      autocapitalize="off"
      autocomplete="off"
      autocorrect="off"
      :rows="Math.min(code.split('\n').length + 1, 40)"
      @keydown.tab="onTab"
    />

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
}
.runnable__run:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.runnable__run {
  white-space: nowrap;
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

.runnable__editor {
  display: block;
  width: 100%;
  box-sizing: border-box;
  border: none;
  resize: vertical;
  padding: 0.85rem 1rem;
  background: var(--vp-code-block-bg, var(--vp-c-bg-alt));
  color: var(--vp-c-text-1);
  font-family: var(--vp-font-family-mono);
  font-size: 0.82rem;
  line-height: 1.6;
  tab-size: 2;
  outline: none;
}
.runnable__editor:focus {
  box-shadow: inset 0 0 0 2px var(--vp-c-brand-soft);
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

.runnable__placeholder {
  color: var(--vp-c-text-3, var(--vp-c-text-2));
  font-style: italic;
  font-size: 0.82rem;
}

.runnable__output-label {
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: 0.68rem;
  color: var(--vp-c-text-3, var(--vp-c-text-2));
  margin-bottom: 0.4rem;
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
