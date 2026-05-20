// ============================================================
// AUTO-GENERATED — DO NOT EDIT
// Generated: 2026-05-20T04:39:50.519Z
// Source:    examples/docs/ontologies/foaf-subset.jsonld
// IRI:       http://xmlns.com/foaf/0.1/Person
// ============================================================

import type { InferType } from 'json-tology/types';

export const PersonSchema = {
  "$id": "http://xmlns.com/foaf/0.1/Person",
  "allOf": [
    {
      "$ref": "http://xmlns.com/foaf/0.1/Agent",
    },
  ],
  "description": "A person.",
  "disjointWith": "http://xmlns.com/foaf/0.1/Group",
  "properties": {
    "knows": {
      "$ref": "http://xmlns.com/foaf/0.1/Person",
    },
  },
  "required": [],
  "title": "Person",
  "type": "object",
} as const;

export type Person = InferType<typeof PersonSchema>;
