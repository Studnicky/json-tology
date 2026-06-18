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

import type { QuadInterface } from '../../../interfaces/QuadInterface.js';
import type {
  OwlImportContextType, OwlImportFragmentType
} from '../../../types/OwlImport.js';
import type { SchemaGraphRelationType } from '../../../types/SchemaGraph.js';
import type { AnnotationAccumulatorType } from '../../../types/AnnotationAccumulatorType.js';
import {
  ALT_LABEL_PREDICATES,
  ANNOTATION_PROPERTY_PREDICATES,
  COMMENT_PREDICATES,
  DEPRECATED_PREDICATES,
  IS_DEFINED_BY_PREDICATES,
  LABEL_PREDICATES,
  SEE_ALSO_PREDICATES,
  VERSION_INFO_PREDICATES
} from '../../../constants/ONTOLOGY_PREDICATES.js';
import { ImportRelation } from './ImportRelation.js';

// ---------------------------------------------------------------------------
// Relation-target extraction helpers — read from graph relations
// ---------------------------------------------------------------------------

/**
 * Extract the language tag of a Literal-typed relation target.
 * Returns the empty string for untagged literals or non-literal targets.
 */
function literalLanguage(relation: SchemaGraphRelationType): string {
  if (relation.termType !== 'Literal') {
    return '';
  }

  return relation.language ?? '';
}

// ---------------------------------------------------------------------------
// Accumulator factory
// ---------------------------------------------------------------------------

function makeAccumulator(): AnnotationAccumulatorType {
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
  const taggedKeys = [...map.keys()].filter((k: string): boolean => {
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
// Delta builder helpers
// ---------------------------------------------------------------------------

/** Apply title and description fields to a delta record from accumulators. */
function applyLabelFields(delta: Record<string, unknown>, acc: AnnotationAccumulatorType): void {
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
}

/** Build the $comment string from versionInfo, isDefinedBy, and seeAlso arrays. */
function buildCommentString(acc: AnnotationAccumulatorType): string {
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

  return commentParts.join('; ');
}

/** Apply i18n label and description records to a delta. */
function applyI18nFields(delta: Record<string, unknown>, acc: AnnotationAccumulatorType): void {
  const labelI18n = buildI18nRecord(acc.labels);

  if (labelI18n !== null) {
    delta['jt:i18n'] = {
      ...delta['jt:i18n'] as Record<string, unknown> | undefined,
      'label': labelI18n
    };
  }

  const commentI18n = buildI18nRecord(acc.comments);

  if (commentI18n !== null) {
    const existingI18n = delta['jt:i18n'] as Record<string, unknown> | undefined ?? {};

    delta['jt:i18n'] = {
      ...existingI18n,
      'description': commentI18n
    };
  }
}

// ---------------------------------------------------------------------------
// Delta builder
// ---------------------------------------------------------------------------

/**
 * Convert an AnnotationAccumulatorType into a partial schema delta.
 */
function buildDelta(acc: AnnotationAccumulatorType): Record<string, unknown> {
  const delta: Record<string, unknown> = {};

  applyLabelFields(delta, acc);

  const commentStr = buildCommentString(acc);

  if (commentStr !== '') {
    delta.$comment = commentStr;
  }

  applyI18nFields(delta, acc);

  return delta;
}

// ---------------------------------------------------------------------------
// importAnnotations — relation processing helpers
// ---------------------------------------------------------------------------

/** Get or create an AnnotationAccumulatorType for a subject IRI. */
function getOrCreateAccumulator(
  accumulators: Map<string, AnnotationAccumulatorType>,
  subjectIri: string
): AnnotationAccumulatorType {
  const existing = accumulators.get(subjectIri);

  if (existing !== undefined) {
    return existing;
  }
  const acc = makeAccumulator();

  accumulators.set(subjectIri, acc);

  return acc;
}

/** Process a single label relation and append to the accumulator. */
function applyLabelRelation(
  relation: SchemaGraphRelationType,
  acc: AnnotationAccumulatorType
): void {
  const value = ImportRelation.literalString(relation);

  if (value !== null) {
    appendLangValue(acc.labels, literalLanguage(relation), value);
  }
}

/** Process a single comment relation and append to the accumulator. */
function applyCommentRelation(
  relation: SchemaGraphRelationType,
  acc: AnnotationAccumulatorType
): void {
  const value = ImportRelation.literalString(relation);

  if (value !== null) {
    appendLangValue(acc.comments, literalLanguage(relation), value);
  }
}

/** Dispatch one relation to the appropriate accumulator update based on predicate sets. */
function dispatchLiteralRelation(
  relation: SchemaGraphRelationType,
  predicateIri: string,
  acc: AnnotationAccumulatorType
): void {
  if (LABEL_PREDICATES.has(predicateIri)) {
    applyLabelRelation(relation, acc);

    return;
  }
  if (COMMENT_PREDICATES.has(predicateIri)) {
    applyCommentRelation(relation, acc);

    return;
  }
  if (DEPRECATED_PREDICATES.has(predicateIri)) {
    const value = ImportRelation.literalString(relation);

    if (value !== null && value.toLowerCase() === 'true') {
      acc.deprecated = true;
    }

    return;
  }
  if (VERSION_INFO_PREDICATES.has(predicateIri)) {
    const value = ImportRelation.literalString(relation);

    if (value !== null) {
      acc.versionInfo.push(value);
    }
  }
}

/** Dispatch one relation to accumulate IRI-typed annotation values. */
function dispatchIriRelation(
  relation: SchemaGraphRelationType,
  predicateIri: string,
  acc: AnnotationAccumulatorType
): void {
  if (IS_DEFINED_BY_PREDICATES.has(predicateIri)) {
    const iri = ImportRelation.namedNodeIri(relation) ?? ImportRelation.literalString(relation);

    if (iri !== null) {
      acc.isDefinedBy.push(iri);
    }

    return;
  }
  if (SEE_ALSO_PREDICATES.has(predicateIri)) {
    const iri = ImportRelation.namedNodeIri(relation) ?? ImportRelation.literalString(relation);

    if (iri !== null) {
      acc.seeAlso.push(iri);
    }

    return;
  }
  if (ALT_LABEL_PREDICATES.has(predicateIri)) {
    const value = ImportRelation.literalString(relation);

    if (value !== null) {
      appendLangValue(acc.altLabels, literalLanguage(relation), value);
    }
  }
}

/** Dispatch one graph relation to the matching accumulator update. */
function dispatchRelation(
  relation: SchemaGraphRelationType,
  accumulators: Map<string, AnnotationAccumulatorType>
): void {
  const predicateIri = relation.predicate;

  // owl:AnnotationProperty declarations — silently accepted, no schema field.
  if (ANNOTATION_PROPERTY_PREDICATES.has(predicateIri)) {
    return;
  }

  const subjectIri = relation.source.id;
  const acc = getOrCreateAccumulator(accumulators, subjectIri);

  dispatchLiteralRelation(relation, predicateIri, acc);
  dispatchIriRelation(relation, predicateIri, acc);
}

/** Process all graph relations and populate the accumulator map. */
function collectAnnotations(
  ctx: OwlImportContextType,
  accumulators: Map<string, AnnotationAccumulatorType>
): void {
  for (const relation of ctx.graph.allRelations()) {
    dispatchRelation(relation, accumulators);
  }
}

/** Build the schemaDeltas map from populated accumulators. */
function buildSchemaDeltas(accumulators: Map<string, AnnotationAccumulatorType>): Map<string, Record<string, unknown>> {
  const schemaDeltas = new Map<string, Record<string, unknown>>();

  for (const [
    subjectIri,
    acc
  ] of accumulators) {
    const delta = buildDelta(acc);

    if (Object.keys(delta).length > 0) {
      schemaDeltas.set(subjectIri, delta);
    }
  }

  return schemaDeltas;
}

// ---------------------------------------------------------------------------
// Public dispatcher
// ---------------------------------------------------------------------------

/**
 * Process OWL 2 and RDFS annotation axioms (rdfs:label, rdfs:comment,
 * owl:deprecated, skos:definition, etc.) and return a partial import fragment.
 *
 * @remarks
 * Reads `ctx.graph.allRelations()` exclusively. The quad-backed graph
 * preserves literal language tags and datatype IRIs on each relation, and
 * emits relations for every subject in the input quads — including ontology
 * IRIs, property IRIs, and individual IRIs that are not registered classes.
 *
 * @example
 * ```ts
 * const fragment = Annotations.dispatch(quads, ctx);
 * ```
 *
 * @param _quads - Retained for back-compat with the dispatcher signature; the
 *                 implementation reads exclusively from `ctx.graph`.
 * @param ctx   - Shared import context (graph, curie, IRI sets, reporting helpers).
 * @returns OwlImportFragmentType with schemaDeltas patched for title/description/deprecated.
 *
 * @category OWL Import
 * @since 0.18.0
 * @see {@link OwlImportFragmentType}
 * @group OWL Import
 */
export class Annotations {
  public static dispatch(_quads: QuadInterface[], ctx: OwlImportContextType): OwlImportFragmentType {
    const accumulators = new Map<string, AnnotationAccumulatorType>();

    collectAnnotations(ctx, accumulators);

    return {
      'characteristics': [],
      'differentFrom': [],
      'individuals': [],
      'invariants': [],
      'sameAs': [],
      'schemaDeltas': buildSchemaDeltas(accumulators)
    };
  }
}
