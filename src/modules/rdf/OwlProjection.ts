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

import type { QuadInterface } from '../../interfaces/quad.js';
import type { QuadObjectType } from '../../types/quad.js';
import type { SchemaGraphRelationInterface } from '../../interfaces/schema-graph.js';
import type { SchemaGraphInterface } from '../../interfaces/schema-graph-impl.js';
import {
  propertyIri, resolveSingleXsdType
} from '../data/DataTypes.js';
import {
  bnode, iri, literal, nextBnode, quad, rdfList
} from './Projection.js';

// ---------------------------------------------------------------------------
// Relation index — groups relations by source ID and predicate
// ---------------------------------------------------------------------------

interface RelationIndex {
  'all': SchemaGraphRelationInterface[];
  'byPredicate': Map<string, SchemaGraphRelationInterface[]>;
  'types': string[];
}

function buildIndex(allRelations: SchemaGraphRelationInterface[]): Map<string, RelationIndex> {
  const index = new Map<string, RelationIndex>();

  for (const rel of allRelations) {
    const sourceId = rel.source.id;
    let entry = index.get(sourceId);

    if (entry === undefined) {
      entry = {
        'all': [],
        'byPredicate': new Map(),
        'types': []
      };
      index.set(sourceId, entry);
    }

    entry.all.push(rel);

    const list = entry.byPredicate.get(rel.predicate);

    if (list === undefined) {
      entry.byPredicate.set(rel.predicate, [rel]);
    } else {
      list.push(rel);
    }

    if (rel.predicate === 'rdf:type') {
      entry.types.push(targetId(rel));
    }
  }

  return index;
}

function targetId(rel: SchemaGraphRelationInterface): string {
  return typeof rel.target === 'string' ? rel.target : rel.target.id;
}

// ---------------------------------------------------------------------------
// Subject classification helpers
// ---------------------------------------------------------------------------

function isPropertySubject(subject: string): boolean {
  const hashIdx = subject.indexOf('#');

  if (hashIdx === -1) {
    return false;
  }

  const fragment = subject.slice(hashIdx + 1);

  return fragment.includes('/properties/');
}

function isPatternPropertySubject(subject: string): boolean {
  const hashIdx = subject.indexOf('#');

  if (hashIdx === -1) {
    return false;
  }

  return subject.slice(hashIdx + 1).includes('/patternProperties/');
}

function lastSegment(subject: string): string {
  const hashIdx = subject.indexOf('#');

  if (hashIdx === -1) {
    return subject;
  }

  const fragment = subject.slice(hashIdx + 1);
  const segments = fragment.split('/');

  return segments.at(-1) ?? '';
}

function canonicalPropertyIri(subject: string): string {
  const hashIdx = subject.indexOf('#');

  if (hashIdx === -1) {
    return subject;
  }

  const base = subject.slice(0, hashIdx);
  const fragment = subject.slice(hashIdx + 1);
  const propName = lastSegment(subject);
  const propsIdx = fragment.lastIndexOf('/properties/');

  if (propsIdx === -1) {
    return propertyIri(base, propName);
  }

  const parentPointer = fragment.slice(0, propsIdx);
  const parentId = parentPointer === '' ? base : `${base}#${parentPointer}`;

  return propertyIri(parentId, propName);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function projectOwlGraph(graph: SchemaGraphInterface): QuadInterface[] {
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

    if (entry.types.includes('owl:Class')) {
      emitClassQuads(sourceId, entry, index, quads);
    }

    if (entry.types.includes('owl:DatatypeProperty') || entry.types.includes('owl:ObjectProperty')) {
      emitPropertyQuads(sourceId, entry, index, quads);
    }
  }

  return quads;
}

// ---------------------------------------------------------------------------
// Class node emission
// ---------------------------------------------------------------------------

function emitClassQuads(
  subject: string,
  entry: RelationIndex,
  index: Map<string, RelationIndex>,
  quads: QuadInterface[]
): void {
  quads.push(quad(subject, 'rdf:type', iri('owl:Class')));

  // rdfs:label
  emitLiterals(subject, entry, 'rdfs:label', 'rdfs:label', quads);

  // rdfs:comment
  emitLiterals(subject, entry, 'rdfs:comment', 'rdfs:comment', quads);

  // owl:deprecated
  const deprecated = entry.byPredicate.get('owl:deprecated');

  if (deprecated !== undefined) {
    quads.push(quad(subject, 'owl:deprecated', literal(true, 'xsd:boolean')));
  }

  // rdfs:subClassOf — IRI targets
  const subClassRels = entry.byPredicate.get('rdfs:subClassOf') ?? [];

  for (const rel of subClassRels) {
    quads.push(quad(subject, 'rdfs:subClassOf', iri(targetId(rel))));
  }

  // rdfs:subClassOf — restrictions (owl:Restriction predicate)
  const restrictionRels = entry.byPredicate.get('owl:Restriction') ?? [];

  for (const rel of restrictionRels) {
    const rBnode = nextBnode();
    const meta = rel.metadata ?? {};
    const onProperty = typeof meta.onProperty === 'string' ? meta.onProperty : '';
    const minCard = typeof meta.minCardinality === 'number' ? meta.minCardinality : 1;

    quads.push(quad(subject, 'rdfs:subClassOf', bnode(rBnode)));
    quads.push(quad(rBnode, 'rdf:type', iri('owl:Restriction')));
    quads.push(quad(rBnode, 'owl:onProperty', iri(onProperty)));
    quads.push(quad(rBnode, 'owl:minCardinality', literal(minCard, 'xsd:nonNegativeInteger')));
  }

  // owl:equivalentClass
  const equivRels = entry.byPredicate.get('owl:equivalentClass') ?? [];

  if (equivRels.length > 0) {
    const eqBnode = nextBnode();

    quads.push(quad(subject, 'owl:equivalentClass', bnode(eqBnode)));
    quads.push(quad(eqBnode, 'rdf:type', iri('owl:Class')));
    quads.push(quad(eqBnode, 'owl:unionOf', rdfList(equivRels.map((r) => {
      return iri(targetId(r));
    }))));
  }

  // owl:complementOf
  const complementRels = entry.byPredicate.get('owl:complementOf') ?? [];

  if (complementRels.length > 0) {
    quads.push(quad(subject, 'owl:complementOf', iri(targetId(complementRels[0]))));
  }

  // owl:disjointWith
  const disjointRels = entry.byPredicate.get('owl:disjointWith') ?? [];

  if (disjointRels.length > 0) {
    quads.push(quad(subject, 'owl:disjointWith', iri(targetId(disjointRels[0]))));
  }

  // owl:oneOf from enum values
  const oneOfRels = entry.byPredicate.get('owl:oneOf') ?? [];

  if (oneOfRels.length > 0) {
    const typedLiterals = oneOfRels.map((r) => {
      const val = targetId(r);

      return literal(typedLiteralObject(val), 'rdf:JSON');
    });

    quads.push(quad(subject, 'owl:oneOf', rdfList(typedLiterals)));
  }

  // owl:oneOf from const (owl:hasValue) — only if no enum
  if (oneOfRels.length === 0) {
    const hasValueRels = entry.byPredicate.get('owl:hasValue') ?? [];

    if (hasValueRels.length > 0) {
      const val = targetId(hasValueRels[0]);

      quads.push(quad(subject, 'owl:oneOf', rdfList([literal(typedLiteralObject(val), 'rdf:JSON')])));
    }
  }

  // Conditionals (structured relations with kind: 'conditional')
  emitConditionalQuads(subject, entry, index, quads);

  // DependentRequired
  emitDependentRequiredQuads(subject, entry, quads);

  // Contains (owl:someValuesFrom structured relations)
  emitContainsQuads(subject, entry, index, quads);

  // PrefixItems
  emitPrefixItemQuads(subject, entry, quads);

  // Array item restrictions
  emitArrayItemQuads(subject, entry, index, quads);

  // Pattern properties
  emitPatternPropertyQuads(subject, entry, index, quads);
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

function emitLiterals(
  subject: string,
  entry: RelationIndex,
  predicate: string,
  outputPredicate: string,
  quads: QuadInterface[]
): void {
  const rels = entry.byPredicate.get(predicate);

  if (rels !== undefined) {
    for (const rel of rels) {
      quads.push(quad(subject, outputPredicate, literal(targetId(rel), 'xsd:string')));
    }
  }
}

// ---------------------------------------------------------------------------
// Property node emission
// ---------------------------------------------------------------------------

function emitPropertyQuads(
  subject: string,
  entry: RelationIndex,
  _index: Map<string, RelationIndex>,
  quads: QuadInterface[]
): void {
  if (isPatternPropertySubject(subject)) {
    return;
  }

  if (!isPropertySubject(subject)) {
    return;
  }

  const canonicalId = canonicalPropertyIri(subject);

  // rdf:type
  if (entry.types.includes('owl:ObjectProperty')) {
    quads.push(quad(canonicalId, 'rdf:type', iri('owl:ObjectProperty')));
  } else if (entry.types.includes('owl:DatatypeProperty')) {
    quads.push(quad(canonicalId, 'rdf:type', iri('owl:DatatypeProperty')));
  }

  if (entry.byPredicate.has('owl:TransitiveProperty')) {
    quads.push(quad(canonicalId, 'rdf:type', iri('owl:TransitiveProperty')));
  }

  if (entry.byPredicate.has('owl:SymmetricProperty')) {
    quads.push(quad(canonicalId, 'rdf:type', iri('owl:SymmetricProperty')));
  }

  // rdfs:domain
  const domainRels = entry.byPredicate.get('rdfs:domain') ?? [];
  const domainId = domainRels.length > 0 ? targetId(domainRels[0]) : '';

  quads.push(quad(canonicalId, 'rdfs:domain', iri(domainId)));

  // rdfs:range
  const hasMaxCount = entry.byPredicate.has('sh:maxCount');
  const rangeRels = entry.byPredicate.get('rdfs:range') ?? [];
  const datatypeRels = entry.byPredicate.get('sh:datatype') ?? [];

  if (!hasMaxCount) {
    // Array property
    quads.push(quad(canonicalId, 'rdfs:range', iri('rdf:List')));
  } else if (rangeRels.length > 0) {
    quads.push(quad(canonicalId, 'rdfs:range', iri(targetId(rangeRels[0]))));
  } else if (datatypeRels.length > 0) {
    quads.push(quad(canonicalId, 'rdfs:range', iri(targetId(datatypeRels[0]))));
  }

  // owl:unionOf (multi-type properties)
  const unionStructured = entry.all.filter((r) => {
    return r.predicate === 'owl:unionOf' && r.structure?.kind === 'list';
  });

  for (const rel of unionStructured) {
    quads.push(quad(canonicalId, 'owl:unionOf', rdfList(rel.structure!.kind === 'list'
      ? (rel.structure as { 'members': string[] }).members.map((m) => {
        return iri(m);
      })
      : [])));
  }

  // owl:inverseOf
  const inverseRels = entry.byPredicate.get('owl:inverseOf') ?? [];

  if (inverseRels.length > 0) {
    quads.push(quad(canonicalId, 'owl:inverseOf', iri(targetId(inverseRels[0]))));
  }

  // rdfs:comment
  const commentRels = entry.byPredicate.get('rdfs:comment') ?? [];

  for (const rel of commentRels) {
    quads.push(quad(canonicalId, 'rdfs:comment', literal(targetId(rel), 'xsd:string')));
  }

  // readOnly / writeOnly
  if (entry.byPredicate.has('dash:readOnly')) {
    quads.push(quad(canonicalId, 'jsonschema:readOnly', literal(true, 'xsd:boolean')));
  }

  if (entry.byPredicate.has('dash:writeOnly')) {
    quads.push(quad(canonicalId, 'jsonschema:writeOnly', literal(true, 'xsd:boolean')));
  }

  // dct:format
  const formatRels = entry.byPredicate.get('dct:format') ?? [];

  for (const rel of formatRels) {
    quads.push(quad(canonicalId, 'dct:format', literal(targetId(rel), 'xsd:string')));
  }
}

// ---------------------------------------------------------------------------
// Conditional emission (if/then/else)
// ---------------------------------------------------------------------------

function emitConditionalQuads(
  subject: string,
  entry: RelationIndex,
  _index: Map<string, RelationIndex>,
  quads: QuadInterface[]
): void {
  for (const rel of entry.all) {
    if (rel.structure?.kind !== 'conditional') {
      continue;
    }

    const {
      elseRef, ifRef, thenRef
    } = rel.structure;

    // Check if this is a dependentSchemas conditional
    if (thenRef !== undefined && thenRef.includes('/dependentSchemas/')) {
      emitDependentSchemaImplication(subject, ifRef, thenRef, quads);
      continue;
    }

    // Regular if/then/else → owl:unionOf(intersectionOf(A,B), intersectionOf(¬A,C))
    const branches: QuadObjectType[] = [];

    if (thenRef !== undefined) {
      const branchBnode = nextBnode();

      quads.push(quad(branchBnode, 'rdf:type', iri('owl:Class')));
      quads.push(quad(branchBnode, 'owl:intersectionOf', rdfList([
        iri(ifRef),
        iri(thenRef)
      ])));
      branches.push(bnode(branchBnode));
    }

    if (elseRef !== undefined) {
      const notBnode = nextBnode();

      quads.push(quad(notBnode, 'rdf:type', iri('owl:Class')));
      quads.push(quad(notBnode, 'owl:complementOf', iri(ifRef)));

      const branchBnode = nextBnode();

      quads.push(quad(branchBnode, 'rdf:type', iri('owl:Class')));
      quads.push(quad(branchBnode, 'owl:intersectionOf', rdfList([
        bnode(notBnode),
        iri(elseRef)
      ])));
      branches.push(bnode(branchBnode));
    }

    if (branches.length > 0) {
      const unionBnode = nextBnode();

      quads.push(quad(unionBnode, 'rdf:type', iri('owl:Class')));
      quads.push(quad(unionBnode, 'owl:unionOf', rdfList(branches)));
      quads.push(quad(subject, 'rdfs:subClassOf', bnode(unionBnode)));
    }
  }
}

function emitDependentSchemaImplication(
  classSubject: string,
  triggerPropIri: string,
  schemaRef: string,
  quads: QuadInterface[]
): void {
  // ¬hasTrigger
  const restrictionBnode = nextBnode();

  quads.push(quad(restrictionBnode, 'rdf:type', iri('owl:Restriction')));
  quads.push(quad(restrictionBnode, 'owl:onProperty', iri(triggerPropIri)));
  quads.push(quad(restrictionBnode, 'owl:minCardinality', literal(1, 'xsd:nonNegativeInteger')));

  const notTriggerBnode = nextBnode();

  quads.push(quad(notTriggerBnode, 'rdf:type', iri('owl:Class')));
  quads.push(quad(notTriggerBnode, 'owl:complementOf', bnode(restrictionBnode)));

  // ¬hasTrigger ∨ Schema
  const unionBnode = nextBnode();

  quads.push(quad(unionBnode, 'rdf:type', iri('owl:Class')));
  quads.push(quad(unionBnode, 'owl:unionOf', rdfList([
    bnode(notTriggerBnode),
    iri(schemaRef)
  ])));
  quads.push(quad(classSubject, 'rdfs:subClassOf', bnode(unionBnode)));
}

// ---------------------------------------------------------------------------
// DependentRequired emission
// ---------------------------------------------------------------------------

function emitDependentRequiredQuads(
  subject: string,
  entry: RelationIndex,
  quads: QuadInterface[]
): void {
  const depReqRels = entry.byPredicate.get('jt:dependentRequired') ?? [];

  for (const rel of depReqRels) {
    const meta = rel.metadata ?? {};
    const trigger = typeof meta.trigger === 'string' ? meta.trigger : '';
    const required = Array.isArray(meta.required) ? meta.required as string[] : [];

    const triggerPropIri = propertyIri(subject, trigger);

    // ¬hasTrigger
    const restrictionBnode = nextBnode();

    quads.push(quad(restrictionBnode, 'rdf:type', iri('owl:Restriction')));
    quads.push(quad(restrictionBnode, 'owl:onProperty', iri(triggerPropIri)));
    quads.push(quad(restrictionBnode, 'owl:minCardinality', literal(1, 'xsd:nonNegativeInteger')));

    const notTriggerBnode = nextBnode();

    quads.push(quad(notTriggerBnode, 'rdf:type', iri('owl:Class')));
    quads.push(quad(notTriggerBnode, 'owl:complementOf', bnode(restrictionBnode)));

    // Required restrictions
    const reqRestrictions: QuadObjectType[] = required.map((reqProp) => {
      const reqBnode = nextBnode();

      quads.push(quad(reqBnode, 'rdf:type', iri('owl:Restriction')));
      quads.push(quad(reqBnode, 'owl:onProperty', iri(propertyIri(subject, reqProp))));
      quads.push(quad(reqBnode, 'owl:minCardinality', literal(1, 'xsd:nonNegativeInteger')));

      return bnode(reqBnode);
    });

    // Build union: ¬hasTrigger ∨ (hasReq1 ∧ hasReq2 ∧ ...)
    const unionMembers: QuadObjectType[] = [bnode(notTriggerBnode)];

    if (reqRestrictions.length === 1) {
      unionMembers.push(reqRestrictions[0]);
    } else {
      const interBnode = nextBnode();

      quads.push(quad(interBnode, 'rdf:type', iri('owl:Class')));
      quads.push(quad(interBnode, 'owl:intersectionOf', rdfList(reqRestrictions)));
      unionMembers.push(bnode(interBnode));
    }

    const unionBnode = nextBnode();

    quads.push(quad(unionBnode, 'rdf:type', iri('owl:Class')));
    quads.push(quad(unionBnode, 'owl:unionOf', rdfList(unionMembers)));
    quads.push(quad(subject, 'rdfs:subClassOf', bnode(unionBnode)));
  }
}

// ---------------------------------------------------------------------------
// Contains emission (owl:someValuesFrom)
// ---------------------------------------------------------------------------

function emitContainsQuads(
  subject: string,
  entry: RelationIndex,
  _index: Map<string, RelationIndex>,
  quads: QuadInterface[]
): void {
  // Contains produces structured restrictions with constraint: 'owl:someValuesFrom'
  const containsRels = entry.all.filter((r) => {
    return r.structure?.kind === 'restriction'
    && (r.structure as { 'constraint': string }).constraint === 'owl:someValuesFrom';
  });

  for (const rel of containsRels) {
    const structure = rel.structure as { 'onProperty': string;
      'value': unknown };
    const containsTypeRef = String(structure.value);

    const rBnode = nextBnode();

    quads.push(quad(subject, 'rdfs:subClassOf', bnode(rBnode)));
    quads.push(quad(rBnode, 'rdf:type', iri('owl:Restriction')));
    quads.push(quad(rBnode, 'owl:onProperty', iri(structure.onProperty)));
    quads.push(quad(rBnode, 'owl:someValuesFrom', iri(containsTypeRef)));

    // Qualified cardinality
    const minQualRels = entry.byPredicate.get('owl:minQualifiedCardinality') ?? [];
    const maxQualRels = entry.byPredicate.get('owl:maxQualifiedCardinality') ?? [];

    if (minQualRels.length > 0) {
      const minVal = Number(targetId(minQualRels[0]));
      const minRBnode = nextBnode();

      quads.push(quad(subject, 'rdfs:subClassOf', bnode(minRBnode)));
      quads.push(quad(minRBnode, 'rdf:type', iri('owl:Restriction')));
      quads.push(quad(minRBnode, 'owl:onProperty', iri(structure.onProperty)));
      quads.push(quad(minRBnode, 'owl:minQualifiedCardinality', literal(minVal, 'xsd:nonNegativeInteger')));
      quads.push(quad(minRBnode, 'owl:onDataRange', iri(containsTypeRef)));
    }

    if (maxQualRels.length > 0) {
      const maxVal = Number(targetId(maxQualRels[0]));
      const maxRBnode = nextBnode();

      quads.push(quad(subject, 'rdfs:subClassOf', bnode(maxRBnode)));
      quads.push(quad(maxRBnode, 'rdf:type', iri('owl:Restriction')));
      quads.push(quad(maxRBnode, 'owl:onProperty', iri(structure.onProperty)));
      quads.push(quad(maxRBnode, 'owl:maxQualifiedCardinality', literal(maxVal, 'xsd:nonNegativeInteger')));
      quads.push(quad(maxRBnode, 'owl:onDataRange', iri(containsTypeRef)));
    }
  }
}

// ---------------------------------------------------------------------------
// PrefixItems emission (rdf:_N restrictions)
// ---------------------------------------------------------------------------

function emitPrefixItemQuads(
  subject: string,
  entry: RelationIndex,
  quads: QuadInterface[]
): void {
  const memberRels = entry.byPredicate.get('rdfs:member') ?? [];

  for (const [
    i,
    memberRel
  ] of memberRels.entries()) {
    const typeRef = targetId(memberRel);
    const rBnode = nextBnode();

    quads.push(quad(subject, 'rdfs:subClassOf', bnode(rBnode)));
    quads.push(quad(rBnode, 'rdf:type', iri('owl:Restriction')));
    quads.push(quad(rBnode, 'owl:onProperty', iri(`rdf:_${i + 1}`)));
    quads.push(quad(rBnode, 'owl:allValuesFrom', iri(typeRef)));
  }
}

// ---------------------------------------------------------------------------
// Array item restriction emission (owl:allValuesFrom)
// ---------------------------------------------------------------------------

function emitArrayItemQuads(
  subject: string,
  _entry: RelationIndex,
  index: Map<string, RelationIndex>,
  quads: QuadInterface[]
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
    if (!isPropertySubject(propSubject) || isPatternPropertySubject(propSubject)) {
      continue;
    }

    if (!propEntry.types.includes('owl:ObjectProperty')) {
      continue;
    }

    // Must be array (no sh:maxCount)
    if (propEntry.byPredicate.has('sh:maxCount')) {
      continue;
    }

    // Must belong to this class (rdfs:domain matches or structural parent matches)
    // Structural parent check
    const domainRels = propEntry.byPredicate.get('rdfs:domain') ?? [];

    void domainRels;

    // Structural parent check
    const hashIdx = propSubject.indexOf('#');

    if (hashIdx === -1) {
      continue;
    }

    const base = propSubject.slice(0, hashIdx);
    const fragment = propSubject.slice(hashIdx + 1);
    const propsIdx = fragment.lastIndexOf('/properties/');

    if (propsIdx === -1) {
      continue;
    }

    const parentPointer = fragment.slice(0, propsIdx);
    const structuralParent = parentPointer === '' ? base : `${base}#${parentPointer}`;

    if (structuralParent !== subject) {
      continue;
    }

    // Find item type
    let itemTypeId: null | string = null;

    // Check rdfs:range on the property
    const propRangeRels = propEntry.byPredicate.get('rdfs:range') ?? [];

    if (propRangeRels.length > 0) {
      itemTypeId = targetId(propRangeRels[0]);
    }

    // Check items subnode
    if (itemTypeId === null) {
      const itemsSubject = `${propSubject}/items`;
      const itemsEntry = index.get(itemsSubject);

      if (itemsEntry !== undefined) {
        const rangeRels = itemsEntry.byPredicate.get('rdfs:range') ?? [];
        const dtRels = itemsEntry.byPredicate.get('sh:datatype') ?? [];

        if (rangeRels.length > 0) {
          itemTypeId = targetId(rangeRels[0]);
        } else if (dtRels.length > 0) {
          itemTypeId = targetId(dtRels[0]);
        } else {
          itemTypeId = itemsSubject;
        }
      }
    }

    if (itemTypeId === null) {
      continue;
    }

    const canonicalId = canonicalPropertyIri(propSubject);
    const rBnode = nextBnode();

    quads.push(quad(subject, 'rdfs:subClassOf', bnode(rBnode)));
    quads.push(quad(rBnode, 'rdf:type', iri('owl:Restriction')));
    quads.push(quad(rBnode, 'owl:onProperty', iri(canonicalId)));
    quads.push(quad(rBnode, 'owl:allValuesFrom', iri(itemTypeId)));
  }
}

// ---------------------------------------------------------------------------
// Pattern property emission
// ---------------------------------------------------------------------------

function emitPatternPropertyQuads(
  subject: string,
  entry: RelationIndex,
  index: Map<string, RelationIndex>,
  quads: QuadInterface[]
): void {
  // Find sh:pattern relations with patternProperty metadata
  const patternRels = entry.byPredicate.get('sh:pattern') ?? [];

  for (const rel of patternRels) {
    if (rel.metadata?.patternProperty !== true || typeof rel.metadata?.pattern !== 'string') {
      continue;
    }

    const pattern = rel.metadata.pattern;
    const hashIdx = subject.indexOf('#');
    const base = hashIdx === -1 ? subject : subject.slice(0, hashIdx);
    const patternSubject = `${base}#/patternProperties/${pattern}`;
    const patternEntry = index.get(patternSubject);

    // Determine property type
    const datatypeRels = patternEntry?.byPredicate.get('sh:datatype') ?? [];
    const rangeRels = patternEntry?.byPredicate.get('rdfs:range') ?? [];
    const hasDatatype = datatypeRels.length > 0;
    const hasRange = rangeRels.length > 0;
    const rdfType = (!hasDatatype && !hasRange) ? 'owl:ObjectProperty' : 'owl:DatatypeProperty';

    const propIri = propertyIri(subject, pattern);

    quads.push(quad(propIri, 'rdf:type', iri(rdfType)));
    quads.push(quad(propIri, 'rdfs:domain', iri(subject)));
    quads.push(quad(propIri, 'sh:pattern', literal(pattern, 'xsd:string')));

    if (hasDatatype) {
      quads.push(quad(propIri, 'rdfs:range', iri(targetId(datatypeRels[0]))));
    }

    if (hasRange) {
      quads.push(quad(propIri, 'rdfs:range', iri(targetId(rangeRels[0]))));
    }

    // rdfs:comment
    const commentRels = patternEntry?.byPredicate.get('rdfs:comment') ?? [];

    for (const crel of commentRels) {
      quads.push(quad(propIri, 'rdfs:comment', literal(targetId(crel), 'xsd:string')));
    }
  }
}
