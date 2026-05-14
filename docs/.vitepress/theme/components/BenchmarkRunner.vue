<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';

// ----------------------------------------------------------------------------
// In-browser benchmark runner. Loads every comparator library from its esm.sh
// CDN entry on demand — no bundler-time dependency, no docs-bundle bloat. The
// json-tology under test is the *published* esm.sh build, pinned to the live
// package version so numbers track what users actually get from npm.
// ----------------------------------------------------------------------------

const VERSION = '0.5.0';

type LibKey = 'json-tology' | 'zod' | 'valibot' | 'typebox' | 'ajv' | 'arktype' | 'runtypes' | 'io-ts';

interface LibSpec {
  readonly key: LibKey;
  readonly label: string;
  readonly url: string;
  readonly extraUrls?: readonly string[];
}

const LIBS: readonly LibSpec[] = [
  { key: 'json-tology', label: 'json-tology', url: `https://esm.sh/json-tology@${VERSION}` },
  { key: 'zod',         label: 'Zod',         url: 'https://esm.sh/zod@3' },
  { key: 'valibot',     label: 'Valibot',     url: 'https://esm.sh/valibot@1' },
  { key: 'typebox',     label: 'TypeBox',     url: 'https://esm.sh/@sinclair/typebox@0.34',
                        extraUrls: ['https://esm.sh/@sinclair/typebox@0.34/compiler'] },
  { key: 'ajv',         label: 'AJV',         url: 'https://esm.sh/ajv@8',
                        extraUrls: ['https://esm.sh/ajv-formats@3'] },
  { key: 'arktype',     label: 'ArkType',     url: 'https://esm.sh/arktype@2' },
  { key: 'runtypes',    label: 'Runtypes',    url: 'https://esm.sh/runtypes@7' },
  { key: 'io-ts',       label: 'io-ts',       url: 'https://esm.sh/io-ts@2',
                        extraUrls: ['https://esm.sh/fp-ts@2/Either'] },
];

const SAMPLE_CUSTOMER = Object.freeze({
  id:    '6c8b3c1e-0c4d-4d3e-a1f2-1234567890ab',
  email: 'alice@bookstore.example',
  name:  'Alice Chen',
});

interface RunRow {
  library: string;
  opsPerSec: number | null;
  nsPerOp: number | null;
  note: string;
}

const selected = ref<Set<LibKey>>(new Set(LIBS.map(l => l.key)));
const running  = ref(false);
const progress = ref(0);
const rows     = ref<RunRow[]>([]);
const error    = ref<string | null>(null);
const ua       = ref<string>('');

onMounted(() => {
  ua.value = typeof navigator !== 'undefined' ? navigator.userAgent : '';
});

const allSelected = computed(() => selected.value.size === LIBS.length);

function toggle(key: LibKey): void {
  const next = new Set(selected.value);
  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }
  selected.value = next;
}

function toggleAll(): void {
  selected.value = allSelected.value ? new Set() : new Set(LIBS.map(l => l.key));
}

async function loadLib<T = unknown>(spec: LibSpec): Promise<{ main: T; extras: unknown[] }> {
  const main = await import(/* @vite-ignore */ spec.url) as T;
  const extras = await Promise.all(
    (spec.extraUrls ?? []).map(u => import(/* @vite-ignore */ u))
  );
  return { main, extras };
}

// Validate-flat-customer scenario per library. Each returns a synchronous
// closure that performs one validation against SAMPLE_CUSTOMER.
async function buildScenario(spec: LibSpec): Promise<{ run: () => void; note: string }> {
  if (spec.key === 'json-tology') {
    const mod = (await loadLib(spec)).main as {
      JsonTology: { create: (opts: Record<string, unknown>) => { validate: (id: string, data: unknown) => unknown } };
    };
    const schema = {
      $id: 'urn:bench:Customer',
      type: 'object',
      properties: {
        id:    { type: 'string', format: 'uuid' },
        email: { type: 'string', format: 'email' },
        name:  { type: 'string' },
      },
      required: ['id', 'email', 'name'],
    } as const;
    const jt = mod.JsonTology.create({ baseIRI: 'urn:bench:', schemas: [schema] });
    return { run: () => { void jt.validate(schema.$id, SAMPLE_CUSTOMER); }, note: 'jt.validate' };
  }

  if (spec.key === 'zod') {
    const z = (await loadLib(spec)).main as typeof import('zod');
    const Customer = z.z.object({
      id: z.z.string().uuid(),
      email: z.z.string().email(),
      name: z.z.string(),
    });
    return { run: () => { void Customer.safeParse(SAMPLE_CUSTOMER); }, note: 'safeParse' };
  }

  if (spec.key === 'valibot') {
    const v = (await loadLib(spec)).main as Record<string, (...args: unknown[]) => unknown>;
    const Customer = (v.object as (s: unknown) => unknown)({
      id:    (v.pipe as (...a: unknown[]) => unknown)(v.string(), (v.uuid as (...a: unknown[]) => unknown)()),
      email: (v.pipe as (...a: unknown[]) => unknown)(v.string(), (v.email as (...a: unknown[]) => unknown)()),
      name:  v.string(),
    });
    const safeParse = v.safeParse as (s: unknown, d: unknown) => unknown;
    return { run: () => { void safeParse(Customer, SAMPLE_CUSTOMER); }, note: 'safeParse' };
  }

  if (spec.key === 'typebox') {
    const tb = (await loadLib(spec)).main as Record<string, unknown>;
    const Type = (tb.Type ?? tb.default) as { Object: (...a: unknown[]) => unknown; String: (a?: unknown) => unknown };
    const compiler = (await import(/* @vite-ignore */ spec.extraUrls![0])) as { TypeCompiler: { Compile: (s: unknown) => { Check: (d: unknown) => boolean } } };
    const Customer = Type.Object({
      id:    Type.String({ format: 'uuid' }),
      email: Type.String({ format: 'email' }),
      name:  Type.String(),
    });
    const C = compiler.TypeCompiler.Compile(Customer);
    return { run: () => { void C.Check(SAMPLE_CUSTOMER); }, note: 'TypeCompiler.Check' };
  }

  if (spec.key === 'ajv') {
    const ajvMod = (await loadLib(spec)).main as { default: new () => { addFormat: (n: string, r: RegExp) => void; compile: (s: unknown) => (d: unknown) => boolean } };
    const Ajv = (ajvMod.default ?? (ajvMod as unknown as new () => { addFormat: (n: string, r: RegExp) => void; compile: (s: unknown) => (d: unknown) => boolean }));
    const ajv = new Ajv();
    ajv.addFormat('uuid', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    ajv.addFormat('email', /^[^@]+@[^@]+$/);
    const validate = ajv.compile({
      type: 'object',
      properties: {
        id:    { type: 'string', format: 'uuid' },
        email: { type: 'string', format: 'email' },
        name:  { type: 'string' },
      },
      required: ['id', 'email', 'name'],
    });
    return { run: () => { void validate(SAMPLE_CUSTOMER); }, note: 'compiled validate' };
  }

  if (spec.key === 'arktype') {
    const ark = (await loadLib(spec)).main as { type: (s: unknown) => (d: unknown) => unknown };
    const Customer = ark.type({ id: 'string.uuid', email: 'string.email', name: 'string' });
    return { run: () => { void Customer(SAMPLE_CUSTOMER); }, note: 'invoke' };
  }

  if (spec.key === 'runtypes') {
    const rt = (await loadLib(spec)).main as Record<string, unknown>;
    const RtObject = (rt.Object ?? rt.Record) as (s: unknown) => { check: (d: unknown) => unknown };
    const Customer = RtObject({ id: rt.Uuid ?? rt.String, email: rt.Email ?? rt.String, name: rt.String });
    return { run: () => { void Customer.check(SAMPLE_CUSTOMER); }, note: 'check' };
  }

  if (spec.key === 'io-ts') {
    const t = (await loadLib(spec)).main as { type: (s: unknown) => { decode: (d: unknown) => unknown }; string: unknown };
    const Customer = t.type({ id: t.string, email: t.string, name: t.string });
    return { run: () => { void Customer.decode(SAMPLE_CUSTOMER); }, note: 'decode' };
  }

  throw new Error(`unknown library ${spec.key}`);
}

function timeIt(fn: () => void, warmup: number, iterations: number): { opsPerSec: number; nsPerOp: number } {
  for (let i = 0; i < warmup; i++) { fn(); }

  const start = performance.now();
  for (let i = 0; i < iterations; i++) { fn(); }
  const elapsedMs = performance.now() - start;

  const opsPerSec = (iterations / elapsedMs) * 1000;
  const nsPerOp = (elapsedMs * 1_000_000) / iterations;
  return { opsPerSec, nsPerOp };
}

async function run(): Promise<void> {
  running.value = true;
  error.value = null;
  rows.value = [];
  progress.value = 0;

  const toRun = LIBS.filter(l => selected.value.has(l.key));

  for (let i = 0; i < toRun.length; i++) {
    const spec = toRun[i];
    try {
      const { run: scenario, note } = await buildScenario(spec);
      // Yield to the event loop so the progress bar paints between libs.
      await new Promise(r => setTimeout(r, 0));
      const { opsPerSec, nsPerOp } = timeIt(scenario, 200, 50_000);
      rows.value = [...rows.value, { library: spec.label, opsPerSec, nsPerOp, note }];
    } catch (e) {
      rows.value = [...rows.value, {
        library: spec.label,
        opsPerSec: null,
        nsPerOp: null,
        note: (e as Error).message || 'failed to load',
      }];
    }
    progress.value = ((i + 1) / toRun.length) * 100;
  }

  running.value = false;
}

function formatOps(n: number | null): string {
  if (n === null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return n.toFixed(0);
}

function formatNs(n: number | null): string {
  if (n === null) return '—';
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)} μs`;
  return `${n.toFixed(1)} ns`;
}
</script>

<template>
  <div class="bench-runner">
    <div class="bench-runner__methodology">
      <strong>What this measures:</strong> a single hot-path validation against a flat 3-property object.
      Each library compiles or caches its validator before the timed loop. Warmup: 200 iterations.
      Measured: 50,000 iterations.
      <strong>Caveat:</strong> browser timing is coarser than Node — variance is high, the absolute
      numbers move with V8 / SpiderMonkey / JavaScriptCore differences, and other tabs steal CPU.
      Treat these as directional comparisons, not absolute benchmarks. The Node-side numbers on
      this page (under <em>Latest run</em>) are the canonical reference.
    </div>

    <div class="bench-runner__libs">
      <label class="bench-runner__lib bench-runner__lib--all">
        <input type="checkbox" :checked="allSelected" @change="toggleAll" />
        <span>{{ allSelected ? 'Deselect all' : 'Select all' }}</span>
      </label>
      <label v-for="lib in LIBS" :key="lib.key" class="bench-runner__lib">
        <input
          type="checkbox"
          :checked="selected.has(lib.key)"
          @change="toggle(lib.key)"
        />
        <span>{{ lib.label }}</span>
      </label>
    </div>

    <button
      type="button"
      class="bench-runner__run"
      :disabled="running || selected.size === 0"
      @click="run"
    >
      {{ running ? `Running… ${progress.toFixed(0)}%` : 'Run benchmark' }}
    </button>

    <div v-if="running" class="bench-runner__progress">
      <div class="bench-runner__progress-bar" :style="{ width: `${progress}%` }" />
    </div>

    <div v-if="error" class="bench-runner__error">{{ error }}</div>

    <table v-if="rows.length > 0" class="bench-runner__table">
      <thead>
        <tr>
          <th>Library</th>
          <th class="bench-runner__num">ops/s</th>
          <th class="bench-runner__num">ns/op</th>
          <th>Method</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.library">
          <td>{{ row.library }}</td>
          <td class="bench-runner__num">{{ formatOps(row.opsPerSec) }}</td>
          <td class="bench-runner__num">{{ formatNs(row.nsPerOp) }}</td>
          <td>{{ row.note }}</td>
        </tr>
      </tbody>
    </table>

    <div v-if="rows.length > 0 && ua" class="bench-runner__ua">
      Ran in: <code>{{ ua }}</code>
    </div>
  </div>
</template>

<style scoped>
.bench-runner {
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  padding: 1rem;
  margin: 1rem 0;
}

.bench-runner__methodology {
  font-size: 0.875rem;
  background: var(--vp-c-bg-soft);
  padding: 0.75rem 1rem;
  border-radius: 6px;
  border-left: 3px solid var(--vp-c-brand-1);
  margin-bottom: 1rem;
}

.bench-runner__libs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  margin-bottom: 1rem;
}

.bench-runner__lib {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
  user-select: none;
  font-size: 0.95rem;
}

.bench-runner__lib--all {
  font-weight: 600;
  padding-right: 1rem;
  border-right: 1px solid var(--vp-c-divider);
}

.bench-runner__run {
  background: var(--vp-c-brand-1);
  color: white;
  border: none;
  padding: 0.5rem 1.25rem;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
}
.bench-runner__run:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.bench-runner__progress {
  height: 6px;
  background: var(--vp-c-bg-soft);
  border-radius: 3px;
  margin-top: 1rem;
  overflow: hidden;
}
.bench-runner__progress-bar {
  height: 100%;
  background: var(--vp-c-brand-1);
  transition: width 0.2s ease;
}

.bench-runner__error {
  margin-top: 1rem;
  color: var(--vp-c-danger-1);
  font-size: 0.9rem;
}

.bench-runner__table {
  margin-top: 1rem;
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}
.bench-runner__table th,
.bench-runner__table td {
  padding: 0.4rem 0.6rem;
  border-bottom: 1px solid var(--vp-c-divider);
  text-align: left;
}
.bench-runner__num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.bench-runner__ua {
  margin-top: 0.75rem;
  font-size: 0.8rem;
  color: var(--vp-c-text-2);
}
.bench-runner__ua code {
  font-size: inherit;
}
</style>
