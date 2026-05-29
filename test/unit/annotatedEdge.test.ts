/**
 * Unit tests for RDF 1.2 triple-term (edge-annotation) emission.
 *
 * Exercises the plan's exact fixture: Lycanroc-Midday `directEvolvesFrom`
 * Rockruff, annotated with `evolutionTimeOfDay "day"` and `evolutionMinLevel 25`,
 * all asserted in the named graph
 * `https://pokemontology.dev/graph/universal/evolutions`.
 *
 * Covers:
 * - `toQuads` emits the base triple plus one `Quad`-subject (triple-term)
 *   annotation quad per annotation, ALL stamped with the same `graphIRI`.
 * - The same-graph invariant: no annotation quad lands in a different graph.
 * - `fromQuads` round-trips the emitted quads back to the instance shape.
 * - The N3 v2 `Writer` serializes `Quad`-subject quads as Turtle 1.2 `<< s p o >>`.
 * - Missing `graphIRI` for an annotated edge raises an intelligible error.
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import { Writer } from 'n3';

import { Compose } from '../../src/modules/composition/Compose.js';
import { JsonTology } from '../../src/index.js';
import { MaterializationError } from '../../src/errors/MaterializationError.js';
import { isRecord } from '../../src/modules/data/DataTypes.js';
import type { QuadInterface } from '../../src/interfaces/Quad.js';

type TripleTermQuad = QuadInterface & { 'subject': QuadInterface };

// ---------------------------------------------------------------------------
// Fixture schemas
// ---------------------------------------------------------------------------

const EVOLUTIONS_GRAPH = 'https://pokemontology.dev/graph/universal/evolutions';
const ROCKRUFF_IRI = 'https://pokemontology.dev/instances/Rockruff';

const PokemonSchema = {
  '$id': 'https://pokemontology.dev/Pokemon',
  'properties': { 'name': { 'type': 'string' } },
  'required': ['name'],
  'type': 'object'
} as const;

const TimeOfDaySchema = {
  '$id': 'https://pokemontology.dev/TimeOfDay',
  'type': 'string'
} as const;

const LevelSchema = {
  '$id': 'https://pokemontology.dev/Level',
  'type': 'integer'
} as const;

const EvolvesFromEdge = Compose.annotatedEdge({
  'annotations': {
    'evolutionMinLevel': { '$ref': 'https://pokemontology.dev/Level' },
    'evolutionTimeOfDay': { '$ref': 'https://pokemontology.dev/TimeOfDay' }
  },
  'predicate': 'https://pokemontology.dev/directEvolvesFrom',
  'targetRef': 'https://pokemontology.dev/Pokemon'
});

const LycanrocSchema = {
  '$id': 'https://pokemontology.dev/Lycanroc-Midday',
  'properties': {
    'evolvesFrom': EvolvesFromEdge,
    'name': { 'type': 'string' }
  },
  'required': ['name'],
  'type': 'object'
} as const;

const EDGE_PREDICATE = 'https://pokemontology.dev/directEvolvesFrom';
const TIME_PREDICATE = 'https://pokemontology.dev/Lycanroc-Midday#/properties/evolvesFrom#evolutionTimeOfDay';
const LEVEL_PREDICATE = 'https://pokemontology.dev/Lycanroc-Midday#/properties/evolvesFrom#evolutionMinLevel';

const lycanrocInstance = {
  'evolvesFrom': {
    'annotations': {
      'evolutionMinLevel': 25,
      'evolutionTimeOfDay': 'day'
    },
    'target': ROCKRUFF_IRI
  },
  'name': 'Lycanroc-Midday'
};

function freshJt(): ReturnType<typeof JsonTology.create> {
  const jt = JsonTology.create({
    'baseIRI': 'https://pokemontology.dev',
    'enableStrictGraph': false
  });

  jt.set(PokemonSchema);
  jt.set(TimeOfDaySchema);
  jt.set(LevelSchema);
  jt.set(LycanrocSchema);

  return jt;
}

function isTripleTermSubject(quad: QuadInterface): quad is TripleTermQuad {
  return quad.subject.termType === 'Quad';
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

void describe('annotated edge (RDF 1.2 triple-term) emission', () => {
  void it('emits the base triple plus one Quad-subject quad per annotation', () => {
    const jt = freshJt();
    const quads = jt.toQuads(LycanrocSchema, lycanrocInstance, { 'graphIRI': EVOLUTIONS_GRAPH });

    const baseTriples = quads.filter((quad) => {
      return quad.predicate.value === EDGE_PREDICATE && quad.subject.termType === 'NamedNode';
    });

    assert.equal(baseTriples.length, 1, 'exactly one base triple');
    assert.equal(baseTriples[0].object.value, ROCKRUFF_IRI);

    const annotationQuads = quads.filter((quad) => {
      return isTripleTermSubject(quad);
    });

    assert.equal(annotationQuads.length, 2, 'two annotation (triple-term) quads');

    const byPredicate = new Map(annotationQuads.map((quad) => {
      return [
        quad.predicate.value,
        quad
      ] as const;
    }));

    const timeQuad = byPredicate.get(TIME_PREDICATE);
    const levelQuad = byPredicate.get(LEVEL_PREDICATE);

    assert.ok(timeQuad, 'evolutionTimeOfDay annotation present');
    assert.ok(levelQuad, 'evolutionMinLevel annotation present');
    assert.equal(timeQuad.object.value, 'day');
    assert.equal(levelQuad.object.value, '25');
  });

  void it('stamps the base triple AND every annotation quad with the same graphIRI', () => {
    const jt = freshJt();
    const quads = jt.toQuads(LycanrocSchema, lycanrocInstance, { 'graphIRI': EVOLUTIONS_GRAPH });

    const edgeRelatedQuads = quads.filter((quad) => {
      return (quad.predicate.value === EDGE_PREDICATE && quad.subject.termType === 'NamedNode')
        || isTripleTermSubject(quad);
    });

    assert.equal(edgeRelatedQuads.length, 3, 'one base + two annotation quads');

    for (const quad of edgeRelatedQuads) {
      assert.equal(quad.graph.termType, 'NamedNode', 'edge quad is in a named graph');
      assert.equal(quad.graph.value, EVOLUTIONS_GRAPH, 'same-graph invariant: all edge quads share graphIRI');
    }
  });

  void it('the inner triple term of every annotation quad equals the base triple', () => {
    const jt = freshJt();
    const quads = jt.toQuads(LycanrocSchema, lycanrocInstance, { 'graphIRI': EVOLUTIONS_GRAPH });

    const annotationQuads = quads.filter((quad) => {
      return isTripleTermSubject(quad);
    });

    for (const quad of annotationQuads) {
      const subject = quad.subject;

      assert.equal(subject.termType, 'Quad');
      assert.equal(subject.predicate.value, EDGE_PREDICATE);
      assert.equal(subject.object.value, ROCKRUFF_IRI);
      assert.equal(subject.subject.termType, 'NamedNode');
    }
  });

  void it('round-trips through fromQuads back to the instance shape', () => {
    const jt = freshJt();
    const quads = jt.toQuads(LycanrocSchema, lycanrocInstance, { 'graphIRI': EVOLUTIONS_GRAPH });

    const lifted = jt.fromQuads(LycanrocSchema, quads);

    assert.equal(lifted.length, 1, 'one lifted instance');

    const instance = lifted[0];

    assert.ok(isRecord(instance), 'lifted instance is a record');

    const edge = instance.evolvesFrom;

    assert.ok(isRecord(edge), 'evolvesFrom edge present');
    assert.equal(edge.target, ROCKRUFF_IRI);

    const annotations = edge.annotations;

    assert.ok(isRecord(annotations), 'annotations present');
    assert.equal(annotations.evolutionTimeOfDay, 'day');
    assert.equal(annotations.evolutionMinLevel, 25);
  });

  void it('round-trips through instantiate (validate passes)', () => {
    const jt = freshJt();
    const quads = jt.toQuads(LycanrocSchema, lycanrocInstance, { 'graphIRI': EVOLUTIONS_GRAPH });
    const lifted = jt.fromQuads(LycanrocSchema, quads);

    const validated = jt.instantiate(LycanrocSchema, lifted[0]);

    assert.ok(isRecord(validated), 'validated instance is a record');
    assert.equal(validated.name, 'Lycanroc-Midday');

    const edge = validated.evolvesFrom;

    assert.ok(isRecord(edge), 'evolvesFrom edge present');
    assert.equal(edge.target, ROCKRUFF_IRI);
  });

  void it('raises an intelligible error when graphIRI is absent for an annotated edge', () => {
    const jt = freshJt();

    assert.throws(
      () => {
        jt.toQuads(LycanrocSchema, lycanrocInstance);
      },
      (error: unknown) => {
        assert.ok(error instanceof MaterializationError);
        assert.equal(error.code, 'MISSING_GRAPH_IRI');
        assert.match(error.message, /graphIRI/u);

        return true;
      }
    );
  });

  void it('serializes Quad-subject quads as Turtle 1.2 << s p o >> via the N3 v2 Writer', async () => {
    const jt = freshJt();
    const quads = jt.toQuads(LycanrocSchema, lycanrocInstance, { 'graphIRI': EVOLUTIONS_GRAPH });

    const annotationQuads = quads.filter((quad) => {
      return isTripleTermSubject(quad);
    });

    const turtle = await new Promise<string>((resolve, reject) => {
      const writer = new Writer({ 'format': 'application/trig' });

      writer.addQuads(annotationQuads);
      writer.end((error: Error | null, result: string) => {
        if (error !== null) {
          reject(error);

          return;
        }
        resolve(result);
      });
    });

    // N3 v2 emits RDF 1.2 / Turtle 1.2 quoted triples. The base triple appears
    // as the quoted-triple subject `<< ... >>` (N3.js renders the inner triple
    // with parentheses: `<<( s p o )>>`). Assert each component is present in a
    // quoted-triple region rather than via one catastrophic-backtracking regex.
    const quoteStart = turtle.indexOf('<<');

    assert.notEqual(quoteStart, -1, 'turtle contains a quoted-triple opener `<<`');

    const quoteEnd = turtle.indexOf('>>', quoteStart);

    assert.notEqual(quoteEnd, -1, 'turtle contains a quoted-triple closer `>>`');

    const quotedTriple = turtle.slice(quoteStart, quoteEnd);

    assert.ok(quotedTriple.includes('Lycanroc-Midday'), 'quoted triple references the subject');
    assert.ok(
      quotedTriple.includes('<https://pokemontology.dev/directEvolvesFrom>'),
      'quoted triple references the edge predicate'
    );
    assert.ok(
      quotedTriple.includes('<https://pokemontology.dev/instances/Rockruff>'),
      'quoted triple references the target object'
    );

    // Both the named graph and the annotation predicates are present.
    assert.ok(
      turtle.includes('<https://pokemontology.dev/graph/universal/evolutions>'),
      'named graph IRI is present'
    );
    assert.match(turtle, /evolutionTimeOfDay>\s+"day"/u);
  });
});
