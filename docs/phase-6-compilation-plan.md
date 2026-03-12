# Phase 6: Compiled Validators — Implementation Plan

## Problem Statement

GraphEngine is a pure interpreter. Every `validate()` / `parse()` call walks the schema graph, resolves semantics, branches through 11 phases in a 570-line `visit()` method, and dispatches per-type — all at runtime. This makes us 50-100x slower than AJV and TypeBox on validation.

### Benchmark Baseline (Pre-compilation)

| Test | json-tology | TypeBox | AJV | Zod |
|------|-------------|---------|-----|-----|
| simple valid | 314K ops/s | 30.8M ops/s | 19.9M ops/s | 4.4M ops/s |
| nested valid | 62K ops/s | 7.0M ops/s | 3.5M ops/s | 1.3M ops/s |
| simple invalid | 310K ops/s | 855K ops/s | 16.0M ops/s | 98K ops/s |

### After Phase 6.1-6.5 (Closure Compilation + Format Regex Elimination)

| Test | json-tology | vs TypeBox | vs AJV | vs Zod | Improvement |
|------|-------------|-----------|--------|--------|-------------|
| simple valid | 8.3M ops/s | 3.9x slower | 2.5x slower | 1.9x faster | **26x** |
| nested valid | 2.1M ops/s | 3.0x slower | 1.1x faster | 2.1x faster | **34x** |
| simple invalid | 817K ops/s | comparable | 19x slower | 8.3x faster | **2.6x** |
| clean simple | 870K ops/s | comparable | — | — | **3.7x** |
| clean nested | 246K ops/s | 1.3x slower | — | — | **4.8x** |
| parse defaults | 368K ops/s | 2.5x slower | — | — | **2.0x** |

### Root Causes

1. **No compilation**: Schema structure is re-interpreted on every call. Plans are cached but extraction overhead remains.
2. **Megamorphic dispatch**: `visit()` handles all schema types in one method — V8 can't specialize.
3. **Defensive cloning**: `anyOf`/`oneOf`/`not`/`contains` all `structuredClone()` before branching.
4. **O(n²) algorithms**: `uniqueItems` uses nested `deepEqual()`. Enum checks iterate linearly.
5. **Per-key regex testing**: Pattern properties test every regex against every key on every call.
6. **Regex for known formats**: All format validators (email, uuid, date, etc.) use `RegExp.test()` even though these are fixed patterns we control. V8's regex engine has ~200ns overhead per `.test()` call — function dispatch, state machine init, backtracking allocator — that imperative `charCodeAt()` checks avoid entirely.

### Comparison Systems

| System | Strategy | Generation Method |
|--------|----------|-------------------|
| **AJV** | String codegen → `new Function()` | Generates JS source strings, eval at compile time |
| **TypeBox TypeCompiler** | Closure tree | Recursive closure emission, one per schema node |
| **Zod** | Interpreter | Method chain per-type, no compilation (explains why it's also slow) |

## Architecture Decisions

### Closure Compilation

**Closure compilation (Tier 2)** — emit nested closures at registration time, one per schema node. Each closure is a straight-line sequence of checks with no branching or plan lookup at validation time.

Rationale:
- TypeBox-class performance (20-50x improvement expected)
- No `new Function()` — works in CSP-restricted environments, easy to debug
- Closures capture schema constants at compile time — zero lookup cost
- Composable — `$ref` becomes a function call, `allOf` becomes sequential calls
- Incremental — we can compile hot paths first and fall back to interpreter for edge cases

### Regex Elimination

Regex is used pervasively for validation tasks that have faster alternatives. V8's regex engine has significant overhead per `.test()` call — function call dispatch, regex state machine initialization, backtracking allocator — even for trivial patterns. For hot-path validation that runs millions of times per second, this matters.

**Current regex usage and replacements:**

| Usage | Current | Replacement |
|-------|---------|-------------|
| **email format** | `/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(v)` | `indexOf('@')` + `indexOf('.')` + char checks |
| **uuid format** | `/^[\da-f]{8}-...$/iu.test(v)` | Length check + char-at checks for `-` positions + hex char loop |
| **date format** | `/^\d{4}-\d{2}-\d{2}$/u.test(v)` | Length === 10 + char code checks for digits/dashes at positions |
| **time format** | `/^(?:[01]\d\|2[0-3]):...$/u.test(v)` | Char code range checks at known positions |
| **duration format** | `/^P(?=\d\|T\d)...$/u.test(v)` | State machine parser (duration has branching structure) |
| **json-pointer** | `/^(?:\/(?:[^~/]\|~0\|~1)*)*$/u.test(v)` | `startsWith('/')` + scan for invalid escape sequences |
| **hostname** | `/^[a-z\d](?:...)$/iu.test(v)` | Char code range loop |
| **base64 (byte)** | `/^(?:[A-Za-z\d+/]{4})*...$/u.test(v)` | Length % 4 check + char code range loop + padding check |
| **hex (binary)** | `/^[\da-f]+$/iu.test(v)` | Char code range loop |
| **`pattern` keyword** | `new RegExp(pattern).test(v)` | **Keep** — user-supplied patterns must use regex |
| **`patternProperties`** | `regex.test(key)` for each key | **Keep** — user-supplied patterns must use regex |

**Principle**: Replace regex with imperative char-code checks for all **format validators** (known patterns we control). Keep regex only for **user-supplied patterns** (`pattern` keyword, `patternProperties`) where we have no choice.

**Implementation**: Each format validator becomes a pure function using `charCodeAt()` loops. These compile down to tight integer comparisons that V8 can inline and optimize. A typical email check goes from ~200ns (regex) to ~10ns (imperative).

The format replacements are implemented in Phase 6.2 alongside primitive compilation, since format validation is part of the scalar validation path.

## Phase Map

```
Phase 6.1: Compiler Infrastructure         [Foundation]
Phase 6.2: Primitive & Scalar Compilation   [First wins]
Phase 6.3: Object Compilation              [Biggest impact]
Phase 6.4: Composition & Ref Compilation   [Full coverage]
Phase 6.5: Array & Advanced Compilation    [Complete]
Phase 6.6: Execution Mode Optimization     [Polish]
```

---

## Phase 6.1 — Compiler Infrastructure

### Goal
Establish the compilation framework, compiled validator type, and integration with SchemaRegistry. No actual compilation yet — just the plumbing so subsequent phases can emit closures incrementally.

### Deliverables

1. **`CompiledValidator` interface**

```typescript
interface CompiledValidator {
  check(data: unknown): boolean;                    // fast path — boolean only
  validate(data: unknown): ValidationResult;        // full path — errors + value
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  value: unknown;
}
```

2. **`SchemaCompiler` class** (`src/schema/SchemaCompiler.ts`)
   - `compile(graph: SchemaGraph, rootNode: SchemaGraphNode, options): CompiledValidator`
   - Accepts a `lookupCompiled: (schemaId: string) => CompiledValidator | undefined` for `$ref` resolution
   - Initially returns a wrapper that delegates to `GraphEngine.visit()` (passthrough)

3. **Registry integration**
   - `SchemaRegistry` gains a `compiledMap: WeakMap<schema, CompiledValidator>`
   - `getEngine()` → `getValidator()` path compiles lazily on first access
   - `validate()` / `parse()` / `cast()` / `clean()` / `convert()` use compiled validators

4. **Benchmark verification**
   - Passthrough compilation should show no regression (same interpreter path)
   - Establishes the measurement framework for subsequent phases

### Files Changed

| File | Action |
|------|--------|
| `src/schema/SchemaCompiler.ts` | **New** — compiler framework |
| `src/schema/SchemaRegistry.ts` | Wire compiled validators into all execution paths |
| `bench/validate.bench.ts` | Add compiled vs interpreted comparison |

---

## Phase 6.2 — Primitive & Scalar Compilation

### Goal
Compile type checks, const, enum, format, and numeric/string constraints into closures. These are the leaf nodes — no recursion needed yet.

### Deliverables

1. **Type check closures**
   - `compileTypeCheck(types: string[]): (v: unknown) => boolean`
   - Single type → `typeof v === 'string'` (inline)
   - Multiple types → pre-built check function
   - Nullable → `v === null || innerCheck(v)`

2. **Const/Enum compilation**
   - Const → `v === constValue` (identity check for primitives)
   - Enum → `Set` for scalar values, `deepEqual` fallback for objects
   - Expected: enum validation goes from O(n) linear scan to O(1) Set lookup

3. **String constraint closures**
   - `pattern` → pre-compiled `RegExp` captured in closure (user-supplied patterns — regex unavoidable)
   - `minLength` / `maxLength` → `v.length >= min && v.length <= max`
   - `format` → imperative format validator captured once (see below)

4. **Numeric constraint closures**
   - `minimum` / `maximum` / `exclusiveMinimum` / `exclusiveMaximum` → direct comparisons
   - `multipleOf` → `v % multipleOf === 0`

5. **Boolean composition**
   - Combine checks: `const check = (v) => typeCheck(v) && rangeCheck(v) && patternCheck(v)`

6. **Format validator rewrite — regex elimination**

   Replace all regex-based format validators in `FormatRegistry.ts` with imperative `charCodeAt()` checks. These are known patterns we control — not user-supplied.

   Implementation pattern:
   ```typescript
   // Before (regex)
   'email': (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(v)

   // After (imperative)
   'email': (v) => {
     const at = v.indexOf('@');
     if (at < 1 || at === v.length - 1) return false;
     const dot = v.indexOf('.', at + 2);
     if (dot < 0 || dot === v.length - 1) return false;
     for (let i = 0; i < v.length; i++) {
       if (v.charCodeAt(i) <= 0x20) return false; // no whitespace
     }
     return true;
   }
   ```

   Formats to rewrite:
   - `email` / `idn-email` → `indexOf` + char checks
   - `uuid` → length + dash positions + hex char loop
   - `date` → length 10 + digit/dash positions
   - `date-time` → `date` check + `T` + time check + optional timezone
   - `time` → digit range checks at known positions
   - `duration` → state machine (small, finite states)
   - `json-pointer` → `startsWith('/')` + escape validation
   - `hostname` / `idn-hostname` → char code range loop
   - `byte` (base64) → length % 4 + char code range + padding
   - `binary` (hex) → char code range loop
   - `uri` / `uri-reference` / `iri` / `iri-reference` / `uri-template` → scheme + structure checks
   - `ipv4` → dot-split + parseInt range
   - `ipv6` → colon-split + hex group validation

   Keep regex only for:
   - `pattern` keyword (user-supplied)
   - `patternProperties` keys (user-supplied)
   - `regex` format validator (validates that a string is a valid regex — must use `new RegExp()`)

### Expected Impact
- 5-10x improvement on simple scalar validation
- Type dispatch elimination for leaf nodes
- Format validation: ~200ns/call (regex) → ~10-30ns/call (imperative) — 7-20x on format-heavy schemas

### Files Changed

| File | Action |
|------|--------|
| `src/schema/SchemaCompiler.ts` | Add primitive compilation methods |
| `src/schema/FormatRegistry.ts` | Rewrite format validators to imperative char-code checks |
| `test/unit/compiler.test.ts` | **New** — compiler unit tests |
| `test/unit/formatRegistry.test.ts` | Verify format validators still pass with imperative implementations |

---

## Phase 6.3 — Object Compilation

### Goal
Compile object validation into a single closure that checks all properties in sequence. This is where the biggest performance gains are — object validation is the hot path for real-world schemas.

### Deliverables

1. **Property dispatch table**
   - Pre-compute `Map<propName, compiledPropValidator>` at compile time
   - At validation time: iterate object keys once, dispatch to pre-compiled validator
   - Eliminates: plan lookup, semantics resolution, property-by-property `visit()` calls

2. **Required check compilation**
   - `requiredKeys: string[]` captured in closure
   - Single loop: `for (const key of requiredKeys) if (!(key in obj)) ...`

3. **Additional properties compilation**
   - `additionalProperties: false` → pre-compute allowed key Set, check in property loop
   - `additionalProperties: schema` → compile sub-validator, apply to unknown keys

4. **Pattern properties compilation**
   - Pre-compile regex patterns at compile time
   - Build `Array<[RegExp, compiledValidator]>` — test each pattern only against unmatched keys

5. **Inline property validators**
   - For each declared property, compile a closure that validates the property value
   - At validation time: `propValidators.name(obj.name)` — zero dispatch overhead

### Expected Impact
- 20-50x improvement on object validation
- This phase alone should close most of the gap with TypeBox

### Files Changed

| File | Action |
|------|--------|
| `src/schema/SchemaCompiler.ts` | Add object compilation |
| `test/unit/compiler.test.ts` | Object compilation tests |

---

## Phase 6.4 — Composition & Ref Compilation

### Goal
Compile `allOf`, `anyOf`, `oneOf`, `not`, `if/then/else`, and `$ref` into closure chains.

### Deliverables

1. **`$ref` compilation**
   - At compile time: resolve ref → get compiled validator → capture in closure
   - At validation time: `refValidator.check(data)` — one function call
   - Cross-schema refs use `lookupCompiled` callback from registry

2. **`allOf` compilation**
   - Compile each branch → `const validators = [v1, v2, v3]`
   - Check: `validators.every(v => v.check(data))`

3. **`anyOf` / `oneOf` compilation**
   - `anyOf`: `validators.some(v => v.check(data))`
   - `oneOf`: count matches, exactly one must pass
   - **Clone elimination**: for `check()` mode (boolean only), skip cloning entirely
   - For `validate()` mode with mutations (defaults/coerce), clone only when needed

4. **`not` compilation**
   - `!innerValidator.check(data)` — trivial

5. **`if/then/else` compilation**
   - Compile condition, then, else as separate validators
   - `if (conditionValidator.check(data)) thenValidator.validate(data) else elseValidator.validate(data)`

6. **Discriminator optimization**
   - When `oneOf` has a discriminator property, compile to a switch/map lookup
   - `const branch = discriminatorMap[data[discriminatorProp]]`
   - Eliminates trying all branches — O(1) instead of O(n)

### Expected Impact
- 2-5x improvement on composition-heavy schemas
- Eliminates `structuredClone()` overhead for most `anyOf`/`oneOf` cases
- Discriminator: O(1) vs O(n) for tagged unions

### Files Changed

| File | Action |
|------|--------|
| `src/schema/SchemaCompiler.ts` | Composition and ref compilation |
| `test/unit/compiler.test.ts` | Composition tests |

---

## Phase 6.5 — Array & Advanced Compilation

### Goal
Compile array validation, `unevaluatedProperties`/`unevaluatedItems`, `dependentRequired`, `dependentSchemas`, `contains`, `prefixItems`, and `propertyNames`.

### Deliverables

1. **Array items compilation**
   - `items: schema` → compile item validator, loop with `for (let i = 0; i < arr.length; i++)`
   - `prefixItems` → compile each positional validator, dispatch by index
   - `contains` → compile contains validator, `arr.some(item => containsValidator.check(item))`

2. **Array constraint compilation**
   - `minItems` / `maxItems` → `arr.length` checks
   - `uniqueItems` → `Set`-based dedup for primitives, `deepEqual` fallback for objects (fix O(n²))

3. **`unevaluatedProperties` / `unevaluatedItems` compilation**
   - Track evaluated properties/items at compile time where possible
   - For dynamic cases (composition), use a `Set<string>` built during validation

4. **`dependentRequired` / `dependentSchemas` compilation**
   - Pre-compile dependency map
   - Check: `if (prop in obj) validateDependencies(obj)`

5. **`propertyNames` compilation**
   - Compile property name validator
   - Apply to all keys in property loop

### Expected Impact
- Array-heavy schemas see 10-20x improvement
- `uniqueItems` fix eliminates O(n²) pathology

### Files Changed

| File | Action |
|------|--------|
| `src/schema/SchemaCompiler.ts` | Array and advanced keyword compilation |
| `test/unit/compiler.test.ts` | Array and advanced tests |

---

## Phase 6.6 — Execution Mode Optimization

### Goal
Optimize the compiled validators for different execution modes (validate-only vs parse vs cast vs clean) and add final polish.

### Deliverables

1. **Mode-specific compilation**
   - `check()` mode: boolean only, no error collection, no value mutation → fastest path
   - `validate()` mode: collect errors, no mutation
   - `parse()` mode: clone input, apply defaults, coerce, strip additional, collect errors
   - Compile separate closures per mode — no runtime branching on options

2. **Coercion compilation**
   - Pre-compile coercion functions per property: `'42' → 42` for `type: 'number'`
   - Inline into property validators when `coerce: true`

3. **Default application compilation**
   - Pre-compute defaults at compile time
   - `if (obj.prop === undefined) obj.prop = defaultValue` — inline in property loop

4. **Strip unknown compilation**
   - `clean()` compiles to: iterate keys, skip if not in `allowedSet`, delete otherwise
   - No validation — just structural projection

5. **Benchmark validation**
   - All benchmarks should show 20-50x improvement over Phase 6.0 baseline
   - Target: within 2-3x of TypeBox on validation, within 5x of AJV

### Target Performance

| Test | Current | Target | Improvement |
|------|---------|--------|-------------|
| simple valid | 314K ops/s | 10M+ ops/s | 30x+ |
| nested valid | 62K ops/s | 3M+ ops/s | 50x+ |
| parse valid | 180K ops/s | 5M+ ops/s | 25x+ |
| clean simple | 236K ops/s | 5M+ ops/s | 20x+ |

### Files Changed

| File | Action |
|------|--------|
| `src/schema/SchemaCompiler.ts` | Mode-specific compilation |
| `src/schema/SchemaRegistry.ts` | Route modes to mode-specific compiled validators |
| `bench/*.bench.ts` | Final benchmark validation |

---

## Execution Order

```
6.1 [Infrastructure]  ─── must be first, everything depends on it
  │
  ├── 6.2 [Primitives]  ─── can start immediately after 6.1
  │     │
  │     └── 6.3 [Objects]  ─── depends on 6.2 (property validators use primitive compilation)
  │           │
  │           ├── 6.4 [Composition]  ─── depends on 6.3 (refs point to compiled objects)
  │           │
  │           └── 6.5 [Arrays]  ─── depends on 6.2/6.3 (item validators)
  │
  └── 6.6 [Modes]  ─── depends on all above, final phase
```

Phases 6.4 and 6.5 can run in parallel once 6.3 is complete.

## Risk Mitigation

1. **Interpreter fallback**: Any schema construct that isn't compiled yet falls back to `GraphEngine.visit()`. This means we can ship incrementally — each phase improves performance for the patterns it covers without breaking anything.

2. **Correctness**: Every compiled validator must produce identical results to the interpreter. The existing 354 test suite runs against both paths. Add a `--interpreted` flag to force the old path for comparison.

3. **Compilation cost**: Compilation happens once at registration time. If compilation is slow for very large schemas, add a threshold: schemas with < N nodes compile eagerly, larger schemas compile lazily on first use.

4. **Memory**: Each compiled validator is a closure tree. For schemas with thousands of nodes this could be significant. Profile memory after Phase 6.3.

5. **`$dynamicRef`**: Dynamic references can't be fully resolved at compile time. Compile a lookup closure that resolves at validation time — slightly slower than static refs but still faster than full interpretation.

## Success Criteria

1. All 354 existing tests pass with compiled validators
2. Benchmark results within 3x of TypeBox on simple validation
3. Benchmark results within 5x of AJV on simple validation
4. No regression on features: formats, custom keywords, coercion, defaults, transforms
5. `$ref` resolution works through compiled validators (the bug that exposed this work)
