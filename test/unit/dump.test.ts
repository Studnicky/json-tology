/**
 * dump / dumpJson tests
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { JsonTology } from '../../src/JsonTology.js';
import { Transform } from '../../src/modules/transform/Transform.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PersonSchema = {
  '$id': 'https://example.com/Person',
  'properties': {
    'age': {
      'default': 0,
      'type': 'number'
    },
    'name': { 'type': 'string' }
  },
  'required': ['name'],
  'type': 'object'
} as const;

const AddressSchema = {
  '$id': 'https://example.com/Address',
  'properties': {
    'city': { 'type': 'string' },
    'zip': { 'type': 'string' }
  },
  'type': 'object'
} as const;

const EmployeeSchema = {
  '$id': 'https://example.com/Employee',
  'properties': {
    'address': { '$ref': 'https://example.com/Address' },
    'name': { 'type': 'string' },
    'tags': {
      'items': { 'type': 'string' },
      'type': 'array'
    }
  },
  'required': ['name'],
  'type': 'object'
} as const;

const DateTimeSchema = {
  '$id': 'https://example.com/DateTime',
  'format': 'date-time',
  'type': 'string'
} as const;

const TransformedDateSchema = Transform.create(DateTimeSchema, {
  'decode': (raw: string) => {
    return new Date(raw);
  },
  'encode': (date: Date) => {
    return date.toISOString();
  }
});

const EventSchema = {
  '$id': 'https://example.com/Event',
  'properties': {
    'name': { 'type': 'string' },
    'startAt': {
      '$id': 'https://example.com/DateTime',
      'format': 'date-time',
      'type': 'string'
    }
  },
  'required': [
    'name',
    'startAt'
  ],
  'type': 'object'
} as const;

function makeJt() {
  return JsonTology.create({
    'baseIRI': 'https://example.com',
    'schemas': [
      PersonSchema,
      AddressSchema,
      EmployeeSchema,
      TransformedDateSchema,
      EventSchema
    ] as const
  });
}

// ---------------------------------------------------------------------------
// dump — basic structural copy
// ---------------------------------------------------------------------------

void describe('dump — plain object schema', () => {
  void it('happy: returns structurally equal copy for a plain object', () => {
    const jt = makeJt();
    const value = {
      'age': 30,
      'name': 'Alice'
    };
    const result = jt.dump(PersonSchema.$id, value);

    assert.deepEqual(result, value);
  });

  void it('happy: output is a new object (not the same reference)', () => {
    const jt = makeJt();
    const value = {
      'age': 30,
      'name': 'Alice'
    };
    const result = jt.dump(PersonSchema.$id, value);

    assert.notEqual(result, value);
  });
});

// ---------------------------------------------------------------------------
// dump — exclude
// ---------------------------------------------------------------------------

void describe('dump — exclude option', () => {
  void it('happy: drops listed property names from output', () => {
    const jt = makeJt();
    const value = {
      'age': 30,
      'name': 'Alice'
    };
    const result = jt.dump(PersonSchema.$id, value, { 'exclude': ['age'] }) as Record<string, unknown>;

    assert.equal('age' in result, false);
    assert.equal(result.name, 'Alice');
  });

  void it('edge: exclude with unknown property name is a no-op', () => {
    const jt = makeJt();
    const value = {
      'age': 30,
      'name': 'Alice'
    };
    const result = jt.dump(PersonSchema.$id, value, { 'exclude': ['nonexistent'] });

    assert.deepEqual(result, value);
  });
});

// ---------------------------------------------------------------------------
// dump — include (outranks exclude)
// ---------------------------------------------------------------------------

void describe('dump — include option', () => {
  void it('happy: keeps only listed properties', () => {
    const jt = makeJt();
    const value = {
      'age': 30,
      'name': 'Alice'
    };
    const result = jt.dump(PersonSchema.$id, value, { 'include': ['name'] }) as Record<string, unknown>;

    assert.equal(result.name, 'Alice');
    assert.equal('age' in result, false);
  });

  void it('happy: include takes precedence over exclude when both are set', () => {
    const jt = makeJt();
    const value = {
      'age': 30,
      'name': 'Alice'
    };
    // include says keep 'name'; exclude says drop 'name' — include wins
    const result = jt.dump(PersonSchema.$id, value, {
      'exclude': ['name'],
      'include': ['name']
    }) as Record<string, unknown>;

    assert.equal(result.name, 'Alice');
    assert.equal('age' in result, false);
  });
});

// ---------------------------------------------------------------------------
// dump — excludeUnset
// ---------------------------------------------------------------------------

void describe('dump — excludeUnset option', () => {
  void it('happy: drops properties with undefined value', () => {
    const jt = makeJt();
    const value = {
      'age': undefined,
      'name': 'Alice'
    };
    const result = jt.dump(PersonSchema.$id, value, { 'excludeUnset': true }) as Record<string, unknown>;

    assert.equal('age' in result, false);
    assert.equal(result.name, 'Alice');
  });

  void it('edge: non-undefined values are kept when excludeUnset is true', () => {
    const jt = makeJt();
    const value = {
      'age': 0,
      'name': 'Alice'
    };
    const result = jt.dump(PersonSchema.$id, value, { 'excludeUnset': true }) as Record<string, unknown>;

    assert.equal(result.age, 0);
  });
});

// ---------------------------------------------------------------------------
// dump — excludeDefaults
// ---------------------------------------------------------------------------

void describe('dump — excludeDefaults option', () => {
  void it('happy: drops a property whose value equals the schema default', () => {
    const jt = makeJt();
    // age default is 0
    const value = {
      'age': 0,
      'name': 'Alice'
    };
    const result = jt.dump(PersonSchema.$id, value, { 'excludeDefaults': true }) as Record<string, unknown>;

    assert.equal('age' in result, false);
    assert.equal(result.name, 'Alice');
  });

  void it('edge: non-default value is kept when excludeDefaults is true', () => {
    const jt = makeJt();
    const value = {
      'age': 25,
      'name': 'Alice'
    };
    const result = jt.dump(PersonSchema.$id, value, { 'excludeDefaults': true }) as Record<string, unknown>;

    assert.equal(result.age, 25);
  });
});

// ---------------------------------------------------------------------------
// dump — Transform encoder
// ---------------------------------------------------------------------------

void describe('dump — Transform encoder', () => {
  void it('happy: applies Transform encode to produce wire form', () => {
    const jt = makeJt();
    const isoString = '2026-01-01T00:00:00.000Z';
    const dateValue = new Date(isoString);
    const result = jt.dump(TransformedDateSchema.$id, dateValue);

    assert.equal(result, isoString);
  });

  void it('happy: round-trip decode then dump returns original wire value', () => {
    const jt = makeJt();
    const isoString = '2026-06-15T12:00:00.000Z';
    const decoded = jt.coerce(TransformedDateSchema.$id, isoString);
    const wire = jt.dump(TransformedDateSchema.$id, decoded);

    assert.equal(wire, isoString);
  });
});

// ---------------------------------------------------------------------------
// dump — mode 'json'
// ---------------------------------------------------------------------------

void describe('dump — mode json', () => {
  void it('happy: converts Date leaf to ISO string', () => {
    const jt = makeJt();
    const date = new Date('2026-01-01T00:00:00.000Z');
    // dump the Date value directly (no schema transform on PersonSchema, simulate ad-hoc)
    const result = jt.dump(TransformedDateSchema.$id, date, { 'mode': 'json' });

    assert.equal(result, '2026-01-01T00:00:00.000Z');
  });

  void it('edge: plain object leaves are untouched in json mode', () => {
    const jt = makeJt();
    const value = {
      'age': 30,
      'name': 'Alice'
    };
    const result = jt.dump(PersonSchema.$id, value, { 'mode': 'json' });

    assert.deepEqual(result, value);
  });
});

// ---------------------------------------------------------------------------
// dump — nested objects
// ---------------------------------------------------------------------------

void describe('dump — nested object properties', () => {
  void it('happy: recursively dumps nested object properties', () => {
    const jt = makeJt();
    const value = {
      'address': {
        'city': 'Portland',
        'zip': '97201'
      },
      'name': 'Alice'
    };
    const result = jt.dump(EmployeeSchema.$id, value);

    assert.deepEqual(result, value);
  });

  void it('happy: exclude applies recursively within nested objects via top-level filter', () => {
    const jt = makeJt();
    const value = {
      'address': {
        'city': 'Portland',
        'zip': '97201'
      },
      'name': 'Alice'
    };
    const result = jt.dump(EmployeeSchema.$id, value, { 'exclude': ['address'] }) as Record<string, unknown>;

    assert.equal('address' in result, false);
    assert.equal(result.name, 'Alice');
  });
});

// ---------------------------------------------------------------------------
// dump — array items
// ---------------------------------------------------------------------------

void describe('dump — array items', () => {
  void it('happy: recursively dumps array items', () => {
    const jt = makeJt();
    const value = {
      'name': 'Alice',
      'tags': [
        'engineer',
        'ts'
      ]
    };
    const result = jt.dump(EmployeeSchema.$id, value) as Record<string, unknown>;

    assert.deepEqual(result.tags, [
      'engineer',
      'ts'
    ]);
  });
});

// ---------------------------------------------------------------------------
// dumpJson
// ---------------------------------------------------------------------------

void describe('dumpJson', () => {
  void it('happy: returns a JSON string', () => {
    const jt = makeJt();
    const value = {
      'age': 30,
      'name': 'Alice'
    };
    const result = jt.dumpJson(PersonSchema.$id, value);

    assert.equal(typeof result, 'string');
  });

  void it('happy: JSON.parse of result equals original value', () => {
    const jt = makeJt();
    const value = {
      'age': 30,
      'name': 'Alice'
    };
    const json = jt.dumpJson(PersonSchema.$id, value);

    assert.deepEqual(JSON.parse(json), value);
  });

  void it('happy: Date values are serialized as ISO strings (round-trip via JSON.parse)', () => {
    const jt = makeJt();
    const isoString = '2026-01-01T00:00:00.000Z';
    const decoded = jt.coerce(TransformedDateSchema.$id, isoString);
    const json = jt.dumpJson(TransformedDateSchema.$id, decoded);
    const parsed = JSON.parse(json) as string;

    assert.equal(parsed, isoString);
  });

  void it('happy: dumpJson with exclude option drops field in JSON output', () => {
    const jt = makeJt();
    const value = {
      'age': 30,
      'name': 'Alice'
    };
    const json = jt.dumpJson(PersonSchema.$id, value, { 'exclude': ['age'] });
    const parsed = JSON.parse(json) as Record<string, unknown>;

    assert.equal('age' in parsed, false);
    assert.equal(parsed.name, 'Alice');
  });

  void it('happy: schema object overload works the same as schema ID overload', () => {
    const jt = makeJt();
    const value = {
      'age': 30,
      'name': 'Alice'
    };
    const byId = jt.dumpJson(PersonSchema.$id, value);
    const bySchema = jt.dumpJson(PersonSchema, value);

    assert.equal(byId, bySchema);
  });
});
