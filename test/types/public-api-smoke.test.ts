import type { JSONSchema7 } from 'json-schema';
import {
  type InferType, JsonTology
} from '../../src/index.js';

const UserSchema = {
  '$id': 'https://example.com/User',
  'properties': {
    'id': { 'type': 'string' },
    'name': { 'type': 'string' }
  },
  'required': [
    'id',
    'name'
  ],
  'type': 'object'
} as const satisfies JSONSchema7;

type User = InferType<typeof UserSchema>;

const jt = JsonTology.create({
  'baseIRI': 'https://example.com',
  'schemas': [UserSchema] as const
});

const input: User = {
  'id': 'user-1',
  'name': 'Ada'
};

const parsed: User = jt.coerce(UserSchema, input);
const materialized: User = jt.materialize(UserSchema, {
  'id': 'user-1',
  'name': 'Ada'
});
const ontology = jt.ontology().jsonLd();
const quads = jt.toQuads(UserSchema, input).jsonLd();

void parsed;
void materialized;
void ontology;
void quads;
