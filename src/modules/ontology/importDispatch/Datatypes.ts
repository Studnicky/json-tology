/**
 * Datatypes dispatcher — OWL 2 §9.4 Datatype Definitions / §4.7 Facet Restrictions
 *
 * Responsible for:
 *   owl:DatatypeDefinition         — named datatype derived from another
 *   rdfs:Datatype declarations      — datatype class declarations
 *   xsd:minLength / xsd:maxLength  — string length facets
 *   xsd:minInclusive / xsd:maxInclusive / xsd:minExclusive / xsd:maxExclusive — numeric facets
 *   xsd:pattern                    — regex facets
 *   xsd:totalDigits / xsd:fractionDigits — decimal facets
 *
 * Bucket strategy: structural (facet restrictions produce schemaDeltas patches —
 * `minLength`, `maxLength`, `pattern`, `minimum`, `maximum`, etc. — on the
 * schema node that maps to the datatype IRI).
 *
 * Graph-native traversal: walks `ctx.graph.relationsForSubject(datatypeIri)`
 * for the datatype subject, `ctx.graph.collectList(head)` for
 * `owl:withRestrictions` and `owl:oneOf` lists, and
 * `ctx.graph.relationsForSubject(facetBnode)` to read each blank-node
 * facet descriptor's xsd:* predicate. Literal language/datatype tags are
 * preserved on relations and list items.
 */

import type { QuadInterface } from '../../../interfaces/QuadInterface.js';
import type {
  OwlImportContextType, OwlImportFragmentType
} from '../../../types/OwlImport.js';
import type {
  ListItemType,
  SchemaGraphRelationType
} from '../../../types/SchemaGraph.js';
import type { SchemaGraphInterface } from '../../../interfaces/SchemaGraphInterface.js';
import type { ExtractFacetOptionsType } from '../../../types/ExtractFacetOptionsType.js';
import type { ApplyRestrictionsOptionsType } from '../../../types/ApplyRestrictionsOptionsType.js';
import { Terms } from '../../quads/Terms.js';
import type { JsonSchemaDocumentObjectType } from '../../../types/Schema.js';
import { FACET_MAP } from '../../../constants/XSD_FACETS.js';
import { XSD_TO_SCHEMA_TYPE } from '../../../constants/XSD_REVERSE_MAPS.js';
import {
  EQUIVALENT_CLASS_PREDICATES,
  JT_FORMAT_IRIS,
  JT_MULTIPLE_OF_IRIS,
  ONE_OF_IRIS,
  OWL_ON_DATATYPE_IRIS,
  OWL_WITH_RESTRICTIONS_IRIS,
  RDF_TYPE_PREDICATES,
  RDFS_DATATYPE_IRIS
} from '../../../constants/ONTOLOGY_PREDICATES.js';
import { DECIMAL_RADIX } from '../../../constants/FORMAT_VALIDATION.js';
import { ImportRelation } from './ImportRelation.js';

// ---------------------------------------------------------------------------
// XSD facet predicate → JSON Schema keyword mapping and XSD base type mapping
// are imported from src/constants/XSD_FACETS.ts and src/constants/XSD_REVERSE_MAPS.ts.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Facet kind handlers — one per descriptor.kind
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Public dispatcher
// ---------------------------------------------------------------------------

/**
 * Process OWL 2 datatype definition axioms and XSD facet restrictions, returning
 * a partial import fragment.
 *
 * Handles:
 * - `rdfs:Datatype` declarations → named datatype schema (keyed by datatype IRI)
 * - `owl:onDatatype` → JSON Schema `type` from XSD base type
 * - `owl:withRestrictions` list → XSD facets mapped to JSON Schema keywords
 * - `owl:equivalentClass` + `owl:oneOf` of literals → enum datatype
 *
 * Graph-native: walks `ctx.graph.allRelations()` to discover `rdfs:Datatype`
 * subjects via `rdf:type`, then `ctx.graph.relationsForSubject(datatypeIri)`
 * for facet predicates and `ctx.graph.collectList(head)` for the
 * `owl:withRestrictions` / `owl:oneOf` RDF lists.
 *
 * @param _quads - Retained for back-compat with the dispatcher signature; the
 *                 implementation reads exclusively from `ctx.graph`.
 * @param ctx   - Shared import context (graph, curie, IRI sets, reporting helpers).
 * @returns OwlImportFragmentType with schemaDeltas populated.
 *
 * @remarks
 * Implements OWL 2 §9.4 Datatype Definitions and §4.7 Facet Restrictions.
 * Each datatype IRI found via `rdf:type rdfs:Datatype` is processed
 * independently. XSD facets are mapped to JSON Schema keywords via the
 * `FACET_MAP` constant; unsupported predicates are passed to
 * `ctx.reportUnsupported`. The `jt:multipleOf` and `jt:format` extension
 * predicates are also honoured.
 *
 * @example
 * ```ts
 * const fragment = Datatypes.dispatch(quads, ctx);
 * // fragment.schemaDeltas maps datatype IRI → { type, minLength, pattern, … }
 * ```
 *
 * @category OWL Import
 * @since 0.1.0
 * @see OwlImportContextType
 * @group importDispatch
 */
export class Datatypes {
  /**
   * Apply `owl:equivalentClass [ owl:oneOf [...] ]` → enum datatype.
   */
  private static applyEquivClassEnum(
    subjectIri: string,
    graph: SchemaGraphInterface,
    delta: Record<string, unknown>
  ): void {
    const equivClass = ImportRelation.byPredicate(graph, subjectIri, EQUIVALENT_CLASS_PREDICATES);

    for (const ec of equivClass) {
      if (ec.termType !== 'BlankNode') {
        continue;
      }
      Datatypes.applyOneOfEnum(ImportRelation.targetValue(ec), graph, delta);
    }
  }

  /**
   * Apply jt:multipleOf and jt:format extension annotations.
   */
  private static applyExtensionAnnotations(
    subjectIri: string,
    graph: SchemaGraphInterface,
    delta: Record<string, unknown>
  ): void {
    const multipleOf = ImportRelation.byPredicate(graph, subjectIri, JT_MULTIPLE_OF_IRIS);
    const firstMultipleOf = multipleOf[0];

    if (firstMultipleOf !== undefined) {
      const moNumber = Datatypes.literalNumber(firstMultipleOf);

      if (moNumber !== null) {
        delta.multipleOf = moNumber;
      }
    }

    const formatRels = ImportRelation.byPredicate(graph, subjectIri, JT_FORMAT_IRIS);
    const firstFormatRel = formatRels[0];

    if (firstFormatRel !== undefined) {
      const formatString = ImportRelation.literalString(firstFormatRel);

      if (formatString !== null) {
        delta.format = formatString;
      }
    }
  }

  /**
   * Apply a single facet relation to the delta record.
   */
  private static applyFacetRelation(options: { 'bnodeId': string
    'delta': Record<string, unknown>;
    'fr': SchemaGraphRelationType;
    'reportUnsupported': (axiomIri: string, subjectIri: null | string) => void; }): void {
    const {
      bnodeId, delta, fr, reportUnsupported
    } = options;
    const facetPred = fr.predicate;
    const descriptor = FACET_MAP.get(facetPred);

    if (descriptor === undefined) {
      reportUnsupported(facetPred, bnodeId);

      return;
    }

    switch (descriptor.kind) {
      case 'fractionDigits':
        Datatypes.applyFractionDigits(fr, delta);
        break;
      case 'ignore':
        break;
      case 'length':
        Datatypes.applyLengthFacet(fr, delta);
        break;
      case 'numeric':
        Datatypes.applyNumericFacet(fr, delta, descriptor.key);
        break;
      case 'string':
        Datatypes.applyStringFacet(fr, delta, descriptor.key);
        break;
      case 'unsupported':
        reportUnsupported(descriptor.predicate, bnodeId);
        break;
    }
  }

  /** Apply a `fractionDigits` facet: multipleOf = 10^-n. */
  private static applyFractionDigits(fr: SchemaGraphRelationType, delta: Record<string, unknown>): void {
    const number = Datatypes.literalNumber(fr);

    if (number !== null && number >= 0) {
      delta.multipleOf = Math.pow(DECIMAL_RADIX, -number);
    }
  }

  /** Apply a `length` facet: minLength = maxLength = n. */
  private static applyLengthFacet(fr: SchemaGraphRelationType, delta: Record<string, unknown>): void {
    const number = Datatypes.literalNumber(fr);

    if (number !== null) {
      delta.minLength = number;
      delta.maxLength = number;
    }
  }

  /** Apply a `numeric` facet: delta[key] = n. */
  private static applyNumericFacet(
    fr: SchemaGraphRelationType,
    delta: Record<string, unknown>,
    key: string
  ): void {
    const number = Datatypes.literalNumber(fr);

    if (number !== null) {
      delta[key] = number;
    }
  }

  /**
   * Apply `owl:onDatatype` → JSON Schema `type` from XSD base type.
   */
  private static applyOnDatatype(
    subjectIri: string,
    graph: SchemaGraphInterface,
    delta: Record<string, unknown>
  ): 'boolean' | 'integer' | 'number' | 'string' | undefined {
    const onDatatype = ImportRelation.byPredicate(graph, subjectIri, OWL_ON_DATATYPE_IRIS);
    const firstOnDatatype = onDatatype[0];

    if (firstOnDatatype?.termType !== 'NamedNode') {
      return undefined;
    }

    const onDt = ImportRelation.targetValue(firstOnDatatype);
    const mappedType = XSD_TO_SCHEMA_TYPE.get(onDt);

    if (mappedType !== undefined) {
      delta.type = mappedType;
    }

    return mappedType;
  }

  /** Apply enum values from one equivalentClass bnode's oneOf list. */
  private static applyOneOfEnum(
    equivBnode: string,
    graph: SchemaGraphInterface,
    delta: Record<string, unknown>
  ): void {
    const oneOfRelations = ImportRelation.byPredicate(graph, equivBnode, ONE_OF_IRIS);

    for (const oo of oneOfRelations) {
      const enumValues = Datatypes.extractEnumValues(ImportRelation.targetValue(oo), graph);

      if (enumValues.length > 0) {
        delta.enum = enumValues;

        if (!('type' in delta)) {
          const inferred = Datatypes.inferEnumType(enumValues);

          if (inferred !== undefined) {
            delta.type = inferred;
          }
        }
      }
    }
  }

  /** Apply a `string` facet: delta[key] = str. */
  private static applyStringFacet(
    fr: SchemaGraphRelationType,
    delta: Record<string, unknown>,
    key: string
  ): void {
    const string = ImportRelation.literalString(fr);

    if (string !== null) {
      delta[key] = string;
    }
  }

  /**
   * Apply `owl:withRestrictions` facet list to the delta.
   */
  private static applyWithRestrictions(options: ApplyRestrictionsOptionsType): void {
    const {
      delta, graph, reportUnsupported, schemaType, subjectIri
    } = options;
    const withRestrictions = ImportRelation.byPredicate(graph, subjectIri, OWL_WITH_RESTRICTIONS_IRIS);

    for (const wr of withRestrictions) {
      const listHead = ImportRelation.targetValue(wr);
      const items = graph.collectList(listHead);

      for (const item of items) {
        if (item.termType === 'BlankNode') {
          const facetDelta = Datatypes.extractFacetFromBnode({
            'bnodeId': item.target,
            graph,
            reportUnsupported,
            schemaType
          });

          Object.assign(delta, facetDelta);
        }
      }
    }
  }

  /** Decode a Literal ListItemType back to its typed JS value. */
  private static decodeListItemLiteral(item: ListItemType): unknown {
    const literalTerm = Terms.literal(item.target, {
      'datatype': Terms.iri(item.datatype ?? ''),
      'language': item.language ?? ''
    });

    return Terms.decodeLiteral(literalTerm);
  }

  public static dispatch(_quads: QuadInterface[], context: OwlImportContextType): OwlImportFragmentType {
    const graph = context.graph;
    const datatypeIris = new Set<string>();

    for (const relation of graph.allRelations()) {
      if (
        RDF_TYPE_PREDICATES.has(relation.predicate)
        && relation.termType === 'NamedNode'
        && RDFS_DATATYPE_IRIS.has(ImportRelation.targetValue(relation))
        && !relation.source.id.startsWith('_:')
      ) {
        datatypeIris.add(relation.source.id);
      }
    }

    if (datatypeIris.size === 0) {
      return Datatypes.emptyFragment();
    }

    const schemaDeltas = new Map<string, JsonSchemaDocumentObjectType>();

    for (const datatypeIri of datatypeIris) {
      const delta = Datatypes.resolveDatatypeIri(datatypeIri, graph, context.reportUnsupported);

      schemaDeltas.set(datatypeIri, delta);
    }

    return {
      'characteristics': [],
      'differentFrom': [],
      'individuals': [],
      'invariants': [],
      'sameAs': [],
      schemaDeltas
    };
  }

  /** Return an empty OwlImportFragmentType with all buckets initialised. */
  private static emptyFragment(): OwlImportFragmentType {
    return {
      'characteristics': [],
      'differentFrom': [],
      'individuals': [],
      'invariants': [],
      'sameAs': [],
      'schemaDeltas': new Map()
    };
  }

  /**
   * Extract enum values from an RDF list head (owl:oneOf of literals or IRIs).
   *
   * - Literal item → typed JS value via Terms.decodeLiteral.
   * - NamedNode item → IRI string.
   * - BlankNode enum members are not standard OWL 2 — skipped.
   */
  private static extractEnumValues(listHead: string, graph: SchemaGraphInterface): unknown[] {
    const items = graph.collectList(listHead);
    const values: unknown[] = [];

    for (const item of items) {
      if (item.termType === 'Literal') {
        values.push(Datatypes.decodeListItemLiteral(item));
      } else if (item.termType === 'NamedNode') {
        values.push(item.target);
      }
    }

    return values;
  }

  /**
   * Given a blank-node id from the `owl:withRestrictions` list, walk its
   * outgoing relations via `graph.relationsForSubject` and convert each XSD
   * facet predicate to a JSON Schema keyword patch.
   *
   * Multiple predicates on one blank node are all applied.
   */
  private static extractFacetFromBnode(options: ExtractFacetOptionsType): JsonSchemaDocumentObjectType {
    const {
      bnodeId, graph, reportUnsupported
    } = options;
    const delta: Record<string, unknown> = {};
    const bnodeRelations = graph.relationsForSubject(bnodeId);

    for (const fr of bnodeRelations) {
      Datatypes.applyFacetRelation({
        bnodeId,
        delta,
        fr,
        reportUnsupported
      });
    }

    return delta;
  }

  /**
   * Infer the JSON Schema type from a homogeneous array of enum values.
   * Returns undefined when the array is empty or heterogeneous.
   */
  private static inferEnumType(values: unknown[]): 'boolean' | 'integer' | 'number' | 'string' | undefined {
    if (values.length === 0) {
      return undefined;
    }

    let seenType: 'boolean' | 'integer' | 'number' | 'string' | undefined;

    for (const value of values) {
      const valueType = Datatypes.inferValueType(value);

      if (seenType === undefined) {
        seenType = valueType;
        continue;
      }

      if (seenType === valueType) {
        continue;
      }

      const promoted = Datatypes.promoteNumericTypes(seenType, valueType);

      if (promoted === undefined) {
        return undefined;
      }
      seenType = promoted;
    }

    return seenType;
  }

  /** Infer the JSON Schema primitive type for a single value. */
  private static inferValueType(value: unknown): 'boolean' | 'integer' | 'number' | 'string' {
    if (typeof value === 'boolean') {
      return 'boolean';
    }
    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'integer' : 'number';
    }

    return 'string';
  }

  /**
   * Extract a number from a Literal-typed relation target.
   * Returns null when the target is not a Literal or not numeric.
   */
  private static literalNumber(relation: SchemaGraphRelationType): null | number {
    if (relation.termType !== 'Literal') {
      return null;
    }
    const raw = ImportRelation.targetValue(relation);
    const number = Number(raw);

    return Number.isFinite(number) ? number : null;
  }

  /** Promote two numeric types when they are compatible (integer/number blend). */
  private static promoteNumericTypes(
    first: 'boolean' | 'integer' | 'number' | 'string',
    second: 'boolean' | 'integer' | 'number' | 'string'
  ): 'number' | undefined {
    if ((first === 'integer' && second === 'number') || (first === 'number' && second === 'integer')) {
      return 'number';
    }

    return undefined;
  }

  /**
   * Process a single `rdfs:Datatype` subject and return its schema delta.
   */
  private static resolveDatatypeIri(
    subjectIri: string,
    graph: SchemaGraphInterface,
    reportUnsupported: (axiomIri: string, subjectIri: null | string) => void
  ): JsonSchemaDocumentObjectType {
    const delta: Record<string, unknown> = {};

    const schemaType = Datatypes.applyOnDatatype(subjectIri, graph, delta);

    Datatypes.applyWithRestrictions({
      delta,
      graph,
      reportUnsupported,
      schemaType,
      subjectIri
    });
    Datatypes.applyEquivClassEnum(subjectIri, graph, delta);
    Datatypes.applyExtensionAnnotations(subjectIri, graph, delta);

    return delta;
  }
}
