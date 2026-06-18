/**
 * Unit tests — anyOf/oneOf OWL semantics (H-5)
 *
 * Verifies:
 *   - anyOf schema → quads contain owl:equivalentClass + owl:unionOf bnode
 *   - oneOf schema → quads contain owl:disjointUnionOf (no owl:unionOf at class level)
 *   - round-trip: anyOf → project → import → anyOf
 *   - round-trip: oneOf → project → import → oneOf
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import { SchemaGraph } from '../../src/modules/graph/SchemaGraph.js';
import { OwlProjection } from '../../src/modules/rdf/OwlProjection.js';
import { OwlImporter } from '../../src/modules/ontology/OwlImporter.js';
import { OWL } from '../../src/constants/IRI.js';

const BASE = 'urn:example:composition';

const CatSchema = {
  '$id': `${BASE}:Cat`,
  'type': 'object'
} as const;

const DogSchema = {
  '$id': `${BASE}:Dog`,
  'type': 'object'
} as const;

const CAT_IRI = CatSchema.$id;
const DOG_IRI = DogSchema.$id;

void describe('anyOf composition', () => {
  const anyOfSchema = {
    '$id': `${BASE}:Pet`,
    'anyOf': [
      { '$ref': CAT_IRI },
      { '$ref': DOG_IRI }
    ]
  } as const;

  const PET_IRI = anyOfSchema.$id;

  void it('emits owl:equivalentClass with owl:unionOf bnode for anyOf branches', () => {
    const quads = OwlProjection.graph(new SchemaGraph(anyOfSchema));

    const equivalentClassQuads = quads.filter((quad) => {
      return quad.subject.value === PET_IRI
        && quad.predicate.value === OWL.equivalentClass;
    });

    assert.ok(
      equivalentClassQuads.length > 0,
      'anyOf should emit owl:equivalentClass from the Pet subject'
    );

    const eqQuad0 = equivalentClassQuads.at(0);

    if (eqQuad0 === undefined) {
      throw new Error('expected equivalentClass quad at index 0');
    }
    const eqBnode = eqQuad0.object.value;
    const unionOfQuads = quads.filter((quad) => {
      return quad.subject.value === eqBnode
        && quad.predicate.value === OWL.unionOf;
    });

    assert.ok(
      unionOfQuads.length > 0,
      `anyOf equivalentClass bnode (${eqBnode}) should carry owl:unionOf`
    );
  });

  void it('does NOT emit owl:disjointUnionOf for anyOf branches', () => {
    const quads = OwlProjection.graph(new SchemaGraph(anyOfSchema));

    const disjointUnionQuads = quads.filter((quad) => {
      return quad.subject.value === PET_IRI
        && quad.predicate.value === OWL.disjointUnionOf;
    });

    assert.equal(
      disjointUnionQuads.length,
      0,
      'anyOf must not emit owl:disjointUnionOf'
    );
  });

  void it('round-trips anyOf: project → import → anyOf', () => {
    const petQuads = OwlProjection.graph(new SchemaGraph(anyOfSchema));
    const catQuads = OwlProjection.graph(new SchemaGraph(CatSchema));
    const dogQuads = OwlProjection.graph(new SchemaGraph(DogSchema));
    const allQuads = [
      ...petQuads,
      ...catQuads,
      ...dogQuads
    ];

    const importer = new OwlImporter({ 'baseIRI': BASE });
    const result = importer.import(allQuads);

    const petResult = result.schemas.find((schemaItem) => {
      return schemaItem.$id === PET_IRI;
    });

    assert.ok(petResult !== undefined, 'Pet schema should be present in import result');

    const anyOf = (petResult as Record<string, unknown>).anyOf as undefined | unknown[];

    assert.ok(Array.isArray(anyOf) && anyOf.length === 2, 'round-tripped schema should carry anyOf with 2 members');

    const refs = new Set((anyOf as Array<Record<string, unknown>>).map((member) => {
      return member.$ref;
    }));

    assert.ok(refs.has(CAT_IRI), `anyOf should include $ref → ${CAT_IRI}`);
    assert.ok(refs.has(DOG_IRI), `anyOf should include $ref → ${DOG_IRI}`);

    assert.ok(
      !Object.hasOwn(petResult, 'oneOf'),
      'round-tripped anyOf schema must not carry oneOf'
    );
  });
});

void describe('oneOf composition', () => {
  const oneOfSchema = {
    '$id': `${BASE}:Shape`,
    'oneOf': [
      { '$ref': CAT_IRI },
      { '$ref': DOG_IRI }
    ]
  } as const;

  const SHAPE_IRI = oneOfSchema.$id;

  void it('emits owl:disjointUnionOf for oneOf branches', () => {
    const quads = OwlProjection.graph(new SchemaGraph(oneOfSchema));

    const disjointUnionQuads = quads.filter((quad) => {
      return quad.subject.value === SHAPE_IRI
        && quad.predicate.value === OWL.disjointUnionOf;
    });

    assert.ok(
      disjointUnionQuads.length > 0,
      'oneOf should emit owl:disjointUnionOf from the Shape subject'
    );
  });

  void it('does NOT emit owl:equivalentClass + owl:unionOf for oneOf branches', () => {
    const quads = OwlProjection.graph(new SchemaGraph(oneOfSchema));

    const equivalentClassQuads = quads.filter((quad) => {
      return quad.subject.value === SHAPE_IRI
        && quad.predicate.value === OWL.equivalentClass;
    });

    assert.equal(
      equivalentClassQuads.length,
      0,
      'oneOf must not emit owl:equivalentClass'
    );
  });

  void it('round-trips oneOf: project → import → oneOf', () => {
    const shapeQuads = OwlProjection.graph(new SchemaGraph(oneOfSchema));
    const catQuads = OwlProjection.graph(new SchemaGraph(CatSchema));
    const dogQuads = OwlProjection.graph(new SchemaGraph(DogSchema));
    const allQuads = [
      ...shapeQuads,
      ...catQuads,
      ...dogQuads
    ];

    const importer = new OwlImporter({ 'baseIRI': BASE });
    const result = importer.import(allQuads);

    const shapeResult = result.schemas.find((schemaItem) => {
      return schemaItem.$id === SHAPE_IRI;
    });

    assert.ok(shapeResult !== undefined, 'Shape schema should be present in import result');

    const oneOf = (shapeResult as Record<string, unknown>).oneOf as undefined | unknown[];

    assert.ok(Array.isArray(oneOf) && oneOf.length === 2, 'round-tripped schema should carry oneOf with 2 members');

    const refs = new Set((oneOf as Array<Record<string, unknown>>).map((member) => {
      return member.$ref;
    }));

    assert.ok(refs.has(CAT_IRI), `oneOf should include $ref → ${CAT_IRI}`);
    assert.ok(refs.has(DOG_IRI), `oneOf should include $ref → ${DOG_IRI}`);

    assert.ok(
      !Object.hasOwn(shapeResult, 'anyOf'),
      'round-tripped oneOf schema must not carry anyOf'
    );
  });
});
