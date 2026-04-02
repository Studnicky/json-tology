/**
 * OwlProjection — projects SchemaGraph relations into OWL-vocabulary quads.
 *
 * Iterates graph.allRelations() and emits complete OWL patterns:
 * owl:Class, owl:DatatypeProperty/ObjectProperty, owl:Restriction,
 * owl:unionOf/intersectionOf for conditionals, owl:someValuesFrom for
 * contains, etc.
 *
 * Property IRI canonicalization (pointer → Class#name) happens here.
 * The output quads can be passed directly to JsonLdFormatter.quadsToJsonLd().
 */

import type { QuadInterface } from '../../interfaces/Quad.js';
import type { QuadObjectType } from '../../types/Quad.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';
import type { CurieInterface } from '../../interfaces/Curie.js';
import {
  DASH, DCT, JT, OWL, RDF, RDFS, SH, XSD
} from '../../constants/IRI.js';
import { resolveSingleXsdType } from '../../constants/XSD_MAPS.js';
import {
  fragmentContains, isPropertySubject, lastSegment,
  propertyIri, splitSubject, structuralParent
} from '../graph/SchemaIri.js';
import {
  bnode, emitLiterals, iri, literal, nextBnode, quad, rdfList
} from './QuadFactory.js';
import {
  buildIndex, isListStructure, isRestrictionStructure,
  relationTargetId
} from './ProjectionIndex.js';
import type { RelationIndexInterface } from '../../interfaces/RelationIndex.js';

function emitRestriction(
  onProperty: string,
  constraint: string,
  constraintValue: QuadObjectType,
  quads: QuadInterface[],
  curie?: CurieInterface
): string {
  const rBnode = nextBnode();

  quads.push(quad(rBnode, RDF.type, iri(OWL.Restriction, curie), curie));
  quads.push(quad(rBnode, OWL.onProperty, iri(onProperty, curie), curie));
  quads.push(quad(rBnode, constraint, constraintValue, curie));

  return rBnode;
}

function canonicalPropertyIri(subject: string): string {
  const parts = splitSubject(subject);

  if (parts.fragment === null) {
    return subject;
  }

  const propName = lastSegment(subject);
  const propsIdx = parts.fragment.lastIndexOf('/properties/');

  if (propsIdx === -1) {
    return propertyIri(parts.base, propName);
  }

  const parentPointer = parts.fragment.slice(0, propsIdx);
  const parentId = parentPointer === '' ? parts.base : `${parts.base}#${parentPointer}`;

  return propertyIri(parentId, propName);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function projectOwlGraph(graph: SchemaGraphInterface, curie?: CurieInterface): QuadInterface[] {
  const quads: QuadInterface[] = [];
  const allRelations = graph.allRelations();
  const index = buildIndex(allRelations);

  // First pass: class nodes and property nodes
  for (const [
    sourceId,
    entry
  ] of index) {
    if (sourceId.startsWith('_:')) {
      continue;
    }

    if (entry.types.includes(OWL.Class)) {
      emitClassQuads(sourceId, entry, index, quads, curie);
    }

    if (entry.types.includes(OWL.DatatypeProperty) || entry.types.includes(OWL.ObjectProperty)) {
      emitPropertyQuads(sourceId, entry, quads, curie);
    }
  }

  return quads;
}

// ---------------------------------------------------------------------------
// Class node emission
// ---------------------------------------------------------------------------

function emitClassQuads(
  subject: string,
  entry: RelationIndexInterface,
  index: Map<string, RelationIndexInterface>,
  quads: QuadInterface[],
  curie?: CurieInterface
): void {
  quads.push(quad(subject, RDF.type, iri(OWL.Class, curie), curie));

  // rdfs:label
  emitLiterals(subject, entry, RDFS.label, RDFS.label, quads, curie);

  // rdfs:comment
  emitLiterals(subject, entry, RDFS.comment, RDFS.comment, quads, curie);

  // owl:deprecated
  const deprecated = entry.byPredicate.get(OWL.deprecated);

  if (deprecated !== undefined) {
    quads.push(quad(subject, OWL.deprecated, literal(true, XSD.boolean, curie), curie));
  }

  // rdfs:subClassOf — IRI targets
  const subClassRels = entry.byPredicate.get(RDFS.subClassOf) ?? [];

  for (const rel of subClassRels) {
    quads.push(quad(subject, RDFS.subClassOf, iri(relationTargetId(rel), curie), curie));
  }

  // rdfs:subClassOf — restrictions (owl:Restriction predicate)
  const restrictionRels = entry.byPredicate.get(OWL.Restriction) ?? [];

  for (const rel of restrictionRels) {
    const meta = rel.metadata ?? {};
    const onProperty = typeof meta.onProperty === 'string' ? meta.onProperty : '';
    const minCard = typeof meta.minCardinality === 'number' ? meta.minCardinality : 1;

    const minCardLit = literal(minCard, XSD.nonNegativeInteger, curie);
    const rBnode = emitRestriction(onProperty, OWL.minCardinality, minCardLit, quads, curie);

    quads.push(quad(subject, RDFS.subClassOf, bnode(rBnode), curie));
  }

  // owl:equivalentClass
  const equivRels = entry.byPredicate.get(OWL.equivalentClass) ?? [];

  if (equivRels.length > 0) {
    const eqBnode = nextBnode();

    quads.push(quad(subject, OWL.equivalentClass, bnode(eqBnode), curie));
    quads.push(quad(eqBnode, RDF.type, iri(OWL.Class, curie), curie));
    quads.push(quad(eqBnode, OWL.unionOf, rdfList(equivRels.map((rel) => {
      return iri(relationTargetId(rel), curie);
    }), curie), curie));
  }

  // owl:complementOf
  const complementRels = entry.byPredicate.get(OWL.complementOf) ?? [];

  if (complementRels.length > 0) {
    quads.push(quad(subject, OWL.complementOf, iri(relationTargetId(complementRels[0]), curie), curie));
  }

  // owl:disjointWith
  const disjointRels = entry.byPredicate.get(OWL.disjointWith) ?? [];

  if (disjointRels.length > 0) {
    quads.push(quad(subject, OWL.disjointWith, iri(relationTargetId(disjointRels[0]), curie), curie));
  }

  // owl:oneOf from enum values
  const oneOfRels = entry.byPredicate.get(OWL.oneOf) ?? [];

  if (oneOfRels.length > 0) {
    const typedLiterals = oneOfRels.map((rel) => {
      const val = relationTargetId(rel);

      return literal(typedLiteralObject(val), RDF.JSON, curie);
    });

    quads.push(quad(subject, OWL.oneOf, rdfList(typedLiterals, curie), curie));
  }

  // owl:oneOf from const (owl:hasValue) — only if no enum
  if (oneOfRels.length === 0) {
    const hasValueRels = entry.byPredicate.get(OWL.hasValue) ?? [];

    if (hasValueRels.length > 0) {
      const val = relationTargetId(hasValueRels[0]);

      quads.push(quad(subject, OWL.oneOf, rdfList([literal(typedLiteralObject(val), RDF.JSON, curie)], curie), curie));
    }
  }

  // Conditionals (structured relations with kind: 'conditional')
  emitConditionalQuads(subject, entry, quads, curie);

  // DependentRequired
  emitDependentRequiredQuads(subject, entry, quads, curie);

  // Contains (owl:someValuesFrom structured relations)
  emitContainsQuads(subject, entry, quads, curie);

  // PrefixItems
  emitPrefixItemQuads(subject, entry, quads, curie);

  // Array item restrictions
  emitArrayItemQuads(subject, index, quads, curie);

  // Pattern properties
  emitPatternPropertyQuads(subject, entry, index, quads, curie);
}

function typedLiteralObject(value: unknown): null | Record<string, unknown> {
  const jsType = typeof value;

  if (jsType === 'string' || jsType === 'boolean') {
    return {
      '@type': resolveSingleXsdType(String(jsType)),
      '@value': value
    };
  }

  if (jsType === 'number') {
    const schemaType = Number.isInteger(value as number) ? 'integer' : 'number';

    return {
      '@type': resolveSingleXsdType(schemaType),
      '@value': value
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Property node emission
// ---------------------------------------------------------------------------

function emitPropertyQuads(
  subject: string,
  entry: RelationIndexInterface,
  quads: QuadInterface[],
  curie?: CurieInterface
): void {
  if (fragmentContains(subject, '/patternProperties/')) {
    return;
  }

  if (!isPropertySubject(subject)) {
    return;
  }

  const canonicalId = canonicalPropertyIri(subject);

  // rdf:type
  if (entry.types.includes(OWL.ObjectProperty)) {
    quads.push(quad(canonicalId, RDF.type, iri(OWL.ObjectProperty, curie), curie));
  } else if (entry.types.includes(OWL.DatatypeProperty)) {
    quads.push(quad(canonicalId, RDF.type, iri(OWL.DatatypeProperty, curie), curie));
  }

  if (entry.byPredicate.has(OWL.TransitiveProperty)) {
    quads.push(quad(canonicalId, RDF.type, iri(OWL.TransitiveProperty, curie), curie));
  }

  if (entry.byPredicate.has(OWL.SymmetricProperty)) {
    quads.push(quad(canonicalId, RDF.type, iri(OWL.SymmetricProperty, curie), curie));
  }

  // rdfs:domain
  const domainRels = entry.byPredicate.get(RDFS.domain) ?? [];
  const domainId = domainRels.length > 0 ? relationTargetId(domainRels[0]) : '';

  quads.push(quad(canonicalId, RDFS.domain, iri(domainId, curie), curie));

  // rdfs:range
  const hasMaxCount = entry.byPredicate.has(SH.maxCount);
  const rangeRels = entry.byPredicate.get(RDFS.range) ?? [];
  const datatypeRels = entry.byPredicate.get(SH.datatype) ?? [];

  if (!hasMaxCount) {
    // Array property
    quads.push(quad(canonicalId, RDFS.range, iri(RDF.List, curie), curie));
  } else if (rangeRels.length > 0) {
    quads.push(quad(canonicalId, RDFS.range, iri(relationTargetId(rangeRels[0]), curie), curie));
  } else if (datatypeRels.length > 0) {
    quads.push(quad(canonicalId, RDFS.range, iri(relationTargetId(datatypeRels[0]), curie), curie));
  }

  // owl:unionOf (multi-type properties)
  const unionStructured = entry.all.filter((rel) => {
    return rel.predicate === OWL.unionOf && rel.structure?.kind === 'list';
  });

  for (const rel of unionStructured) {
    const structure = rel.structure;

    if (!isListStructure(structure)) {
      continue;
    }
    quads.push(quad(canonicalId, OWL.unionOf, rdfList(structure.members.map((member) => {
      return iri(member, curie);
    }), curie), curie));
  }

  // owl:inverseOf
  const inverseRels = entry.byPredicate.get(OWL.inverseOf) ?? [];

  if (inverseRels.length > 0) {
    quads.push(quad(canonicalId, OWL.inverseOf, iri(relationTargetId(inverseRels[0]), curie), curie));
  }

  // rdfs:comment
  emitLiterals(canonicalId, entry, RDFS.comment, RDFS.comment, quads, curie);

  // readOnly / writeOnly
  if (entry.byPredicate.has(DASH.readOnly)) {
    quads.push(quad(canonicalId, DASH.readOnly, literal(true, XSD.boolean, curie), curie));
  }

  if (entry.byPredicate.has(DASH.writeOnly)) {
    quads.push(quad(canonicalId, DASH.writeOnly, literal(true, XSD.boolean, curie), curie));
  }

  // dct:format
  emitLiterals(canonicalId, entry, DCT.format, DCT.format, quads, curie);
}

// ---------------------------------------------------------------------------
// Conditional emission (if/then/else)
// ---------------------------------------------------------------------------

function emitConditionalQuads(
  subject: string,
  entry: RelationIndexInterface,
  quads: QuadInterface[],
  curie?: CurieInterface
): void {
  for (const rel of entry.all) {
    if (rel.structure?.kind !== 'conditional') {
      continue;
    }

    const {
      elseRef, ifRef, thenRef
    } = rel.structure;

    // Check if this is a dependentSchemas conditional
    if (thenRef?.includes('/dependentSchemas/') === true) {
      emitDependentSchemaImplication(subject, ifRef, thenRef, quads, curie);
      continue;
    }

    // Regular if/then/else → owl:unionOf(intersectionOf(A,B), intersectionOf(¬A,C))
    const branches: QuadObjectType[] = [];

    if (thenRef !== undefined) {
      const branchBnode = nextBnode();

      quads.push(quad(branchBnode, RDF.type, iri(OWL.Class, curie), curie));
      quads.push(quad(branchBnode, OWL.intersectionOf, rdfList([
        iri(ifRef, curie),
        iri(thenRef, curie)
      ], curie), curie));
      branches.push(bnode(branchBnode));
    }

    if (elseRef !== undefined) {
      const complementBnode = nextBnode();

      quads.push(quad(complementBnode, RDF.type, iri(OWL.Class, curie), curie));
      quads.push(quad(complementBnode, OWL.complementOf, iri(ifRef, curie), curie));

      const branchBnode = nextBnode();

      quads.push(quad(branchBnode, RDF.type, iri(OWL.Class, curie), curie));
      quads.push(quad(branchBnode, OWL.intersectionOf, rdfList([
        bnode(complementBnode),
        iri(elseRef, curie)
      ], curie), curie));
      branches.push(bnode(branchBnode));
    }

    if (branches.length > 0) {
      const unionBnode = nextBnode();

      quads.push(quad(unionBnode, RDF.type, iri(OWL.Class, curie), curie));
      quads.push(quad(unionBnode, OWL.unionOf, rdfList(branches, curie), curie));
      quads.push(quad(subject, RDFS.subClassOf, bnode(unionBnode), curie));
    }
  }
}

function emitDependentSchemaImplication(
  classSubject: string,
  triggerPropIri: string,
  schemaRef: string,
  quads: QuadInterface[],
  curie?: CurieInterface
): void {
  // ¬hasTrigger
  const minOne = literal(1, XSD.nonNegativeInteger, curie);
  const restrictionBnode = emitRestriction(triggerPropIri, OWL.minCardinality, minOne, quads, curie);

  const withoutTriggerBnode = nextBnode();

  quads.push(quad(withoutTriggerBnode, RDF.type, iri(OWL.Class, curie), curie));
  quads.push(quad(withoutTriggerBnode, OWL.complementOf, bnode(restrictionBnode), curie));

  // ¬hasTrigger ∨ Schema
  const unionBnode = nextBnode();

  quads.push(quad(unionBnode, RDF.type, iri(OWL.Class, curie), curie));
  quads.push(quad(unionBnode, OWL.unionOf, rdfList([
    bnode(withoutTriggerBnode),
    iri(schemaRef, curie)
  ], curie), curie));
  quads.push(quad(classSubject, RDFS.subClassOf, bnode(unionBnode), curie));
}

// ---------------------------------------------------------------------------
// DependentRequired emission
// ---------------------------------------------------------------------------

function emitDependentRequiredQuads(
  subject: string,
  entry: RelationIndexInterface,
  quads: QuadInterface[],
  curie?: CurieInterface
): void {
  const depReqRels = entry.byPredicate.get(JT.dependentRequired) ?? [];

  for (const rel of depReqRels) {
    const meta = rel.metadata ?? {};
    const trigger = typeof meta.trigger === 'string' ? meta.trigger : '';
    const required = Array.isArray(meta.required) ? meta.required as string[] : [];

    const triggerPropIri = propertyIri(subject, trigger);

    // ¬hasTrigger
    const minOne = literal(1, XSD.nonNegativeInteger, curie);
    const restrictionBnode = emitRestriction(triggerPropIri, OWL.minCardinality, minOne, quads, curie);

    const withoutTriggerBnode = nextBnode();

    quads.push(quad(withoutTriggerBnode, RDF.type, iri(OWL.Class, curie), curie));
    quads.push(quad(withoutTriggerBnode, OWL.complementOf, bnode(restrictionBnode), curie));

    // Required restrictions
    const reqRestrictions: QuadObjectType[] = required.map((reqProp) => {
      const reqPropIri = propertyIri(subject, reqProp);
      const reqBnode = emitRestriction(reqPropIri, OWL.minCardinality, minOne, quads, curie);

      return bnode(reqBnode);
    });

    // Build union: ¬hasTrigger ∨ (hasReq1 ∧ hasReq2 ∧ ...)
    const unionMembers: QuadObjectType[] = [bnode(withoutTriggerBnode)];

    if (reqRestrictions.length === 1) {
      unionMembers.push(reqRestrictions[0]);
    } else {
      const interBnode = nextBnode();

      quads.push(quad(interBnode, RDF.type, iri(OWL.Class, curie), curie));
      quads.push(quad(interBnode, OWL.intersectionOf, rdfList(reqRestrictions, curie), curie));
      unionMembers.push(bnode(interBnode));
    }

    const unionBnode = nextBnode();

    quads.push(quad(unionBnode, RDF.type, iri(OWL.Class, curie), curie));
    quads.push(quad(unionBnode, OWL.unionOf, rdfList(unionMembers, curie), curie));
    quads.push(quad(subject, RDFS.subClassOf, bnode(unionBnode), curie));
  }
}

// ---------------------------------------------------------------------------
// Contains emission (owl:someValuesFrom)
// ---------------------------------------------------------------------------

function emitContainsQuads(
  subject: string,
  entry: RelationIndexInterface,
  quads: QuadInterface[],
  curie?: CurieInterface
): void {
  // Contains produces structured restrictions with constraint: OWL.someValuesFrom
  const containsRels = entry.all.filter((rel) => {
    return isRestrictionStructure(rel.structure)
    && rel.structure.constraint === OWL.someValuesFrom;
  });

  for (const rel of containsRels) {
    const structure = rel.structure;

    if (!isRestrictionStructure(structure)) {
      continue;
    }
    const containsTypeRef = String(structure.value);

    const rBnode = emitRestriction(structure.onProperty, OWL.someValuesFrom, iri(containsTypeRef, curie), quads, curie);

    quads.push(quad(subject, RDFS.subClassOf, bnode(rBnode), curie));

    // Qualified cardinality
    const minQualRels = entry.byPredicate.get(OWL.minQualifiedCardinality) ?? [];
    const maxQualRels = entry.byPredicate.get(OWL.maxQualifiedCardinality) ?? [];

    if (minQualRels.length > 0) {
      const minVal = Number(relationTargetId(minQualRels[0]));
      const minLit = literal(minVal, XSD.nonNegativeInteger, curie);
      const minRBnode = emitRestriction(structure.onProperty, OWL.minQualifiedCardinality, minLit, quads, curie);

      quads.push(quad(subject, RDFS.subClassOf, bnode(minRBnode), curie));
      quads.push(quad(minRBnode, OWL.onDataRange, iri(containsTypeRef, curie), curie));
    }

    if (maxQualRels.length > 0) {
      const maxVal = Number(relationTargetId(maxQualRels[0]));
      const maxLit = literal(maxVal, XSD.nonNegativeInteger, curie);
      const maxRBnode = emitRestriction(structure.onProperty, OWL.maxQualifiedCardinality, maxLit, quads, curie);

      quads.push(quad(subject, RDFS.subClassOf, bnode(maxRBnode), curie));
      quads.push(quad(maxRBnode, OWL.onDataRange, iri(containsTypeRef, curie), curie));
    }
  }
}

// ---------------------------------------------------------------------------
// PrefixItems emission (rdf:_N restrictions)
// ---------------------------------------------------------------------------

function emitPrefixItemQuads(
  subject: string,
  entry: RelationIndexInterface,
  quads: QuadInterface[],
  curie?: CurieInterface
): void {
  const memberRels = entry.byPredicate.get(RDFS.member) ?? [];

  for (const [
    i,
    memberRel
  ] of memberRels.entries()) {
    const typeRef = relationTargetId(memberRel);
    const rBnode = emitRestriction(`rdf:_${i + 1}`, OWL.allValuesFrom, iri(typeRef, curie), quads, curie);

    quads.push(quad(subject, RDFS.subClassOf, bnode(rBnode), curie));
  }
}

// ---------------------------------------------------------------------------
// Array item restriction emission (owl:allValuesFrom)
// ---------------------------------------------------------------------------

function emitArrayItemQuads(
  subject: string,
  index: Map<string, RelationIndexInterface>,
  quads: QuadInterface[],
  curie?: CurieInterface
): void {
  // Only process property subjects that are array properties
  // Array properties = owl:ObjectProperty + no sh:maxCount
  // But we're iterating class nodes here, so we need to find property nodes
  // that belong to this class and are arrays

  // Find all property subjects that have this class as rdfs:domain
  for (const [
    propSubject,
    propEntry
  ] of index) {
    if (!isPropertySubject(propSubject) || fragmentContains(propSubject, '/patternProperties/')) {
      continue;
    }

    if (!propEntry.types.includes(OWL.ObjectProperty)) {
      continue;
    }

    // Must be array (no sh:maxCount)
    if (propEntry.byPredicate.has(SH.maxCount)) {
      continue;
    }

    // Must belong to this class — structural parent check
    if (structuralParent(propSubject) !== subject) {
      continue;
    }

    // Find item type
    let itemTypeId: null | string = null;

    // Check rdfs:range on the property
    const propRangeRels = propEntry.byPredicate.get(RDFS.range) ?? [];

    if (propRangeRels.length > 0) {
      itemTypeId = relationTargetId(propRangeRels[0]);
    }

    // Check items subnode
    if (itemTypeId === null) {
      const itemsSubject = `${propSubject}/items`;
      const itemsEntry = index.get(itemsSubject);

      if (itemsEntry !== undefined) {
        const rangeRels = itemsEntry.byPredicate.get(RDFS.range) ?? [];
        const dtRels = itemsEntry.byPredicate.get(SH.datatype) ?? [];

        if (rangeRels.length > 0) {
          itemTypeId = relationTargetId(rangeRels[0]);
        } else if (dtRels.length > 0) {
          itemTypeId = relationTargetId(dtRels[0]);
        } else {
          itemTypeId = itemsSubject;
        }
      }
    }

    if (itemTypeId === null) {
      continue;
    }

    const canonicalId = canonicalPropertyIri(propSubject);
    const rBnode = emitRestriction(canonicalId, OWL.allValuesFrom, iri(itemTypeId, curie), quads, curie);

    quads.push(quad(subject, RDFS.subClassOf, bnode(rBnode), curie));
  }
}

// ---------------------------------------------------------------------------
// Pattern property emission
// ---------------------------------------------------------------------------

function emitPatternPropertyQuads(
  subject: string,
  entry: RelationIndexInterface,
  index: Map<string, RelationIndexInterface>,
  quads: QuadInterface[],
  curie?: CurieInterface
): void {
  // Find sh:pattern relations with patternProperty metadata
  const patternRels = entry.byPredicate.get(SH.pattern) ?? [];

  for (const rel of patternRels) {
    if (rel.metadata?.patternProperty !== true || typeof rel.metadata.pattern !== 'string') {
      continue;
    }

    const pattern = rel.metadata.pattern;
    const { base } = splitSubject(subject);
    const patternSubject = `${base}#/patternProperties/${pattern}`;
    const patternEntry = index.get(patternSubject);

    // Determine property type
    const datatypeRels = patternEntry?.byPredicate.get(SH.datatype) ?? [];
    const rangeRels = patternEntry?.byPredicate.get(RDFS.range) ?? [];
    const hasDatatype = datatypeRels.length > 0;
    const hasRange = rangeRels.length > 0;
    const rdfType = (!hasDatatype && !hasRange) ? OWL.ObjectProperty : OWL.DatatypeProperty;

    const propIri = propertyIri(subject, pattern);

    quads.push(quad(propIri, RDF.type, iri(rdfType, curie), curie));
    quads.push(quad(propIri, RDFS.domain, iri(subject, curie), curie));
    quads.push(quad(propIri, SH.pattern, literal(pattern, XSD.string, curie), curie));

    if (hasDatatype) {
      quads.push(quad(propIri, RDFS.range, iri(relationTargetId(datatypeRels[0]), curie), curie));
    }

    if (hasRange) {
      quads.push(quad(propIri, RDFS.range, iri(relationTargetId(rangeRels[0]), curie), curie));
    }

    // rdfs:comment
    if (patternEntry !== undefined) {
      emitLiterals(propIri, patternEntry, RDFS.comment, RDFS.comment, quads, curie);
    }
  }
}
