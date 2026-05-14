<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { LIB_SPECS, SCENARIOS } from '../utils/benchScenarios';
import type { LibKey } from '../utils/benchScenarios';

const props = defineProps<{ id: string; iterations?: number; warmup?: number }>();

const scenario = computed(() => SCENARIOS.find(s => s.id === props.id));

const supportedLibs = computed(() => {
  if (!scenario.value) return [];
  return LIB_SPECS.filter(spec => spec.key in scenario.value!.factories);
});

interface Row {
  libKey: LibKey;
  label: string;
  opsPerSec: number | null;
  nsPerOp: number | null;
  note: string;
}

const rows        = ref<Row[]>([]);
const running     = ref(false);
const progress    = ref(0);
const error       = ref<string | null>(null);
const baseline    = ref<LibKey | null>(null);
const ua          = ref<string>('');
const currentLib  = ref<string>('');
const currentPhase = ref<string>('');

onMounted(() => {
  ua.value = typeof navigator !== 'undefined' ? navigator.userAgent : '';
});

const CHUNK = 2_000;

function nextTick(): Promise<void> {
  return new Promise<void>((r) => {
    setTimeout(r, 0);
  });
}

async function timeChunked(
  fn: () => void,
  warmup: number,
  iterations: number,
  onProgress: (frac: number) => void
): Promise<{ opsPerSec: number; nsPerOp: number }> {
  // Warmup (chunked so the UI can paint between bursts)
  for (let i = 0; i < warmup; i += CHUNK) {
    const end = Math.min(i + CHUNK, warmup);
    for (let j = i; j < end; j++) fn();
    onProgress(0);
    await nextTick();
  }

  const start = performance.now();
  for (let i = 0; i < iterations; i += CHUNK) {
    const end = Math.min(i + CHUNK, iterations);
    for (let j = i; j < end; j++) fn();
    onProgress(end / iterations);
    await nextTick();
  }
  const elapsedMs = performance.now() - start;

  return {
    opsPerSec: (iterations / elapsedMs) * 1000,
    nsPerOp: (elapsedMs * 1_000_000) / iterations,
  };
}

async function run(): Promise<void> {
  if (!scenario.value) return;
  running.value = true;
  error.value = null;
  rows.value = [];
  progress.value = 0;
  currentLib.value = '';
  currentPhase.value = '';

  const iterations = props.iterations ?? 20_000;
  const warmup     = props.warmup     ?? 200;

  const libs = supportedLibs.value;

  // json-tology first so the ratio column reads naturally
  const ordered = [
    ...libs.filter(l => l.key === 'json-tology'),
    ...libs.filter(l => l.key !== 'json-tology'),
  ];

  const totalSteps = ordered.length;

  for (let i = 0; i < totalSteps; i++) {
    const spec = ordered[i];
    const factory = scenario.value.factories[spec.key];
    if (!factory) continue;

    currentLib.value = spec.label;
    currentPhase.value = 'loading';
    progress.value = (i / totalSteps) * 100;
    await nextTick();

    try {
      const runFn = await factory();
      currentPhase.value = 'measuring';
      await nextTick();

      const { opsPerSec, nsPerOp } = await timeChunked(runFn, warmup, iterations, (frac) => {
        progress.value = ((i + frac) / totalSteps) * 100;
      });

      rows.value = [
        ...rows.value,
        { libKey: spec.key, label: spec.label, opsPerSec, nsPerOp, note: '' },
      ];
      if (spec.key === 'json-tology') baseline.value = 'json-tology';
    } catch (e) {
      const message = (e as Error).message || 'failed to load';

      rows.value = [
        ...rows.value,
        { libKey: spec.key, label: spec.label, opsPerSec: null, nsPerOp: null, note: truncate(message) },
      ];
    }
    progress.value = ((i + 1) / totalSteps) * 100;
  }

  currentLib.value = '';
  currentPhase.value = '';
  running.value = false;
}

function truncate(message: string): string {
  return message.length > 80 ? `${message.slice(0, 77)}…` : message;
}

function formatOps(n: number | null): string {
  if (n === null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return n.toFixed(0);
}

function formatNs(n: number | null): string {
  if (n === null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} ms`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(2)} μs`;
  return `${n.toFixed(1)} ns`;
}

function ratio(libKey: LibKey): string {
  const baselineRow = rows.value.find(r => r.libKey === 'json-tology');
  const target = rows.value.find(r => r.libKey === libKey);
  if (!baselineRow || !target || baselineRow.opsPerSec === null || target.opsPerSec === null) return '—';
  if (libKey === 'json-tology') return '—';
  const r = target.opsPerSec / baselineRow.opsPerSec;
  if (r >= 1) return `${r.toFixed(2)}× faster`;
  return `${(1 / r).toFixed(2)}× slower`;
}
</script>

<template>
  <div v-if="!scenario" class="bench-scenario bench-scenario--error">
    <strong>Unknown scenario:</strong> {{ id }}
  </div>
  <div v-else class="bench-scenario">
    <div class="bench-scenario__header">
      <button
        type="button"
        class="bench-scenario__run"
        :disabled="running"
        @click="run"
      >
        {{ running ? `Running… ${progress.toFixed(0)}%` : '▶ Run in browser' }}
      </button>
      <span class="bench-scenario__meta">
        {{ supportedLibs.length }} libs · {{ props.iterations ?? 20000 }} iterations
      </span>
    </div>

    <div v-if="running" class="bench-scenario__progress">
      <div class="bench-scenario__progress-bar" :style="{ width: `${progress}%` }" />
    </div>

    <div v-if="running && currentLib" class="bench-scenario__status">
      <span class="bench-scenario__status-label">{{ currentPhase }}:</span>
      <span class="bench-scenario__status-lib">{{ currentLib }}</span>
    </div>

    <div v-if="error" class="bench-scenario__error">{{ error }}</div>

    <table v-if="rows.length > 0" class="bench-scenario__table">
      <thead>
        <tr>
          <th>Library</th>
          <th class="bench-scenario__num">ops/s</th>
          <th class="bench-scenario__num">ns/op</th>
          <th>vs json-tology</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.libKey" :class="{ 'bench-scenario__row--baseline': row.libKey === 'json-tology' }">
          <td>{{ row.label }}</td>
          <td class="bench-scenario__num">{{ formatOps(row.opsPerSec) }}</td>
          <td class="bench-scenario__num">{{ formatNs(row.nsPerOp) }}</td>
          <td>
            <span v-if="row.note" class="bench-scenario__note">{{ row.note }}</span>
            <span v-else>{{ ratio(row.libKey) }}</span>
          </td>
        </tr>
      </tbody>
    </table>

    <details v-if="rows.length > 0 && ua" class="bench-scenario__ua">
      <summary>Environment</summary>
      <code>{{ ua }}</code>
    </details>
  </div>
</template>

<style scoped>
.bench-scenario {
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  padding: 0.75rem 1rem;
  margin: 0.5rem 0 1.25rem;
  background: var(--vp-c-bg-soft);
}

.bench-scenario--error {
  color: var(--vp-c-danger-1);
  border-color: var(--vp-c-danger-1);
}

.bench-scenario__header {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.bench-scenario__run {
  background: var(--vp-c-brand-1);
  color: white;
  border: none;
  padding: 0.35rem 0.9rem;
  border-radius: 4px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
}
.bench-scenario__run:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.bench-scenario__meta {
  color: var(--vp-c-text-2);
  font-size: 0.85rem;
}

.bench-scenario__progress {
  margin-top: 0.5rem;
  height: 6px;
  background: var(--vp-c-bg-soft);
  border-radius: 3px;
  overflow: hidden;
}

.bench-scenario__progress-bar {
  height: 100%;
  background: var(--vp-c-brand-1);
  transition: width 120ms ease-out;
}

.bench-scenario__status {
  margin-top: 0.4rem;
  font-size: 0.8rem;
  color: var(--vp-c-text-2);
}

.bench-scenario__status-label {
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-right: 0.4em;
  font-size: 0.7rem;
  color: var(--vp-c-text-3, var(--vp-c-text-2));
}

.bench-scenario__status-lib {
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.bench-scenario__error {
  margin-top: 0.5rem;
  color: var(--vp-c-danger-1);
  font-size: 0.9rem;
}

.bench-scenario__table {
  margin-top: 0.75rem;
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;
}
.bench-scenario__table th,
.bench-scenario__table td {
  padding: 0.35rem 0.55rem;
  border-bottom: 1px solid var(--vp-c-divider);
  text-align: left;
}
.bench-scenario__num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.bench-scenario__row--baseline {
  background: rgba(8, 113, 122, 0.06);
}
.bench-scenario__note {
  color: var(--vp-c-text-2);
  font-style: italic;
  font-size: 0.85em;
}

.bench-scenario__ua {
  margin-top: 0.5rem;
  font-size: 0.8rem;
  color: var(--vp-c-text-2);
}
.bench-scenario__ua summary {
  cursor: pointer;
  user-select: none;
}
.bench-scenario__ua code {
  font-size: inherit;
}
</style>
