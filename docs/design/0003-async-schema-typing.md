# 0003 — Type-safe async schema federation

**Status:** open
**Driver:** 0.5.0 shipped the loader hook (`JsonTology.create({ loader })` returns `Promise<JsonTology>` at runtime) but the static signature lies — TypeScript types both forms as `JsonTology`. Worth picking up in a follow-up session.

## What's broken

Today:

```ts
const jt = JsonTology.create({ schemas, loader });
//    ^? JsonTology<...>          actually Promise<JsonTology<...>>
jt.validate(id, data);            // typechecks; throws at runtime
```

The runtime contract is correct (Promise returned when `loader` is set). The static contract is loose: a caller who forgets `await` gets a clean compile and a runtime explosion.

## Why the agent dropped the conditional return type

The original design used overloaded `create()`:

```ts
create(opts: TOpts & { loader: LoaderType }): Promise<JT>
create(opts: TOpts): JT
```

This combined with the existing `UniqueSchemaIdsType<TSchemas>` duplicate-id check (a recursive mapped type) and the 38-schema bookstore array hits **TS2589 ("Type instantiation is excessively deep")** in TS 6.0.3. The compiler evaluates `UniqueSchemaIdsType` twice (once per overload candidate) and the depth budget runs out before resolution.

The agent's fallback was a single overload returning `JsonTology`. The Promise return is observable at runtime but invisible to the type system.

## Five options for restoring type safety

### Option 1 — Two methods: `create()` sync, `createAsync()` async

```ts
JsonTology.create({ schemas })                 // JsonTology
JsonTology.createAsync({ schemas, loader })    // Promise<JsonTology>
```

No conditional types, no overload resolution, no depth issues. Type-safe at every call site.

This is AJV's pattern (`new Ajv()` / `compileAsync`), Pydantic's (`model_validate` / `model_validate_async`), jsonld.js's (`compact` / `compactAsync`). Idiomatic because the sync/async distinction is observable behavior, not an implementation detail — it earns its own name.

- **Pro:** ships in an afternoon. Zero conditional-type complexity.
- **Pro:** call site declares intent explicitly.
- **Con:** "two methods that do similar things." Mitigated by the fact that one fetches and one doesn't — they're not symmetric.

### Option 2 — Conditional return on `typeof options`, not on `TSchemas`

```ts
type CreateReturn<TOpts, TMap> =
  TOpts extends { loader: LoaderType } ? Promise<JsonTology<TMap>> : JsonTology<TMap>;

static create<const TS extends ReadonlyArray<...>>(
  opts: JsonTologyOptionsInterface<TS> & { schemas?: UniqueSchemaIdsType<TS> }
): CreateReturn<typeof opts, SchemaMapFromTupleType<TS>>
```

The conditional check is on the already-narrowed `options` object, not on `TSchemas`. `UniqueSchemaIdsType` only evaluates once, separately from the conditional. The conditional layer is a cheap key-lookup, not a recursive walk — should slot under the depth budget.

- **Pro:** lowest-effort fix if it works.
- **Pro:** preserves the single-method API.
- **Con:** unverified. May still hit TS2589 on the bookstore array. Needs a 1-hour experiment.

### Option 3 — Phantom-type discriminator on options

Same shape as Option 2 with more ceremony (`JsonTologyOptionsInterface<TSchemas, _Mode extends 'sync' | 'async'>`). Skip.

### Option 4 — Async-everywhere

Every method on `JsonTology` returns `Promise`. No conditional types because there's only one mode. Breaks every existing call site. User said no in the original session.

### Option 5 — **Snapshot-based prefetching** ← the cache angle

Federate at build/boot time. Resolve sync everywhere after.

```ts
// Once at boot, or even at build time baked into a bundle:
const snapshot = await JsonTology.prefetch({
  loader: Loaders.cached(Loaders.fetch({ base: 'https://schemas.example/v1/' })),
  rootIds: ['urn:user', 'urn:address', 'urn:order']
});

// Anywhere, any time after — sync, type-safe:
const jt = JsonTology.create({ schemas: [UserSchema], prefetched: snapshot });
jt.validate(UserSchema, data);   // sync hot path, no Promise return
```

`snapshot` is a `ReadonlyMap<string, JsonSchemaType>` (or a serializable shape with provenance metadata). You can:

- **Bundle it:** `import snapshot from './schemas-snapshot.json' with { type: 'json' }`
- **Persist it:** write to disk, reload at boot
- **Share it:** pass between workers, edge functions, Service Worker cache, IndexedDB
- **Pin it:** vendor it for offline-first apps
- **Diff it:** emit only changed schemas in CI

Federation becomes a build concern, not a hot-path concern. The runtime API stays sync. The conditional-return-type problem evaporates because there's no async branch in `create()` — federation lives in a separate `prefetch()` function whose only job is to return a `Promise<Snapshot>`.

This is the federated-SPARQL caching analogy. Bazel does this for build graphs. RDF stores do it for materialized views. TypeScript itself does it with `tsbuildinfo`. The pattern: **lift the async work to a discrete prepare step; keep the consume step sync**.

- **Pro:** highest design value. Converts a runtime footgun into a build-time guarantee.
- **Pro:** preserves sync-everywhere semantics for hot paths.
- **Pro:** composable with the existing loader hook (snapshot is built using the loader).
- **Con:** new surface area (Snapshot type, prefetch method, serialization format, versioning, invalidation).
- **Con:** doesn't replace the loader hook — it's a layer on top. Users with genuine on-demand federation still use the loader directly.

## Recommended sequence for the follow-up session

**Track A — immediate type-safety fix:**

1. Try Option 2 first. Write the conditional-on-`typeof opts` signature, run `npm run type-check` against the bookstore. If clean, ship.
2. If Option 2 still fires TS2589, fall back to Option 1 (`createAsync()`). Migration is one rename per call site, low blast radius.

Either way, the type lie is gone in a single PR.

**Track B — snapshot prefetching:**

1. Define `SnapshotInterface { readonly version: number; readonly schemas: ReadonlyMap<string, JsonSchemaType>; readonly provenance?: Record<string, { source: string; fetchedAt: string }> }`.
2. Add `JsonTology.prefetch({ loader, rootIds }): Promise<Snapshot>` that walks transitive refs via the loader and returns the snapshot.
3. Add `prefetched?: Snapshot` option on `JsonTology.create()`. When present, the registry pre-populates from the snapshot before the sync `$ref` walk. If a ref is still unresolved after consulting the snapshot, throw `REF_UNRESOLVED`.
4. Add a serialization format (likely JSON with `__jt_snapshot_version` discriminant) so snapshots can be persisted and shared.
5. Document the boot-once-then-sync pattern in `docs/advanced/schema-federation.md` alongside the existing loader hook.

The snapshot is additive. The loader hook stays. Users with no federation needs ignore both. Users with browser apps prefetch once at boot. Users with edge functions can bake the snapshot into the bundle. Users with genuinely dynamic schema sets keep using the loader directly.

## Open questions for the follow-up

1. **Snapshot identity:** is a snapshot pinned to a specific `loader` invocation, or is it loader-agnostic once built? If loader-agnostic, can two snapshots from different loaders be `Snapshot.merge()`d?
2. **Stale snapshots:** when a snapshot references a schema that has been updated upstream, how does the user know? Hash check at boot? Manifest version?
3. **Snapshot in source-control:** is it a build artifact (CI generates, doesn't commit), a vendored artifact (committed for reproducibility), or both modes supported?
4. **Bundle-time vs runtime prefetch:** for browser apps, can a Vite/webpack plugin generate the snapshot at bundle time so the runtime never makes a network call? (Probably yes; design a `@json-tology/bundler-plugin` package.)
5. **Per-tenant snapshots:** for multi-tenant SaaS, each tenant might have different schemas. Snapshot becomes a per-request artifact. Performance implications?
6. **Subset snapshots:** sometimes you only need part of a snapshot. Can `Snapshot.subset(rootIds)` produce a smaller snapshot that's still self-contained transitively?

## Non-goals

- Replacing the `Loaders.*` namespace. It stays as the on-demand federation primitive.
- Making `validate`/`instantiate`/`is` async. The hot path stays sync.
- Inferring `loader` presence via JSDoc annotations or other non-TS-native machinery.

## References

- Pydantic async validators: https://docs.pydantic.dev/latest/concepts/validators/#field-validators (model_validate vs model_validate_async)
- AJV `loadSchema` callback + `compileAsync`: https://ajv.js.org/guide/managing-schemas.html#asynchronous-schema-compilation
- TypeScript TS2589 depth: https://github.com/microsoft/TypeScript/issues/30188
- JSON-LD spec on retrieval mechanisms: https://www.w3.org/TR/json-ld-api/#dom-jsonldcallbacks-documentloader
- SPARQL 1.1 Federated Query (SERVICE keyword): https://www.w3.org/TR/sparql11-federated-query/
- json-tology 0.5.0 commit landing the loader hook: `0234106 feat(loader)!: unify schema loading via async loader hook`
