# Multi-format ETL with pivot codecs

Many pipelines fan **in** from several source formats and fan **out** to several
targets: a books aggregator ingests Google Books, OpenLibrary, and Wikipedia; a
messaging bridge ingests Slack, Discord, and Teams. The shapes differ, but they
all describe the same domain and should collapse into **one canonical model** —
and project back out again on demand.

This page builds that pipeline with the primitives json-tology already ships: a
canonical schema, one **wire schema per source**, a `Transform.create` **pivot
codec** per source, and `owl:sameAs` for cross-source provenance. No new API.

The demo decodes three live public book APIs into the canonical
[`urn:bookstore:BibliographicRecord`](/bookstore-domain) — the bibliographic base
that the retail [`urn:bookstore:Book`](/bookstore-domain) extends via
`Compose.subClassOf` — records lineage, and re-encodes one record back to a source
shape. Decoding into the base, not the for-sale `Book`, is the honest model: a
search result is a bibliographic record, not a priced inventory listing, so the
target carries no `price` or `printStatus` for a decoder to fabricate. The mapping
is schema-driven rather than a hand-written adapter: the wire boundary is validated
by json-tology before any transformation runs, and the decoded result is validated
again against the canonical model before it reaches the graph.

<RunnableExample src="examples/docs/usage-examples/49-multi-format-codecs" />

## The shape of the pipeline

1. **One canonical model.** `urn:bookstore:BibliographicRecord` is the pivot type
   every source decodes into. It requires a 13-digit `isbn`, a `title`, and at
   least one author (`publishedOn` is optional). The retail `Book` extends it with
   commercial state (`price`, `printStatus`, inventory) — which book-search sources
   do not carry, so the ingestion target is the base, not `Book`.
2. **One wire schema per source.** `urn:wire:googlebooks:Volume`,
   `urn:wire:openlibrary:Doc`, and `urn:wire:wikipedia:Summary` model the raw API
   payloads. They are intentionally permissive — most fields optional — because
   live responses vary by edition and result position. They are authored
   graph-natively, the same as the canonical record: every nested object is
   extracted to its own `$id` and referenced by `$ref`, so the demo runs under
   strict graph mode with no inline shapes.
3. **One pivot codec per source.** `Transform.create(WireSchema, { decode,
   encode })` translates that source's shape into (and back out of) the
   canonical record. The decoders standardize on the bibliographic record as the
   pivot type, so a record decoded from one source can be re-encoded to another.
4. **A fan-in router.** A `Map<tag, codec>` dispatches an inbound record to
   the right codec by source tag; `jt.instantiate(codec, raw)` validates
   and decodes it.

## Order of operations

For each inbound record:

1. Receive the raw payload and its source tag.
2. Look up the wire schema for that tag.
3. Call `jt.instantiate(wireSchema, raw)` — this validates the payload against
   the **wire boundary** and runs the registered decoder.
4. Validate the decoded value against `BibliographicRecordSchema` with
   `jt.validate` — the **canonical boundary**. Records that cannot produce a valid
   record (missing ISBN, unparseable date) are discarded with a logged reason,
   never silently coerced.
5. Keep the records that pass both boundaries as canonical bibliographic records.

## Dual-boundary validation

Decoding to a record-shaped object is not the same as proving it **is** a
canonical bibliographic record. The demo validates at both edges: the wire schema
guards the input contract (a malformed Google volume is rejected before mapping),
and `jt.validate(BibliographicRecordSchema, decoded)` guards the output contract (a record whose
`publishedOn` is a bare year, not a full `YYYY-MM-DD`, never reaches the graph).
This is the architectural rule that validation executes against the canonical
graph, applied at an ingestion boundary.

This dual-schema approach is explicit by design: the decoder's output type is the
full `BibliographicRecordSchema`, and the second `jt.validate` call is a real
re-check against that same strict schema, not a formality. The alternative —
a `decode` that returns a bare `Partial<BibliographicRecord>` and lets
`jt.instantiate(..., { enableDefaults: true })` fill in the rest — is documented at
[Partial decode with `enableDefaults`](/transforms/decode-encode#partial-decode-with-enabledefaults).
That pattern is the better fit when the schema's own defaults are trustworthy
fill-ins for missing wire fields. Here they are not: a book search result that
lacks a `publishedOn` should be discarded, not defaulted, so this page keeps
the wire and canonical boundaries as two schemas the decoder must satisfy in
full rather than one schema completed by the framework.

## Cross-source provenance with `sameAs`

When two sources describe the same book, that identity is a fact worth
recording — not a transformation. After a record is canonicalized, the demo
mints an ISBN-keyed IRI and calls `jt.sameAs(canonicalIri, sourceIri)`. At
projection time, `jt.toQuads` emits symmetric `owl:sameAs` edges automatically,
so a reasoner can fuse purchase history, reviews, or editions across catalogs.
This is the same identity-merge pattern as the
[Bookstore OWL taxonomy](/usage-examples/bookstore-owl-taxonomy) CRM example,
applied across data sources. See the [`sameAs` reference](/advanced/sameas) for
the ABox-identity semantics and the blank-node caveat.

### Codecs translate; equivalence asserts

Keep the two layers distinct. A `Transform` codec is a **function** — it
executes and moves values. `owl:sameAs` and `owl:equivalentClass` are
**assertions** for a reasoner — they record identity or class equivalence and do
not transform anything. Use a codec to map a Google volume into a record; use
`sameAs` to record that the resulting record and the OpenLibrary edition are the
same entity. Reaching for `equivalentClass` to "perform" a mapping is a category
error: it claims the values are already identical, which is false the moment a
field is renamed, reformatted, or unit-converted.

## Enrichment-only sources

Not every source yields a primary record. Wikipedia summaries carry no ISBN, so
they cannot satisfy the bibliographic record contract. The demo treats Wikipedia as
**enrichment**: its codec decodes into a small fragment (title, extract, URL),
which is attached to a matching record via `sameAs` rather than registered as a
catalog entry.

## Fan-out re-encode

Projection is directional: to emit a record as a Google-Books-shaped volume,
call the **target** codec's encoder via `jt.encode(GoogleVolumeCodec, record)`.
Encoders are best-effort and lossy where the target format is narrower than the
canonical model — fields one source carries but another cannot represent are
dropped on the way out. The codec comment documents the direction of loss, the same
convention the [transform recipes](/usage-examples/transforms-recipes) use for
one-way encoders.

## Live data and graceful degradation

The example fetches real, key-free, CORS-friendly endpoints. OpenLibrary is the
reliable canonical source (its `search.json` needs an explicit `fields=…,isbn`
projection to return ISBNs). Google Books returns nothing without an API key
under quota, and Wikipedia's REST API rate-limits anonymous traffic — both
degrade per-source without aborting the run, contributing records when reachable
and quietly dropping out when not. Press **Execute** above to run it against the
live APIs from your browser.

## Related

- [`Transform.create` and `jt.encode`](/transforms/decode-encode) — the codec API
- [`Transform.chain`](/transforms/chain) — multi-step decode for a single source
- [`sameAs`](/advanced/sameas) — ABox identity semantics
- [`toQuads` / `fromQuads`](/advanced/quads) — ABox projection and lift
- [Bookstore domain](/bookstore-domain) — the `BibliographicRecord` / `Book` vocabulary
