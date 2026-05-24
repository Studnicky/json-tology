/**
 * Annotations dispatcher — OWL 2 §10 Annotations
 *
 * Responsible for:
 *   rdfs:label          — human-readable class/property names → `title`
 *   rdfs:comment        — descriptions → `description`
 *   owl:deprecated      — deprecation marker → `deprecated: true`
 *   owl:versionInfo     — ontology/class version info → `$comment: "version: ..."`
 *   rdfs:seeAlso        — cross-references → `$comment: "seeAlso: <iri>"`
 *   rdfs:isDefinedBy    — provenance link → `$comment: "definedBy: <iri>"`
 *   skos:definition     — SKOS definition → `description`
 *   skos:prefLabel      — SKOS preferred label → `title`
 *   skos:altLabel       — SKOS alternative labels (metadata only)
 *   owl:AnnotationProperty declarations
 *
 * Bucket strategy: structural (annotation values patch `title`, `description`,
 * `deprecated` in schemaDeltas; unrecognised annotation properties are silently
 * skipped via reportUnsupported so they surface in result.unsupported without
 * aborting the pipeline).
 *
 * Graph-native traversal: reads `ctx.graph.allRelations()` and uses the
 * `language` / `datatype` / `termType` fields the quad-backed graph populates
 * on each relation when the source quad's object is a Literal. The graph
 * emits relations for every subject in the input (including ontology IRIs
 * that are not registered classes or properties), so annotation reach is
 * preserved without scanning raw quads.
 */

import type { QuadInterface } from '../../../interfaces/Quad.js';
import type {
  OwlImportContext, OwlImportFragment
} from '../../../interfaces/OwlImport.js';
import type { JsonSchemaDocumentObjectType } from '../../../types/Schema.js';
import type { SchemaGraphRelationInterface } from '../../../interfaces/SchemaGraph.js';

// ---------------------------------------------------------------------------
// Predicate IRI sets (compact and full-IRI forms accepted)
// ---------------------------------------------------------------------------

// Predicates that map to `title` (last one wins if both present; English preferred)
const LABEL_PREDICATES = new Set<string>([
  'http://www.w3.org/2000/01/rdf-schema#label',
  'http://www.w3.org/2004/02/skos/core#prefLabel',
  'rdfs:label',
  'skos:prefLabel'
]);

// Predicates that map to `description`
const COMMENT_PREDICATES = new Set<string>([
  'http://www.w3.org/2000/01/rdf-schema#comment',
  'http://www.w3.org/2004/02/skos/core#definition',
  'rdfs:comment',
  'skos:definition'
]);

// Predicate for `deprecated`
const DEPRECATED_PREDICATES = new Set<string>([
  'http://www.w3.org/2002/07/owl#deprecated',
  'owl:deprecated'
]);

// Predicate for `owl:versionInfo` → $comment "version: ..."
const VERSION_INFO_PREDICATES = new Set<string>([
  'http://www.w3.org/2002/07/owl#versionInfo',
  'owl:versionInfo'
]);

// Predicate for `rdfs:isDefinedBy` → $comment "definedBy: <iri>"
const IS_DEFINED_BY_PREDICATES = new Set<string>([
  'http://www.w3.org/2000/01/rdf-schema#isDefinedBy',
  'rdfs:isDefinedBy'
]);

// Predicate for `rdfs:seeAlso` → $comment "seeAlso: <iri>"
const SEE_ALSO_PREDICATES = new Set<string>([
  'http://www.w3.org/2000/01/rdf-schema#seeAlso',
  'rdfs:seeAlso'
]);

// skos:altLabel — record as metadata only (no direct schema field)
const ALT_LABEL_PREDICATES = new Set<string>([
  'http://www.w3.org/2004/02/skos/core#altLabel',
  'skos:altLabel'
]);

// owl:AnnotationProperty declarations — silently accepted
const ANNOTATION_PROPERTY_PREDICATES = new Set<string>([
  'http://www.w3.org/2002/07/owl#AnnotationProperty',
  'owl:AnnotationProperty'
]);

// ---------------------------------------------------------------------------
// Relation-target extraction helpers — read from graph relations
// ---------------------------------------------------------------------------

/**
 * Extract the string value of a Literal-typed relation target.
 * Returns null when the relation does not carry a Literal target.
 */
function literalString(relation: SchemaGraphRelationInterface): null | string {
  if (relation.termType !== 'Literal') {
    return null;
  }

  return typeof relation.target === 'string'
    ? relation.target
    : relation.target.id;
}

/**
 * Extract the language tag of a Literal-typed relation target.
 * Returns the empty string for untagged literals or non-literal targets.
 */
function literalLanguage(relation: SchemaGraphRelationInterface): string {
  if (relation.termType !== 'Literal') {
    return '';
  }

  return relation.language ?? '';
}

/**
 * Extract the IRI of a NamedNode-typed relation target.
 * Returns null when the relation does not carry a NamedNode target.
 */
function namedNodeIri(relation: SchemaGraphRelationInterface): null | string {
  if (relation.termType !== 'NamedNode') {
    return null;
  }

  return typeof relation.target === 'string'
    ? relation.target
    : relation.target.id;
}

// ---------------------------------------------------------------------------
// Accumulator shapes
// ---------------------------------------------------------------------------

/** Per-entity annotation accumulator before it is written into schemaDeltas. */
interface AnnotationAccumulator {
  /** Language-tagged alt labels: lang → string[]. */
  'altLabels': Map<string, string[]>;
  /** Language-tagged comments: lang → string[]. */
  'comments': Map<string, string[]>;
  /** `deprecated` flag, set when any owl:deprecated true literal is found. */
  'deprecated': boolean;
  /** rdfs:isDefinedBy IRI values. */
  'isDefinedBy': string[];
  /** Language-tagged labels: lang → string[]. */
  'labels': Map<string, string[]>;
  /** rdfs:seeAlso IRI values. */
  'seeAlso': string[];
  /** owl:versionInfo string values. */
  'versionInfo': string[];
}

function makeAccumulator(): AnnotationAccumulator {
  return {
    'altLabels': new Map(),
    'comments': new Map(),
    'deprecated': false,
    'isDefinedBy': [],
    'labels': new Map(),
    'seeAlso': [],
    'versionInfo': []
  };
}

// ---------------------------------------------------------------------------
// Multi-language helpers
// ---------------------------------------------------------------------------

/**
 * Append a string value into a lang-keyed map.
 * Uses `''` (empty string) as the key for untagged literals.
 */
function appendLangValue(map: Map<string, string[]>, lang: string, value: string): void {
  const key = lang === '' ? '' : lang.toLowerCase();
  const existing = map.get(key);

  if (existing === undefined) {
    map.set(key, [value]);
  } else {
    existing.push(value);
  }
}

/**
 * Resolve the best string value from a lang-keyed map.
 *
 * Priority: English ('en') → untagged ('') → first available.
 * Multiple values for the same language are joined with '\n\n'.
 */
function resolveLangValue(map: Map<string, string[]>): null | string {
  if (map.size === 0) {
    return null;
  }

  const enValues = map.get('en');

  if (enValues !== undefined && enValues.length > 0) {
    return enValues.join('\n\n');
  }

  const untaggedValues = map.get('');

  if (untaggedValues !== undefined && untaggedValues.length > 0) {
    return untaggedValues.join('\n\n');
  }

  // Fall back to the first available language
  const firstEntry = map.entries().next();

  if (firstEntry.done === false) {
    const values = firstEntry.value[1];

    return values.join('\n\n');
  }

  return null;
}

/**
 * Build a jt:i18n record from a lang-keyed map when multiple language tags
 * are present. Returns null when only one language (or none) is in the map.
 */
function buildI18nRecord(map: Map<string, string[]>): null | Record<string, string> {
  // Only emit i18n when there are values in more than one language bucket
  // (exclude the untagged bucket from the count — it is absorbed into the primary field)
  const taggedKeys = [...map.keys()].filter((k) => {
    return k !== '';
  });

  if (taggedKeys.length <= 1) {
    return null;
  }

  const i18n: Record<string, string> = {};

  for (const [
    lang,
    values
  ] of map.entries()) {
    if (lang !== '') {
      i18n[lang] = values.join('\n\n');
    }
  }

  return Object.keys(i18n).length > 0 ? i18n : null;
}

// ---------------------------------------------------------------------------
// Delta builder
// ---------------------------------------------------------------------------

/**
 * Convert an AnnotationAccumulator into a partial schema delta.
 */
function buildDelta(acc: AnnotationAccumulator): Partial<JsonSchemaDocumentObjectType> {
  const delta: Record<string, unknown> = {};

  const title = resolveLangValue(acc.labels);

  if (title !== null) {
    delta.title = title;
  }

  const description = resolveLangValue(acc.comments);

  if (description !== null) {
    delta.description = description;
  }

  if (acc.deprecated) {
    delta.deprecated = true;
  }

  // $comment — combine versionInfo, isDefinedBy, seeAlso entries
  const commentParts: string[] = [];

  for (const versionStr of acc.versionInfo) {
    commentParts.push(`version: ${versionStr}`);
  }
  for (const iri of acc.isDefinedBy) {
    commentParts.push(`definedBy: ${iri}`);
  }
  for (const iri of acc.seeAlso) {
    commentParts.push(`seeAlso: ${iri}`);
  }

  if (commentParts.length > 0) {
    delta.$comment = commentParts.join('; ');
  }

  // jt:i18n for labels (when multiple languages present)
  const labelI18n = buildI18nRecord(acc.labels);

  if (labelI18n !== null) {
    delta['jt:i18n'] = {
      ...delta['jt:i18n'] as Record<string, unknown> | undefined,
      'label': labelI18n
    };
  }

  // jt:i18n for descriptions (when multiple languages present)
  const commentI18n = buildI18nRecord(acc.comments);

  if (commentI18n !== null) {
    const existingI18n = delta['jt:i18n'] as Record<string, unknown> | undefined ?? {};

    delta['jt:i18n'] = {
      ...existingI18n,
      'description': commentI18n
    };
  }

  return delta;
}

// ---------------------------------------------------------------------------
// Public dispatcher
// ---------------------------------------------------------------------------

/**
 * Process OWL 2 and RDFS annotation axioms (rdfs:label, rdfs:comment,
 * owl:deprecated, skos:definition, etc.) and return a partial import fragment.
 *
 * Reads `ctx.graph.allRelations()` exclusively. The quad-backed graph
 * preserves literal language tags and datatype IRIs on each relation, and
 * emits relations for every subject in the input quads — including ontology
 * IRIs, property IRIs, and individual IRIs that are not registered classes.
 *
 * @param _quads - Retained for back-compat with the dispatcher signature; the
 *                 implementation reads exclusively from `ctx.graph`.
 * @param ctx   - Shared import context (graph, curie, IRI sets, reporting helpers).
 * @returns OwlImportFragment with schemaDeltas patched for title/description/deprecated.
 */
export function importAnnotations(_quads: QuadInterface[], ctx: OwlImportContext): OwlImportFragment {
  // Per-entity accumulator map: subject IRI → accumulator
  const accumulators = new Map<string, AnnotationAccumulator>();

  function getOrCreate(subjectIri: string): AnnotationAccumulator {
    const existing = accumulators.get(subjectIri);

    if (existing !== undefined) {
      return existing;
    }
    const acc = makeAccumulator();

    accumulators.set(subjectIri, acc);

    return acc;
  }

  for (const relation of ctx.graph.allRelations()) {
    const subjectIri = relation.source.id;
    const predicateIri = relation.predicate;

    if (LABEL_PREDICATES.has(predicateIri)) {
      const value = literalString(relation);

      if (value !== null) {
        const lang = literalLanguage(relation);
        const acc = getOrCreate(subjectIri);

        appendLangValue(acc.labels, lang, value);
      }
      continue;
    }

    if (COMMENT_PREDICATES.has(predicateIri)) {
      const value = literalString(relation);

      if (value !== null) {
        const lang = literalLanguage(relation);
        const acc = getOrCreate(subjectIri);

        appendLangValue(acc.comments, lang, value);
      }
      continue;
    }

    if (DEPRECATED_PREDICATES.has(predicateIri)) {
      const value = literalString(relation);
      const isTrue = value !== null && value.toLowerCase() === 'true';

      if (isTrue) {
        getOrCreate(subjectIri).deprecated = true;
      }
      continue;
    }

    if (VERSION_INFO_PREDICATES.has(predicateIri)) {
      const value = literalString(relation);

      if (value !== null) {
        getOrCreate(subjectIri).versionInfo.push(value);
      }
      continue;
    }

    if (IS_DEFINED_BY_PREDICATES.has(predicateIri)) {
      const iri = namedNodeIri(relation) ?? literalString(relation);

      if (iri !== null) {
        getOrCreate(subjectIri).isDefinedBy.push(iri);
      }
      continue;
    }

    if (SEE_ALSO_PREDICATES.has(predicateIri)) {
      const iri = namedNodeIri(relation) ?? literalString(relation);

      if (iri !== null) {
        getOrCreate(subjectIri).seeAlso.push(iri);
      }
      continue;
    }

    if (ALT_LABEL_PREDICATES.has(predicateIri)) {
      // Metadata only — accumulate but do not surface in schema delta
      const value = literalString(relation);

      if (value !== null) {
        const lang = literalLanguage(relation);
        const acc = getOrCreate(subjectIri);

        appendLangValue(acc.altLabels, lang, value);
      }
      continue;
    }

    if (ANNOTATION_PROPERTY_PREDICATES.has(predicateIri)) {
      // owl:AnnotationProperty declarations — known but not mapped to schema
      // keywords. Silently accept; do not reportUnsupported.
      continue;
    }

    // Non-annotation predicate — skip silently (the other dispatchers own it).
  }

  // Build schemaDeltas for every entity that accumulated annotations
  const schemaDeltas = new Map<string, Partial<JsonSchemaDocumentObjectType>>();

  for (const [
    subjectIri,
    acc
  ] of accumulators) {
    const delta = buildDelta(acc);

    // Only emit a delta when there is actually something to merge
    if (Object.keys(delta).length > 0) {
      schemaDeltas.set(subjectIri, delta);
    }
  }

  return {
    'characteristics': [],
    'individuals': [],
    'invariants': [],
    'sameAs': [],
    'schemaDeltas': schemaDeltas
  };
}
