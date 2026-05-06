/**
 * toQuads / fromQuads — v2 iriFor / graphIRI / deskolemize integration tests.
 *
 * Covers the full skolemization design landed in feat/skolemizer-v2:
 *   - iriFor as string (root-only override)
 *   - iriFor as 'blank-node' (every subject is _:b<n>)
 *   - iriFor as Skolemize.fromProperty / Skolemize.wellKnownGenid
 *   - iriFor function ctx + memoization
 *   - registry-level iriFor / defaultGraphIRI / defaultDeskolemize
 *   - v1 backwards compatibility (subjectIRI alias)
 *   - fromQuads round-trip with deskolemize
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import { JsonTology } from '../../src/JsonTology.js';
import { Skolemize } from '../../src/modules/rdf/Skolemize.js';
import type { SkolemizeFnType } from '../../src/types/Skolemize.js';

const UserSchema = {
  '$id': 'https://example.com/User',
  'properties': {
    'email': { 'type': 'string' },
    'name': { 'type': 'string' }
  },
  'required': ['name'],
  'type': 'object'
} as const;

const TeamSchema = {
  '$defs': {
    'Member': {
      'properties': {
        'name': { 'type': 'string' },
        'role': { 'type': 'string' }
      },
      'required': ['name'],
      'type': 'object'
    }
  },
  '$id': 'https://example.com/Team',
  'properties': {
    'lead': { '$ref': '#/$defs/Member' },
    'members': {
      'items': { '$ref': '#/$defs/Member' },
      'type': 'array'
    },
    'name': { 'type': 'string' }
  },
  'required': [
    'lead',
    'name'
  ],
  'type': 'object'
} as const;

const noopSkolemize: SkolemizeFnType = () => {
  return;
};

void describe('toQuads — iriFor as string', () => {
  void it('overrides only the root subject IRI', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://example.com',
      'schemas': [TeamSchema]
    });
    const quads = jt.toQuads(TeamSchema, {
      'lead': { 'name': 'Dana' },
      'name': 'Platform'
    }, { 'iriFor': 'https://example.com/teams/platform' });

    const rootHits = quads.filter((quad) => {
      return quad.subject === 'https://example.com/teams/platform';
    });

    assert.ok(rootHits.length > 0, 'root override should be applied');

    const nestedSubjects = new Set(quads.map((quad) => {
      return quad.subject;
    }));

    nestedSubjects.delete('https://example.com/teams/platform');
    for (const subject of nestedSubjects) {
      assert.ok(subject.includes('/instances/'), `nested subject should fall through, got ${subject}`);
    }
  });
});

void describe("toQuads — iriFor: 'blank-node'", () => {
  void it('emits _:b<n> for every object subject', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://example.com',
      'schemas': [TeamSchema]
    });
    const quads = jt.toQuads(TeamSchema, {
      'lead': { 'name': 'Dana' },
      'members': [
        { 'name': 'Eve' },
        { 'name': 'Finn' }
      ],
      'name': 'Platform'
    }, { 'iriFor': 'blank-node' });

    const subjects = new Set(quads.map((quad) => {
      return quad.subject;
    }));

    for (const subject of subjects) {
      assert.match(subject, /^_:b\d+$/u, `subject should be a blank node: ${subject}`);
    }
  });

  void it('counter is scoped per call (independent counters)', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://example.com',
      'schemas': [UserSchema]
    });
    const quadsA = jt.toQuads(UserSchema, { 'name': 'Alice' }, { 'iriFor': 'blank-node' });
    const quadsB = jt.toQuads(UserSchema, { 'name': 'Bob' }, { 'iriFor': 'blank-node' });

    assert.equal(quadsA[0].subject, '_:b0');
    assert.equal(quadsB[0].subject, '_:b0');
  });
});

void describe('toQuads — Skolemize.fromProperty', () => {
  void it('mints IRI from property when present', () => {
    const Schema = {
      '$id': 'https://example.com/Doc',
      'properties': {
        'id': { 'type': 'string' },
        'title': { 'type': 'string' }
      },
      'required': ['id'],
      'type': 'object'
    } as const;
    const jt = JsonTology.create({
      'baseIRI': 'https://example.com',
      'schemas': [Schema]
    });
    const quads = jt.toQuads(Schema, {
      'id': 'doc-42',
      'title': 'Hello'
    }, { 'iriFor': Skolemize.fromProperty('id', { 'baseIRI': 'https://example.com/docs' }) });
    const subjects = new Set(quads.map((quad) => {
      return quad.subject;
    }));

    assert.ok(subjects.has('https://example.com/docs/doc-42'));
  });

  void it('falls through to fallback for nodes missing the property', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://example.com',
      'schemas': [TeamSchema]
    });
    let fallbackCalls = 0;
    const fallback: SkolemizeFnType = () => {
      fallbackCalls++;

      return;
    };
    const strategy = Skolemize.fromProperty('id', {
      'baseIRI': 'https://example.com/by-id',
      fallback
    });

    jt.toQuads(TeamSchema, {
      'lead': { 'name': 'Dana' },
      'name': 'Platform'
    }, { 'iriFor': strategy });

    assert.ok(fallbackCalls >= 2, 'every value lacks id; fallback should be invoked');
  });
});

void describe('toQuads — Skolemize.wellKnownGenid', () => {
  void it('every minted IRI contains /.well-known/genid/', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://example.com',
      'schemas': [TeamSchema]
    });
    const quads = jt.toQuads(TeamSchema, {
      'lead': { 'name': 'Dana' },
      'members': [{ 'name': 'Eve' }],
      'name': 'Platform'
    }, { 'iriFor': Skolemize.wellKnownGenid('https://example.com') });

    const namedSubjects = new Set(quads.map((quad) => {
      return quad.subject;
    }));

    for (const subject of namedSubjects) {
      assert.match(subject, /\/\.well-known\/genid\//u);
    }
  });
});

void describe('toQuads — iriFor function ctx', () => {
  void it('receives correct path, value, depth at each call', () => {
    const recorded: Array<{ 'depth': number;
      'path': string;
      'value': unknown }> = [];
    const recorder: SkolemizeFnType = (ctx) => {
      recorded.push({ ...ctx });

      return;
    };
    const jt = JsonTology.create({
      'baseIRI': 'https://example.com',
      'schemas': [TeamSchema]
    });

    jt.toQuads(TeamSchema, {
      'lead': { 'name': 'Dana' },
      'members': [{ 'name': 'Eve' }],
      'name': 'Platform'
    }, { 'iriFor': recorder });

    assert.ok(recorded.length >= 3, 'recorder should be called for root + lead + member');

    const root = recorded.find((entry) => {
      return entry.depth === 0;
    });

    assert.ok(root !== undefined, 'root call has depth 0');
    assert.equal(root.path, '');

    const lead = recorded.find((entry) => {
      return entry.path === '/lead';
    });

    assert.ok(lead !== undefined, 'lead path observed');
    assert.ok(lead.depth >= 1, 'lead depth > 0');
  });

  void it('memoizes by value reference within a single projectAbox call', () => {
    const data = {
      'lead': { 'name': 'Dana' },
      'members': [
        { 'name': 'Eve' },
        { 'name': 'Finn' }
      ],
      'name': 'Platform'
    };
    const jt = JsonTology.create({
      'baseIRI': 'https://example.com',
      'schemas': [TeamSchema]
    });

    let calls = 0;
    const counter: SkolemizeFnType = () => {
      calls++;

      return;
    };

    jt.toQuads(TeamSchema, data, { 'iriFor': counter });

    // Four distinct object subjects: root team + lead + 2 members.
    // Memoization means each unique value reference triggers one call.
    assert.equal(calls, 4);
  });
});

void describe('toQuads — registry-level config', () => {
  void it('inherits registry-level iriFor', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://example.com',
      'iriFor': 'https://example.com/registry-default',
      'schemas': [UserSchema]
    });
    const quads = jt.toQuads(UserSchema, { 'name': 'Alice' });
    const subjects = new Set(quads.map((quad) => {
      return quad.subject;
    }));

    assert.ok(subjects.has('https://example.com/registry-default'));
  });

  void it('per-call iriFor overrides registry default', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://example.com',
      'iriFor': 'https://example.com/registry-default',
      'schemas': [UserSchema]
    });
    const quads = jt.toQuads(UserSchema, { 'name': 'Alice' }, { 'iriFor': 'https://example.com/per-call' });
    const subjects = new Set(quads.map((quad) => {
      return quad.subject;
    }));

    assert.ok(subjects.has('https://example.com/per-call'));
    assert.equal(subjects.has('https://example.com/registry-default'), false);
  });

  void it('inherits registry-level defaultGraphIRI', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://example.com',
      'defaultGraphIRI': 'https://example.com/g/default',
      'schemas': [UserSchema]
    });
    const quads = jt.toQuads(UserSchema, { 'name': 'Alice' });

    for (const quad of quads) {
      assert.equal(quad.graph, 'https://example.com/g/default');
    }
  });

  void it('per-call graphIRI overrides registry default', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://example.com',
      'defaultGraphIRI': 'https://example.com/g/default',
      'schemas': [UserSchema]
    });
    const quads = jt.toQuads(UserSchema, { 'name': 'Alice' }, { 'graphIRI': 'https://example.com/g/override' });

    for (const quad of quads) {
      assert.equal(quad.graph, 'https://example.com/g/override');
    }
  });

  void it('blank-node registry-level config produces fresh counters per call', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://example.com',
      'iriFor': 'blank-node',
      'schemas': [UserSchema]
    });
    const quadsA = jt.toQuads(UserSchema, { 'name': 'A' });
    const quadsB = jt.toQuads(UserSchema, { 'name': 'B' });

    assert.equal(quadsA[0].subject, '_:b0');
    assert.equal(quadsB[0].subject, '_:b0');
  });
});

void describe('toQuads — v1 backwards compatibility', () => {
  void it('subjectIRI: string still works as root override', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://example.com',
      'schemas': [UserSchema]
    });
    const quads = jt.toQuads(UserSchema, { 'name': 'Alice' }, { 'subjectIRI': 'https://example.com/legacy/alice' });
    const subjects = new Set(quads.map((quad) => {
      return quad.subject;
    }));

    assert.ok(subjects.has('https://example.com/legacy/alice'));
  });

  void it('iriFor takes precedence when both are set', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://example.com',
      'schemas': [UserSchema]
    });
    const quads = jt.toQuads(UserSchema, { 'name': 'Alice' }, {
      'iriFor': 'https://example.com/new',
      'subjectIRI': 'https://example.com/legacy'
    });
    const subjects = new Set(quads.map((quad) => {
      return quad.subject;
    }));

    assert.ok(subjects.has('https://example.com/new'));
    assert.equal(subjects.has('https://example.com/legacy'), false);
  });
});

void describe('fromQuads — deskolemize round-trip', () => {
  void it('reproduces input data when paired with Skolemize.wellKnownGenid', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://example.com',
      'schemas': [UserSchema]
    });
    const input = {
      'email': 'a@x.com',
      'name': 'Alice'
    };
    const quads = jt.toQuads(UserSchema, input, { 'iriFor': Skolemize.wellKnownGenid('https://example.com') });
    const lifted = jt.fromQuads(UserSchema.$id, quads, { 'deskolemize': true });

    assert.ok(lifted.length > 0);
    const first = lifted[0] as Record<string, unknown>;

    assert.equal(first.name, 'Alice');
    assert.equal(first.email, 'a@x.com');
  });

  void it('registry-level defaultDeskolemize is honored', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://example.com',
      'defaultDeskolemize': true,
      'schemas': [UserSchema]
    });
    const input = {
      'email': 'a@x.com',
      'name': 'Alice'
    };
    const quads = jt.toQuads(UserSchema, input, { 'iriFor': Skolemize.wellKnownGenid('https://example.com') });
    const lifted = jt.fromQuads(UserSchema.$id, quads);

    assert.ok(lifted.length > 0);
    const first = lifted[0] as Record<string, unknown>;

    assert.equal(first.name, 'Alice');
  });

  void it('passthrough: noopSkolemize falls back to default IRI', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://example.com',
      'schemas': [TeamSchema]
    });

    const quads = jt.toQuads(TeamSchema, {
      'lead': { 'name': 'Dana' },
      'name': 'Platform'
    }, { 'iriFor': noopSkolemize });

    const rootCount = quads.filter((quad) => {
      return quad.subject.includes('/instances/');
    }).length;

    assert.ok(rootCount > 0, 'noopSkolemize falls through to default minter');
  });
});
