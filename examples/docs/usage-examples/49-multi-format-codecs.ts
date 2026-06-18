/**
 * Multi-format ETL fan-in / fan-out with Transform pivot codecs
 *
 * Three public book-data APIs serve different wire shapes for the same
 * bibliographic domain. This demo ingests raw responses from Google Books,
 * OpenLibrary, and Wikipedia into the canonical `urn:bookstore:BibliographicRecord`
 * model — the bibliographic base the retail `Book` extends — using json-tology's
 * own machinery:
 *
 *   1. Pivot codecs — each source has an `addTransform` decode/encode pair whose
 *      SCHEMA is the canonical record (a `Compose.partial` of it, so a decoder
 *      emits only what the source provides). `decode` normalizes the raw source
 *      wire INTO the canonical record; `encode` fans it back out to that source.
 *   2. Fan-in — `jt.instantiate(codec, rawWire)` runs the decoder and validates
 *      the lenient canonical shape; the strict completeness gate runs next.
 *   3. Fan-in router — a `Map<tag, codec>` dispatches inbound records to
 *      the correct codec by source tag.
 *   4. Live fetch — graceful per-source try/catch so a network failure degrades
 *      that source without aborting the pipeline.
 *   5. sameAs provenance — `jt.sameAs(canonicalIri, sourceIri)` records
 *      cross-source identity; `jt.toQuads` emits symmetric `owl:sameAs` edges.
 *   6. Fan-out re-encode — `jt.encode(GoogleVolumeCodec, record)` projects one
 *      canonical record back to a Google-Books-shaped volume.
 *
 * The canonical model is the bibliographic record (isbn / title / authors
 * required; publishedOn optional). It deliberately omits retail fields like price
 * and printStatus: book-search APIs never carry them, so a decoder must never
 * fabricate them. Decoders map only the values a source actually provides; a
 * record missing a required field fails the strict completeness gate rather than
 * being papered over with a placeholder.
 *
 * Ingest enforces TWO canonical gates: a lenient SHAPE gate — `jt.instantiate(
 * codec, raw)` runs the decoder and validates the partial-record shape — and a
 * strict COMPLETENESS gate — `jt.validate(BibliographicRecordSchema, decoded)`,
 * which requires isbn / title / authors. Only records that pass BOTH reach the
 * pipeline.
 *
 * Browser-safe: uses only the global `fetch` and standard JS. No Node imports.
 */

import {
  Compose, InstantiationError, JsonTology
} from '../../../src/index.js';
import { AuthorNameSchema } from '../bookstore/entities/AuthorName.js';
import { BibliographicRecordSchema } from '../bookstore/entities/BibliographicRecord.js';
import { IsbnSchema } from '../bookstore/entities/Isbn.js';
import { PersonNameSchema } from '../bookstore/entities/PersonName.js';
import { PublicationDateSchema } from '../bookstore/entities/PublicationDate.js';
import { TitleSchema } from '../bookstore/entities/Title.js';

// ── Step 1: wire schemas ─────────────────────────────────────────────────────
//
// Each schema models the REAL raw API shape. Fields are intentionally
// permissive (most optional) because live payloads vary across editions and
// search result positions. These wire schemas document the source shapes and
// register the graph (the demo runs under strict graph mode); each codec's
// decoder reads a source shape and normalizes it into the canonical record,
// where the two canonical gates below catch anything missing.

// #region wire-schemas
// Wire schemas are authored graph-natively, the same as the canonical record:
// every nested object is extracted to its own $id and referenced via $ref, so
// the demo runs under strict graph mode (the default) with no inline shapes.

const GoogleImageLinksSchema = {
  '$id': 'urn:wire:googlebooks:ImageLinks',
  'properties': { 'thumbnail': { 'type': 'string' } },
  'type': 'object'
} as const;

const GoogleIndustryIdentifierSchema = {
  '$id': 'urn:wire:googlebooks:IndustryIdentifier',
  'properties': {
    'identifier': { 'type': 'string' },
    'type': { 'type': 'string' }
  },
  'type': 'object'
} as const;

const GoogleVolumeInfoSchema = {
  '$id': 'urn:wire:googlebooks:VolumeInfo',
  'properties': {
    'authors': {
      'items': { 'type': 'string' },
      'type': 'array'
    },
    'categories': {
      'items': { 'type': 'string' },
      'type': 'array'
    },
    'description': { 'type': 'string' },
    'imageLinks': { '$ref': GoogleImageLinksSchema.$id },
    'industryIdentifiers': {
      'items': { '$ref': GoogleIndustryIdentifierSchema.$id },
      'type': 'array'
    },
    'language': { 'type': 'string' },
    'publishedDate': { 'type': 'string' },
    'publisher': { 'type': 'string' },
    'title': { 'type': 'string' }
  },
  'type': 'object'
} as const;

const GoogleVolumeSchema = {
  '$id': 'urn:wire:googlebooks:Volume',
  'properties': {
    'id': { 'type': 'string' },
    'volumeInfo': { '$ref': GoogleVolumeInfoSchema.$id }
  },
  'type': 'object'
} as const;

const OpenLibraryDocSchema = {
  '$id': 'urn:wire:openlibrary:Doc',
  'properties': {
    'author_name': {
      'items': { 'type': 'string' },
      'type': 'array'
    },
    'first_publish_year': { 'type': 'number' },
    'isbn': {
      'items': { 'type': 'string' },
      'type': 'array'
    },
    'key': { 'type': 'string' },
    'language': {
      'items': { 'type': 'string' },
      'type': 'array'
    },
    'publisher': {
      'items': { 'type': 'string' },
      'type': 'array'
    },
    'subject': {
      'items': { 'type': 'string' },
      'type': 'array'
    },
    'title': { 'type': 'string' }
  },
  'type': 'object'
} as const;

const WikipediaDesktopUrlSchema = {
  '$id': 'urn:wire:wikipedia:DesktopUrl',
  'properties': { 'page': { 'type': 'string' } },
  'type': 'object'
} as const;

const WikipediaContentUrlsSchema = {
  '$id': 'urn:wire:wikipedia:ContentUrls',
  'properties': { 'desktop': { '$ref': WikipediaDesktopUrlSchema.$id } },
  'type': 'object'
} as const;

const WikipediaSummarySchema = {
  '$id': 'urn:wire:wikipedia:Summary',
  'properties': {
    'content_urls': { '$ref': WikipediaContentUrlsSchema.$id },
    'description': { 'type': 'string' },
    'extract': { 'type': 'string' },
    'lang': { 'type': 'string' },
    'title': { 'type': 'string' }
  },
  'type': 'object'
} as const;
// #endregion wire-schemas

// ── Canonical model: the shared bookstore BibliographicRecord ────────────────
//
// The ingestion target is `urn:bookstore:BibliographicRecord` — the bibliographic
// base that the retail `Book` extends via `Compose.subClassOf`. Required = isbn /
// title / authors — exactly the fields a book-search source actually carries. It
// carries no price or printStatus: those are retail attributes the sources do not
// provide, so the ingestion target omits them and a decoder never fabricates them.
// Decoding into the base (not Book) is the honest model: a search result is a
// bibliographic record, not a priced inventory listing.

const jt = JsonTology.create({
  'baseIri': 'https://example.org/etl',
  'schemas': [
    // BibliographicRecord primitives (dependency order: PersonName before AuthorName)
    PersonNameSchema,
    AuthorNameSchema,
    IsbnSchema,
    PublicationDateSchema,
    TitleSchema,
    // Canonical entity
    BibliographicRecordSchema,
    // Wire schemas — nested sub-schemas registered before the parents that $ref them
    GoogleImageLinksSchema,
    GoogleIndustryIdentifierSchema,
    GoogleVolumeInfoSchema,
    GoogleVolumeSchema,
    OpenLibraryDocSchema,
    WikipediaDesktopUrlSchema,
    WikipediaContentUrlsSchema,
    WikipediaSummarySchema
  ] as const
});

// ── Per-source OUTPUT schemas — each codec normalizes its source wire INTO the
// canonical BibliographicRecord (fan-in). A source decoder emits only the
// fields the source provides, so each attaches to a `Compose.partial` of the
// record (leniently typed — "never fabricate"); ingest() then runs the strict
// `BibliographicRecordSchema` gate to reject incomplete records. Distinct $ids
// let both book-source codecs target the same canonical shape (one transform
// per schema object) and let `jt.encode` fan a single canonical record back out
// to each source's wire format.
const GoogleRecordSchema = Compose.partial(BibliographicRecordSchema, 'urn:bookstore:ingest:GoogleRecord' as const);
const OpenLibraryRecordSchema = Compose.partial(BibliographicRecordSchema, 'urn:bookstore:ingest:OpenLibraryRecord' as const);

// Wikipedia carries no ISBN, so it is enrichment, not a catalog record: its
// codec normalizes into a small enrichment fragment with its own schema.
const WikipediaEnrichmentSchema = {
  '$id': 'urn:bookstore:ingest:WikipediaEnrichment',
  'properties': {
    'extract': { 'type': 'string' },
    'title': { 'type': 'string' },
    'wikiUrl': { 'type': 'string' }
  },
  'required': [
    'extract',
    'title',
    'wikiUrl'
  ],
  'type': 'object'
} as const;

jt.set(GoogleRecordSchema).set(OpenLibraryRecordSchema)
  .set(WikipediaEnrichmentSchema);

// ── Step 2: pivot codecs ─────────────────────────────────────────────────────
//
// Each codec is a Transform.create(WireSchema, { decode, encode }) pair.
// decode: rawWire → canonical record, mapping ONLY the values the source
//         provides (absent fields are omitted, never defaulted).
// encode: canonical record → best-effort wire shape (lossy where the source is
//         narrower; the comment documents the direction of loss).

// ── Wire type interfaces for each codec ────────────────────────────────────

// OpenLibrary and Wikipedia wire payloads are read as `Record<string, unknown>`
// with the dynamic accessor (`doc['author_name']`) — their field names belong to
// the source's contract, so they are not declared as interface properties.

// ── Helper: extract a 13-digit ISBN from a list of strings ──────────────────

function extractIsbn13(candidates: readonly string[] | undefined): string | undefined {
  if (!candidates) {
    return undefined;
  }
  // Strip hyphens; accept first 13-digit entry
  const clean = candidates.map((candidate) => {
    return candidate.replaceAll('-', '');
  });

  return clean.find((candidate) => {
    return /^\d{13}$/u.test(candidate);
  });
}

// ── Date guard: require full YYYY-MM-DD, omit bare years and partial dates ───

const FULL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/u;

function toFullDate(raw: string | undefined): string | undefined {
  if (raw === undefined) {
    return undefined;
  }

  return FULL_DATE_RE.test(raw) ? raw : undefined;
}

// ── Helper: mint a stable canonical record IRI keyed by ISBN ─────────────────
//
// One place that builds the canonical instance IRI, so the provenance loop,
// the quad-projection step, and the Wikipedia enrichment link all agree.

const RECORD_IRI_BASE = 'https://example.org/etl/record';

function recordIri(isbn: string | undefined): string {
  return `${RECORD_IRI_BASE}/${isbn ?? 'unknown'}`;
}

// ── Canonical record type (wire-unresolved) for codec signatures ─────────────
//
// Every field is optional: the decoder emits only what the source provides.
// ingest() validates the result against BibliographicRecordSchema, so a record
// missing a required field (isbn / title / authors) is rejected at the
// canonical boundary instead of being completed with placeholder values.

interface BibliographicRecordWire {
  // `authors` carries minItems:1, so the canonical types it as a non-empty tuple.
  'authors'?: readonly [string, ...string[]];
  'isbn'?: string;
  'publishedOn'?: string;
  'title'?: string;
}

// #region google-codec
interface GoogleVolumeWire {
  'id'?: string;
  'volumeInfo'?: {
    'authors'?: string[];
    'categories'?: string[];
    'description'?: string;
    'imageLinks'?: { 'thumbnail'?: string };
    'industryIdentifiers'?: Array<{ 'identifier'?: string;
      'type'?: string }>;
    'language'?: string;
    'publishedDate'?: string;
    'publisher'?: string;
    'title'?: string;
  };
}

// Google Books codec: raw wire → canonical bibliographic record
// Decode maps Google's volumeInfo shape to our canonical format.
// Encode maps canonical format back to Google's shape for round-tripping.
const GoogleVolumeCodec = jt.addTransform(GoogleRecordSchema, {
  'decode': (wire: unknown) => {
    const raw = wire as GoogleVolumeWire;
    const info = raw.volumeInfo ?? {};

    // Google Books carries ISBN-13 in industryIdentifiers[].type === 'ISBN_13'
    const isbn13Entry = (info.industryIdentifiers ?? []).find((entry) => {
      return entry.type === 'ISBN_13';
    });
    const isbn = isbn13Entry?.identifier === undefined
      ? undefined
      : extractIsbn13([isbn13Entry.identifier]);

    // publishedDate may be '1984', '1984-07', or '1984-07-01' — only a full
    // YYYY-MM-DD satisfies the canonical date format; omit anything shorter.
    const publishedOn = toFullDate(info.publishedDate);

    // Map only the values Google actually returned; omit the rest.
    return {
      ...(!(info.authors === undefined) && { 'authors': [...info.authors] as [string, ...string[]] }),
      ...(!(isbn === undefined) && { 'isbn': isbn }),
      ...(!(publishedOn === undefined) && { 'publishedOn': publishedOn }),
      ...(!(info.title === undefined) && { 'title': info.title })
    };
  },
  // encode: record → Google-Books-shaped volume (best-effort; omits fields the
  // bibliographic record does not carry).
  'encode': (record: unknown) => {
    const canonical = record as BibliographicRecordWire;
    const volumeInfo: {
      'authors'?: string[];
      'industryIdentifiers'?: Array<{ 'identifier': string;
        'type': string }>;
      'publishedDate'?: string;
      'title'?: string;
    } = {};

    if (canonical.authors !== undefined) {
      volumeInfo.authors = [...canonical.authors];
    }
    if (canonical.isbn !== undefined) {
      volumeInfo.industryIdentifiers = [{
        'identifier': canonical.isbn,
        'type': 'ISBN_13'
      }];
    }
    if (canonical.publishedOn !== undefined) {
      volumeInfo.publishedDate = canonical.publishedOn;
    }
    if (canonical.title !== undefined) {
      volumeInfo.title = canonical.title;
    }

    return { 'volumeInfo': volumeInfo };
  }
});
// #endregion google-codec

// #region openlibrary-codec
const OpenLibraryDocCodec = jt.addTransform(OpenLibraryRecordSchema, {
  'decode': (wire: unknown) => {
    // Wire keys belong to OpenLibrary's contract — read them dynamically.
    const doc = wire as Record<string, unknown>;
    // isbn[] — filter to a 13-digit entry, strip hyphens; undefined when none found
    const isbn = extractIsbn13(doc['isbn'] as readonly string[] | undefined);
    const authorName = doc['author_name'] as readonly string[] | undefined;
    const title = doc['title'] as string | undefined;

    // OpenLibrary only surfaces first_publish_year (a bare integer year), which
    // is not a full YYYY-MM-DD date, so publishedOn is omitted — not faked.
    return {
      ...(!(authorName === undefined) && { 'authors': [...authorName] as [string, ...string[]] }),
      ...(!(isbn === undefined) && { 'isbn': isbn }),
      ...(!(title === undefined) && { 'title': title })
    };
  },
  // encode: canonical record → OpenLibrary-shaped doc. Wire keys are written
  // through the dynamic accessor, not as literal property names.
  'encode': (record: unknown) => {
    const canonical = record as BibliographicRecordWire;
    const doc: Record<string, unknown> = {};

    if (canonical.authors !== undefined) {
      doc['author_name'] = [...canonical.authors];
    }
    if (canonical.isbn !== undefined) {
      doc['isbn'] = [canonical.isbn];
    }
    if (canonical.title !== undefined) {
      doc['title'] = canonical.title;
    }

    return doc;
  }
});
// #endregion openlibrary-codec

// ── Wikipedia codec (enrichment fragment, not a catalog record) ─────────────
//
// Wikipedia summaries carry NO ISBN, so they cannot become a catalog record.
// Wikipedia is treated as enrichment only. The codec decodes into a small
// enrichment fragment; cross-source identity is recorded with
// jt.sameAs(recordIri, wikipediaArticleIri).

interface WikipediaEnrichment {
  'extract': string;
  'title': string;
  'wikiUrl': string;
}

const WikipediaSummaryCodec = jt.addTransform(WikipediaEnrichmentSchema, {
  'decode': (wire: unknown) => {
    // Wire keys belong to Wikipedia's contract — read them dynamically.
    const summary = wire as Record<string, unknown>;
    const contentUrls = summary['content_urls'] as undefined | { 'desktop'?: { 'page'?: string } };

    // Decode into our enrichment fragment structure.
    return {
      'extract': (summary['extract'] as string | undefined) ?? '',
      'title': (summary['title'] as string | undefined) ?? '',
      'wikiUrl': contentUrls?.desktop?.page ?? ''
    };
  },
  // encode: enrichment fragment → Wikipedia-shaped summary. The wire key is
  // written through the dynamic accessor, not as a literal property name.
  'encode': (enrichment: unknown) => {
    const enrich = enrichment as WikipediaEnrichment;
    const summary: Record<string, unknown> = {
      'extract': enrich.extract,
      'title': enrich.title
    };

    summary['content_urls'] = { 'desktop': { 'page': enrich.wikiUrl } };

    return summary;
  }
});

// ── Step 3: fan-in router ────────────────────────────────────────────────────
//
// A Map<tag, codec> dispatches inbound records to the correct codec.
// Order of operations for book sources (google / openlibrary):
//   1. Receive raw payload + source tag.
//   2. Look up the codec for that tag.
//   3. Call jt.instantiate(codec, raw) — runs the decoder, validates the lenient
//      canonical shape (the partial-record gate).
//   4. If no ISBN-13 in decoded record: log "[<tag>] no ISBN-13, skipped" → return null.
//   5. Call jt.validate(BibliographicRecordSchema, decoded) — the strict
//      completeness gate (isbn / title / authors required).
//   6. If canonical errors: log structured aggregate → return null.
//   7. Return canonical record (passed BOTH canonical gates).
//   8. On InstantiationError from step 3: log structured errors → return null (graceful).
//
// Note: ingest enforces the lenient SHAPE gate AND the strict COMPLETENESS gate. Both must pass.

// #region router
type WireCodec
  = | typeof GoogleVolumeCodec
  | typeof OpenLibraryDocCodec
  | typeof WikipediaSummaryCodec;

const SOURCE_CODEC: Map<string, WireCodec> = new Map<string, WireCodec>();

SOURCE_CODEC.set('google', GoogleVolumeCodec);
SOURCE_CODEC.set('openlibrary', OpenLibraryDocCodec);
SOURCE_CODEC.set('wikipedia', WikipediaSummaryCodec);

function ingest(tag: 'google' | 'openlibrary', raw: unknown): BibliographicRecordWire | null;
function ingest(tag: 'wikipedia', raw: unknown): null | WikipediaEnrichment;
function ingest(tag: string, raw: unknown): BibliographicRecordWire | null | WikipediaEnrichment {
  const codec = SOURCE_CODEC.get(tag);

  if (codec === undefined) {
    console.warn(`[router] unknown source tag: ${tag}`);

    return null;
  }

  let decoded: BibliographicRecordWire | WikipediaEnrichment;

  try {
    // The codec returns canonical JSON (BibliographicRecordWire or WikipediaEnrichment)
    // after decoding the wire input. Narrow at the instantiation boundary.
    decoded = jt.instantiate(codec, raw);
  } catch (error) {
    if (error instanceof InstantiationError) {
      console.warn(`[router] ${tag} wire validation failed:`, error.errors.aggregate());
    } else {
      console.warn(`[router] ${tag} unexpected error:`, String(error));
    }

    return null;
  }

  // Wikipedia produces an enrichment fragment, not a record — skip canonical validation.
  if (tag === 'wikipedia') {
    return decoded;
  }

  // Check for ISBN-13 before canonical validation (gives a clear log message).
  const recordDecoded = decoded as BibliographicRecordWire;

  if (recordDecoded.isbn === undefined) {
    console.warn(`[${tag}] no ISBN-13, skipped`);

    return null;
  }

  // Strict completeness gate (the lenient shape gate already passed).
  const canonicalErrors = jt.validate(BibliographicRecordSchema, recordDecoded);

  if (canonicalErrors.length > 0) {
    console.warn(`[${tag}] decoded record failed canonical validation:`, canonicalErrors.aggregate());

    return null;
  }

  return recordDecoded;
}
// #endregion router

// ── Boundary-rejection demo ──────────────────────────────────────────────────
//
// ingest() guards two boundaries; this section trips each one in isolation so
// both rejection paths are visible before the live data arrives.

console.log('── Boundary-rejection demo ──');

// Case 1 — ISBN-13 prerequisite. The wire schema accepts a volume whose only
// identifier is an ISBN_10 (a valid wire state), but the decoder finds no
// ISBN_13, so the record cannot be keyed in the canonical model. ingest()
// short-circuits with "no ISBN-13, skipped" before canonical validation.
const noIsbnPayload = {
  'id': 'no-isbn13',
  'volumeInfo': {
    'authors': ['Some Author'],
    'industryIdentifiers': [{
      'identifier': '978-0-06-112008-4',
      'type': 'ISBN_10'
    }],
    'title': 'A Book With No ISBN-13'
  }
};

if (ingest('google', noIsbnPayload) === null) {
  console.log('[case 1] rejected at the ISBN-13 prerequisite (logged above)');
}

// Case 2 — canonical-out validation. This volume passes the wire schema AND
// carries a valid ISBN_13, so it clears the prerequisite — but its title
// exceeds Title's 500-character ceiling, so jt.validate(BibliographicRecordSchema, …)
// inside ingest() rejects it. This is the strict completeness gate firing,
// distinct from the lenient shape gate above.
const overlongTitlePayload = {
  'id': 'overlong-title',
  'volumeInfo': {
    'authors': ['Some Author'],
    'industryIdentifiers': [{
      'identifier': '9780000000000',
      'type': 'ISBN_13'
    }],
    'title': 'X'.repeat(501)
  }
};

if (ingest('google', overlongTitlePayload) === null) {
  console.log('[case 2] rejected at the canonical boundary (logged above)');
}

// ── Step 4: live fetch ───────────────────────────────────────────────────────
//
// Three async functions using global fetch against CORS-friendly, key-free
// endpoints. Each returns raw items from that source. Wrapped in try/catch
// so a network failure logs a graceful message and continues — the pipeline
// degrades per-source rather than aborting the run.

const QUERY = 'neuromancer';

async function fetchGoogleBooks(query: string): Promise<unknown[]> {
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=3`;

  try {
    const res = await fetch(url);
    const json = await res.json() as { 'items'?: unknown[] };

    return json.items ?? [];
  } catch {
    console.warn('[google] fetch failed — continuing without Google Books results');

    return [];
  }
}

async function fetchOpenLibrary(query: string): Promise<unknown[]> {
  // OpenLibrary's search.json omits `isbn` from the default field projection;
  // it must be requested explicitly via `fields`, or every doc arrives ISBN-less
  // and fails the canonical boundary (the record's isbn requires a 13-digit ISBN).
  const fields = 'key,title,author_name,first_publish_year,isbn,publisher,subject,language';
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=3&fields=${fields}`;

  try {
    const res = await fetch(url);
    const json = await res.json() as { 'docs'?: unknown[] };

    return json.docs ?? [];
  } catch {
    console.warn('[openlibrary] fetch failed — continuing without OpenLibrary results');

    return [];
  }
}

async function fetchWikipediaSummary(title: string): Promise<null | unknown> {
  const slug = title.replaceAll(/\s+/gu, '_');
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`;

  try {
    // Wikipedia's REST API rate-limits anonymous traffic into a shared pool;
    // the recommended `Api-User-Agent` header (settable from the browser, unlike
    // `User-Agent`) identifies the caller and avoids the 429 shared-pool cap.
    const res = await fetch(url, { 'headers': { 'Api-User-Agent': 'json-tology-docs-demo/1.0 (https://github.com/noocodec/json-tology)' } });

    if (!res.ok) {
      console.warn(`[wikipedia] ${res.status} for "${title}" — continuing without Wikipedia enrichment`);

      return null;
    }

    return await res.json() as unknown;
  } catch {
    console.warn('[wikipedia] fetch failed — continuing without Wikipedia enrichment');

    return null;
  }
}

// ── Main async pipeline ──────────────────────────────────────────────────────

console.log('\n── Fetching from Google Books, OpenLibrary, Wikipedia ──');
const [
  googleItems,
  openLibraryItems,
  wikiRaw
] = await Promise.all([
  fetchGoogleBooks(QUERY),
  fetchOpenLibrary(QUERY),
  fetchWikipediaSummary('Neuromancer')
]);

// ── Fan-in: ingest all Google + OpenLibrary items ───────────────────────────
//
// ingest() enforces BOTH canonical gates:
//   shape:        jt.instantiate(codec, raw) runs the decoder + validates the partial record
//   completeness: jt.validate(BibliographicRecordSchema, decoded) requires isbn / title / authors
// Records missing an ISBN-13 are discarded before the completeness gate.

interface SourcedRecord {
  'record': BibliographicRecordWire;
  'sourceIri': string;
}

const sourcedRecords: SourcedRecord[] = [];

console.log('\n── Fan-in: ingesting Google Books items ──');
for (const raw of googleItems) {
  const record = ingest('google', raw);

  if (record !== null) {
    const vol = raw as { 'id'?: string };
    const sourceIri = `https://www.googleapis.com/books/v1/volumes/${vol.id ?? 'unknown'}`;

    sourcedRecords.push({
      'record': record,
      'sourceIri': sourceIri
    });
    console.log(`[google] ingested: "${record.title ?? '—'}" isbn=${record.isbn ?? '—'}`);
  }
}

console.log('\n── Fan-in: ingesting OpenLibrary items ──');
for (const raw of openLibraryItems) {
  const record = ingest('openlibrary', raw);

  if (record !== null) {
    const doc = raw as { 'key'?: string };
    const sourceIri = `https://openlibrary.org${doc.key ?? '/works/unknown'}`;

    sourcedRecords.push({
      'record': record,
      'sourceIri': sourceIri
    });
    console.log(`[openlibrary] ingested: "${record.title ?? '—'}" isbn=${record.isbn ?? '—'}`);
  }
}

// ── Step 5: sameAs provenance ────────────────────────────────────────────────
//
// For each canonical record, mint an IRI keyed by ISBN and record cross-source
// identity. jt.toQuads emits symmetric owl:sameAs edges — the lineage travels
// from wire source IRI to canonical record IRI in both directions.

const OWL_SAME_AS = 'http://www.w3.org/2002/07/owl#sameAs';

// #region sameas-provenance
console.log('\n── sameAs provenance ──');
for (const {
  record, sourceIri
} of sourcedRecords) {
  const canonicalIri = recordIri(record.isbn);

  jt.sameAs(canonicalIri, sourceIri);
  console.log(`  sameAs: <${canonicalIri}> ↔ <${sourceIri}>`);
}

// Emit owl:sameAs quads for the first ingested record to show lineage. ingest()
// already validated every record against BibliographicRecordSchema, so this
// instantiate is guaranteed to succeed — it simply lifts the validated record
// to the branded type toQuads requires.
if (sourcedRecords.length > 0) {
  const first = sourcedRecords[0];

  if (first === undefined) {
    throw new Error('expected sourced record');
  }
  const firstIri = recordIri(first.record.isbn);
  const firstTyped = jt.instantiate(BibliographicRecordSchema, first.record);

  const firstQuads = jt.toQuads(BibliographicRecordSchema, firstTyped) as Array<{
    'object': { 'value': string };
    'predicate': { 'value': string };
    'subject': { 'value': string };
  }>;

  const sameAsQuads = firstQuads.filter((quad) => {
    return quad.predicate.value === OWL_SAME_AS;
  });

  console.log(`[sameAs] owl:sameAs quads for <${firstIri}>: ${sameAsQuads.length}`);

  for (const quad of sameAsQuads) {
    console.log(`  <${quad.subject.value}> owl:sameAs <${quad.object.value}>`);
  }
}
// #endregion sameas-provenance

// ── Wikipedia enrichment + sameAs ────────────────────────────────────────────
//
// Wikipedia has no ISBN, so it cannot become a catalog record. Decode into an
// enrichment fragment and attach via sameAs to any record sharing the same
// title — the enrichment-only pattern.

if (wikiRaw !== null) {
  console.log('\n── Wikipedia enrichment ──');
  const enrichment = ingest('wikipedia', wikiRaw);

  if (enrichment !== null) {
    console.log(`[wikipedia] enrichment: "${enrichment.title}"`);
    console.log(`[wikipedia] url: ${enrichment.wikiUrl}`);
    console.log(`[wikipedia] extract (first 120 chars): ${enrichment.extract.slice(0, 120)}…`);

    // Attach to the first matching record by title proximity (case-insensitive)
    const matched = sourcedRecords.find(({ record }) => {
      return (record.title ?? '').toLowerCase().includes('neuromancer');
    });

    if (matched !== undefined && enrichment.wikiUrl !== '') {
      const canonicalIri = recordIri(matched.record.isbn);

      jt.sameAs(canonicalIri, enrichment.wikiUrl);
      console.log(`[wikipedia] sameAs <${canonicalIri}> ↔ <${enrichment.wikiUrl}>`);
    }
  }
}

// ── Step 6: fan-out re-encode ────────────────────────────────────────────────
//
// Take one canonical record and project it back to a Google-Books-shaped
// volume. Fan-out is directional: always use the target codec's encode. The
// result is a best-effort wire shape; fields the source format cannot represent
// are dropped (lossy by design — documented in the codec encode comment).

if (sourcedRecords.length > 0) {
  console.log('\n── Fan-out re-encode: canonical record → Google Books volume ──');
  const toReEncode0 = sourcedRecords[0];

  if (toReEncode0 === undefined) {
    throw new Error('expected sourced record');
  }
  const toReEncode = toReEncode0.record;

  // jt.encode runs the GoogleVolumeCodec encoder, transforming canonical→wire.
  const reEncoded = jt.encode(GoogleVolumeCodec, toReEncode) as {
    'volumeInfo'?: {
      'authors'?: string[];
      'industryIdentifiers'?: Array<{ 'identifier'?: string;
        'type'?: string }>;
      'title'?: string;
    };
  };

  console.log('[fan-out] re-encoded volume title:', reEncoded.volumeInfo?.title);
  console.log('[fan-out] re-encoded ISBN-13:', reEncoded.volumeInfo?.industryIdentifiers?.[0]?.identifier);
  console.log('[fan-out] re-encoded authors:', JSON.stringify(reEncoded.volumeInfo?.authors));
}

console.log('\n── Demo complete ──');
console.log(`  Total canonical records ingested: ${sourcedRecords.length}`);
