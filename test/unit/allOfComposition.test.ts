/**
 * allOf-composition tests — value.create and Compose.getDefaults
 *
 * Covers: Compose.subClassOf-produced schemas (allOf + $ref + inline body).
 * Uses small inline fixtures plus the canonical bookstore schemas where noted.
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import {
  Compose, JsonTology
} from '../../src/index.js';

// ===========================================================================
// value.create — allOf-aware synthesis
// ===========================================================================

void describe('value.create — allOf-composed schemas', { 'concurrency': false }, () => {
  // All schemas carry unique IDs per test scope (strict duplicate detection is on).

  void it('flat schema: synthesizes required fields and declared defaults unchanged', () => {
    const FlatBase = {
      '$id': 'urn:test:allof:create:FlatBase',
      'properties': {
        'id': { 'type': 'string' },
        'kind': {
          'default': 'base',
          'type': 'string'
        },
        'score': { 'type': 'number' }
      },
      'required': [
        'id',
        'kind'
      ],
      'type': 'object'
    } as const;
    const jt = JsonTology.create({
      'baseIRI': 'urn:test:allof:create:',
      'schemas': [FlatBase]
    });
    const result = jt.value.create(FlatBase.$id) as Record<string, unknown>;

    // Required with no default → zero-value
    assert.equal(result.id, '');
    // Required with default → default applied
    assert.equal(result.kind, 'base');
    // Optional with no default → absent
    assert.equal('score' in result, false);
  });

  void it('2-level composition: inherits required + own required fields', () => {
    const Base2L = {
      '$id': 'urn:test:allof:create:Base2L',
      'properties': {
        'id': { 'type': 'string' },
        'kind': {
          'default': 'base',
          'type': 'string'
        }
      },
      'required': [
        'id',
        'kind'
      ],
      'type': 'object'
    } as const;
    const Child2L = Compose.subClassOf(Base2L, {
      '$id': 'urn:test:allof:create:Child2L',
      'properties': {
        'active': {
          'default': true,
          'type': 'boolean'
        },
        'label': { 'type': 'string' }
      },
      'required': ['label'],
      'type': 'object'
    } as const);
    const jt = JsonTology.create({
      'baseIRI': 'urn:test:allof:create:',
      'schemas': [
        Base2L,
        Child2L as unknown as Record<string, unknown> & { '$id': string }
      ]
    });
    const result = jt.value.create(Child2L.$id) as Record<string, unknown>;

    // Inherited required fields (from Base)
    assert.equal(result.id, '');
    // Inherited required field with default
    assert.equal(result.kind, 'base');
    // Own required field (no default → zero-value)
    assert.equal(result.label, '');
    // Own field with declared default
    assert.equal(result.active, true);
    // Optional fields absent
    assert.equal('score' in result, false);
  });

  void it('2-level composition: declared defaults override zero-values', () => {
    const BaseDef = {
      '$id': 'urn:test:allof:create:BaseDef',
      'properties': {
        'kind': {
          'default': 'base',
          'type': 'string'
        },
        'name': { 'type': 'string' }
      },
      'required': [
        'kind',
        'name'
      ],
      'type': 'object'
    } as const;
    const ChildDef = Compose.subClassOf(BaseDef, {
      '$id': 'urn:test:allof:create:ChildDef',
      'properties': {
        'active': {
          'default': true,
          'type': 'boolean'
        }
      },
      'required': ['active'],
      'type': 'object'
    } as const);
    const jt = JsonTology.create({
      'baseIRI': 'urn:test:allof:create:',
      'schemas': [
        BaseDef,
        ChildDef as unknown as Record<string, unknown> & { '$id': string }
      ]
    });
    const result = jt.value.create(ChildDef.$id) as Record<string, unknown>;

    // Declared default on `kind` must win over zero-value ('')
    assert.equal(result.kind, 'base');
    // Declared default on `active` applied
    assert.equal(result.active, true);
  });

  void it('3-level composition: inherits all required fields across chain', () => {
    const BaseGP = {
      '$id': 'urn:test:allof:create:BaseGP',
      'properties': {
        'id': { 'type': 'string' },
        'kind': {
          'default': 'base',
          'type': 'string'
        }
      },
      'required': [
        'id',
        'kind'
      ],
      'type': 'object'
    } as const;
    const ChildGP = Compose.subClassOf(BaseGP, {
      '$id': 'urn:test:allof:create:ChildGP',
      'properties': {
        'active': {
          'default': true,
          'type': 'boolean'
        },
        'label': { 'type': 'string' }
      },
      'required': ['label'],
      'type': 'object'
    } as const);
    // 3rd level: subClassOf of ChildGP (itself allOf-composed)
    const GrandchildGP = {
      '$id': 'urn:test:allof:create:GrandchildGP',
      'allOf': [
        { '$ref': ChildGP.$id },
        {
          'properties': {
            'rank': { 'type': 'number' },
            'tag': {
              'default': 'gc',
              'type': 'string'
            }
          },
          'required': ['rank'],
          'type': 'object'
        }
      ]
    } as const;

    type SchemaWithId = Record<string, unknown> & { '$id': string };
    const schemas3L: readonly SchemaWithId[] = [
      BaseGP,
      ChildGP,
      GrandchildGP
    ];
    const jt = JsonTology.create({
      'baseIRI': 'urn:test:allof:create:',
      'schemas': schemas3L
    });
    const result = jt.value.create(GrandchildGP.$id) as Record<string, unknown>;

    // From Base (grandparent)
    assert.equal(result.id, '');
    assert.equal(result.kind, 'base');
    // From Child (parent)
    assert.equal(result.label, '');
    assert.equal(result.active, true);
    // Own fields
    assert.equal(result.rank, 0);
    assert.equal(result.tag, 'gc');
  });

  void it('flat schema behavior is preserved: no regressions', () => {
    const FlatReg = {
      '$id': 'urn:test:allof:create:FlatReg',
      'properties': {
        'count': { 'type': 'number' },
        'name': {
          'default': 'anon',
          'type': 'string'
        }
      },
      'required': ['count'],
      'type': 'object'
    } as const;
    const jt = JsonTology.create({
      'baseIRI': 'urn:test:allof:create:',
      'schemas': [FlatReg]
    });
    const result = jt.value.create(FlatReg.$id) as Record<string, unknown>;

    assert.equal(result.count, 0);
    assert.equal(result.name, 'anon');
  });

  void it('returns null for untyped schema with no allOf — no regression', () => {
    const EmptyS = { '$id': 'urn:test:allof:create:EmptyS' } as const;
    const jt = JsonTology.create({
      'baseIRI': 'urn:test:allof:create:',
      'schemas': [EmptyS]
    });

    assert.equal(jt.value.create(EmptyS.$id), null);
  });
});

// ===========================================================================
// Compose.getDefaults — allOf-aware extraction
// ===========================================================================

void describe('Compose.getDefaults — allOf-composed schemas', { 'concurrency': false }, () => {
  void it('flat schema: extracts declared defaults, no regressions', () => {
    const schema = {
      'properties': {
        'active': {
          'default': true,
          'type': 'boolean'
        },
        'name': {
          'default': 'anon',
          'type': 'string'
        },
        'score': { 'type': 'number' }
      },
      'type': 'object'
    } as const;
    const defaults = Compose.getDefaults(schema);

    assert.equal(defaults.name, 'anon');
    assert.equal(defaults.active, true);
    assert.equal('score' in defaults, false);
  });

  void it('2-level composition: collects defaults from inline allOf body member', () => {
    const ParentDef = {
      '$id': 'urn:test:allof:getd:Parent',
      'properties': {
        'kind': {
          'default': 'base',
          'type': 'string'
        }
      },
      'type': 'object'
    } as const;
    const ChildDef = Compose.subClassOf(ParentDef, {
      '$id': 'urn:test:allof:getd:Child',
      'properties': {
        'active': {
          'default': true,
          'type': 'boolean'
        },
        'label': { 'type': 'string' }
      },
      'required': ['label'],
      'type': 'object'
    } as const);

    // active has default:true in the inline allOf member
    const defaults = Compose.getDefaults(ChildDef);

    assert.equal(defaults.active, true);
    // label has no default
    assert.equal('label' in defaults, false);
  });

  void it('$ref-only allOf member is skipped gracefully (no registry available)', () => {
    // The $ref member (urn:test:allof:getd:Parent) has kind:default:'base' inside it,
    // but getDefaults cannot resolve $ref without a registry — correctly absent.
    const ParentRef = {
      '$id': 'urn:test:allof:getd:ParentRef',
      'properties': {
        'kind': {
          'default': 'base',
          'type': 'string'
        }
      },
      'type': 'object'
    } as const;
    const ChildRef = Compose.subClassOf(ParentRef, {
      '$id': 'urn:test:allof:getd:ChildRef',
      'properties': {
        'active': {
          'default': true,
          'type': 'boolean'
        }
      },
      'required': ['active'],
      'type': 'object'
    } as const);

    const defaults = Compose.getDefaults(ChildRef);

    // Parent's `kind` default is behind $ref — not surfaced
    assert.equal('kind' in defaults, false);
    // Own inline default IS surfaced
    assert.equal(defaults.active, true);
  });

  void it('3-level composition: collects defaults from own inline body', () => {
    // GrandchildGP-style: { allOf: [{ $ref: childId }, { properties: { tag:{default:'gc'} } }] }
    const grandSchema = {
      '$id': 'urn:test:allof:getd:Grand',
      'allOf': [
        { '$ref': 'urn:test:allof:getd:SomeChild' },
        {
          'properties': {
            'rank': { 'type': 'number' },
            'tag': {
              'default': 'gc',
              'type': 'string'
            }
          },
          'required': ['rank'],
          'type': 'object'
        }
      ]
    };
    const defaults = Compose.getDefaults(grandSchema);

    // Own inline default
    assert.equal(defaults.tag, 'gc');
    // rank has no default
    assert.equal('rank' in defaults, false);
  });

  void it('schema with no allOf and no properties returns {}', () => {
    const defaults = Compose.getDefaults({ '$id': 'urn:test:allof:getd:Bare' });

    assert.deepEqual(defaults, {});
  });

  void it('deep-clone: mutations on returned defaults do not affect subsequent calls', () => {
    const schema = {
      'properties': {
        'tags': {
          'default': [
            'a',
            'b'
          ],
          'type': 'array'
        }
      },
      'type': 'object'
    } as const;
    const d1 = Compose.getDefaults(schema);
    const d2 = Compose.getDefaults(schema);

    (d1.tags as string[]).push('c');
    assert.deepEqual(d2.tags, [
      'a',
      'b'
    ]);
  });

  void it('allOf with only inline members (no $ref): merges defaults from all', () => {
    const schema = {
      '$id': 'urn:test:allof:getd:InlineOnly',
      'allOf': [
        {
          'properties': {
            'alpha': {
              'default': 1,
              'type': 'number'
            }
          },
          'type': 'object'
        },
        {
          'properties': {
            'beta': {
              'default': 2,
              'type': 'number'
            }
          },
          'type': 'object'
        }
      ]
    };
    const defaults = Compose.getDefaults(schema);

    assert.equal(defaults.alpha, 1);
    assert.equal(defaults.beta, 2);
  });

  void it('later allOf inline member default overrides earlier on key conflict', () => {
    const schema = {
      '$id': 'urn:test:allof:getd:Override',
      'allOf': [
        {
          'properties': {
            'x': {
              'default': 'first',
              'type': 'string'
            }
          },
          'type': 'object'
        },
        {
          'properties': {
            'x': {
              'default': 'second',
              'type': 'string'
            }
          },
          'type': 'object'
        }
      ]
    };
    const defaults = Compose.getDefaults(schema);

    assert.equal(defaults.x, 'second');
  });
});
