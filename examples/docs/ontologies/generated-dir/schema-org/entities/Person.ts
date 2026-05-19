// ============================================================
// AUTO-GENERATED — DO NOT EDIT
// Generated: 2026-05-19T16:53:58.884Z
// Source:    examples/docs/ontologies/schema-org-subset.jsonld
// IRI:       https://schema.org/Person
// ============================================================

import type { InferType } from 'json-tology/types';

export const PersonSchema = {
  "$id": "https://schema.org/Person",
  "allOf": [
    {
      "$ref": "https://schema.org/Thing",
    },
  ],
  "description": "A person (alive, dead, undead, or fictional).",
  "properties": {},
  "required": [],
  "title": "Person",
  "type": "object",
} as const;

export type Person = InferType<typeof PersonSchema>;
