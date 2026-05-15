import type { SimplePredicateEntry } from '../interfaces/SimplePredicateEntry.js';

import {
  DASH, DCT, JT, OWL, RDF, RDFS, SH, XSD
} from './IRI.js';

export const RESTRICTION_PREDICATE: Partial<Record<string, string>> = {
  'allValuesFrom': OWL.allValuesFrom,
  'cardinality': OWL.cardinality,
  'hasValue': OWL.hasValue,
  'maxCardinality': OWL.maxCardinality,
  'minCardinality': OWL.minCardinality,
  'someValuesFrom': OWL.someValuesFrom
};

export const OWL_CORE_PREDICATES: ReadonlySet<string> = new Set([
  'owl:AllDifferent',
  'owl:AsymmetricProperty',
  'owl:cardinality',
  'owl:Class',
  'owl:complementOf',
  'owl:DatatypeProperty',
  'owl:distinctMembers',
  'owl:FunctionalProperty',
  'owl:hasValue',
  'owl:intersectionOf',
  'owl:InverseFunctionalProperty',
  'owl:inverseOf',
  'owl:IrreflexiveProperty',
  'owl:maxCardinality',
  'owl:minCardinality',
  'owl:ObjectProperty',
  'owl:oneOf',
  'owl:onProperty',
  'owl:ReflexiveProperty',
  'owl:Restriction',
  'owl:sameAs',
  'owl:SymmetricProperty',
  'owl:TransitiveProperty',
  'owl:unionOf',
  'rdf:first',
  'rdf:nil',
  'rdf:rest',
  'rdf:type',
  'rdf:value',
  'rdfs:comment',
  'rdfs:domain',
  'rdfs:label',
  'rdfs:range',
  'rdfs:subClassOf',
  'rdfs:subPropertyOf'
]);

export const SHACL_CORE_PREDICATES: ReadonlySet<string> = new Set([
  'dash:readOnly',
  'dash:writeOnly',
  'rdfs:comment',
  'rdfs:domain',
  'rdfs:label',
  'rdfs:range',
  'sh:and',
  'sh:class',
  'sh:closed',
  'sh:datatype',
  'sh:description',
  'sh:hasValue',
  'sh:ignoredProperties',
  'sh:in',
  'sh:maxCount',
  'sh:maxExclusive',
  'sh:maxInclusive',
  'sh:maxLength',
  'sh:minCount',
  'sh:minExclusive',
  'sh:minInclusive',
  'sh:minLength',
  'sh:name',
  'sh:node',
  'sh:not',
  'sh:or',
  'sh:path',
  'sh:pattern',
  'sh:property',
  'sh:qualifiedMaxCount',
  'sh:qualifiedMinCount',
  'sh:qualifiedValueShape',
  'sh:targetClass',
  'sh:targetNode'
]);

export const CARDINALITY_KINDS = new Set<string>([
  'cardinality',
  'maxCardinality',
  'minCardinality'
]);

export const SIMPLE_LITERAL_PREDICATES = new Map<string, SimplePredicateEntry>([
  [
    DASH.readOnly,
    {
      'coerce': (value: string) => {
        return value === 'true';
      },
      'datatype': XSD.boolean
    }
  ],
  [
    DASH.writeOnly,
    {
      'coerce': (value: string) => {
        return value === 'true';
      },
      'datatype': XSD.boolean
    }
  ],
  [
    DCT.format,
    { 'datatype': XSD.string }
  ],
  [
    JT.multipleOf,
    {
      'coerce': Number,
      'datatype': XSD.decimal
    }
  ],
  [
    OWL.deprecated,
    { 'datatype': XSD.boolean }
  ],
  [
    OWL.hasValue,
    { 'datatype': XSD.string }
  ],
  [
    OWL.maxQualifiedCardinality,
    {
      'coerce': Number,
      'datatype': XSD.nonNegativeInteger
    }
  ],
  [
    OWL.minQualifiedCardinality,
    {
      'coerce': Number,
      'datatype': XSD.nonNegativeInteger
    }
  ],
  [
    OWL.oneOf,
    { 'datatype': XSD.string }
  ],
  [
    RDFS.comment,
    { 'datatype': XSD.string }
  ],
  [
    RDFS.label,
    { 'datatype': XSD.string }
  ],
  [
    SH.closed,
    { 'datatype': XSD.boolean }
  ],
  [
    SH.maxCount,
    {
      'coerce': Number,
      'datatype': XSD.integer
    }
  ],
  [
    SH.maxExclusive,
    {
      'coerce': Number,
      'datatype': XSD.decimal
    }
  ],
  [
    SH.maxInclusive,
    {
      'coerce': Number,
      'datatype': XSD.decimal
    }
  ],
  [
    SH.maxLength,
    {
      'coerce': Number,
      'datatype': XSD.integer
    }
  ],
  [
    SH.minCount,
    {
      'coerce': Number,
      'datatype': XSD.integer
    }
  ],
  [
    SH.minExclusive,
    {
      'coerce': Number,
      'datatype': XSD.decimal
    }
  ],
  [
    SH.minInclusive,
    {
      'coerce': Number,
      'datatype': XSD.decimal
    }
  ],
  [
    SH.minLength,
    {
      'coerce': Number,
      'datatype': XSD.integer
    }
  ]
]);

export const IRI_PREDICATES = new Set<string>([
  OWL.AsymmetricProperty,
  OWL.complementOf,
  OWL.disjointWith,
  OWL.equivalentClass,
  OWL.FunctionalProperty,
  OWL.InverseFunctionalProperty,
  OWL.inverseOf,
  OWL.IrreflexiveProperty,
  OWL.ReflexiveProperty,
  OWL.someValuesFrom,
  OWL.SymmetricProperty,
  OWL.TransitiveProperty,
  OWL.unionOf,
  RDF.type,
  RDFS.domain,
  RDFS.member,
  RDFS.range,
  RDFS.subClassOf,
  SH.datatype
]);
