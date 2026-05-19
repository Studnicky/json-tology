// ============================================================
// AUTO-GENERATED — DO NOT EDIT
// Generated: 2026-05-19T16:53:58.881Z
// Source:    examples/docs/ontologies/foaf-subset.jsonld
// IRI:       http://xmlns.com/foaf/0.1/knows
// ============================================================

import type { InferType } from 'json-tology/types';

export const KnowsSchema = {
  "$id": "http://xmlns.com/foaf/0.1/knows",
  "description": "A person known by this person (indicating some level of reciprocated interaction between the parties).",
  "title": "knows",
} as const;

export type Knows = InferType<typeof KnowsSchema>;
