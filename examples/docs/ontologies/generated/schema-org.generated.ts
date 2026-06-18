// ============================================================
// AUTO-GENERATED — DO NOT EDIT
// Generated: 2026-05-20T04:39:50.522Z
// Source:    examples/docs/ontologies/schema-org-subset.jsonld
// ============================================================

import { JsonTology } from 'json-tology';
import type { InferType } from 'json-tology/types';

export const ThingSchema = {
  "$id": "https://schema.org/Thing",
  "description": "The most generic type.",
  "properties": {
    "name": {
      "type": "string",
    },
  },
  "required": [],
  "title": "Thing",
  "type": "object",
} as const;

export const IsbnTypeSchema = {
  "$id": "https://schema.org/IsbnType",
  "description": "A 13-digit ISBN string. XSD-facet restriction: pattern ^\\d{13}$.",
  "pattern": "^\\d{13}$",
  "title": "IsbnType",
  "type": "string",
} as const;

export const NameSchema = {
  "$id": "https://schema.org/name",
  "description": "The name of the item.",
  "title": "name",
} as const;

export const IsbnSchema = {
  "$id": "https://schema.org/Book#isbn",
  "description": "The ISBN of the book.",
  "title": "isbn",
} as const;

export const AuthorSchema = {
  "$id": "https://schema.org/author",
  "description": "The author of this content.",
  "title": "author",
} as const;

export const PublisherSchema = {
  "$id": "https://schema.org/publisher",
  "description": "The publisher of the creative work.",
  "title": "publisher",
} as const;

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

export const OrganizationSchema = {
  "$id": "https://schema.org/Organization",
  "allOf": [
    {
      "$ref": "https://schema.org/Thing",
    },
  ],
  "description": "An organization such as a school, NGO, corporation, club, etc.",
  "properties": {},
  "required": [],
  "title": "Organization",
  "type": "object",
} as const;

export const BookSchema = {
  "$id": "https://schema.org/Book",
  "allOf": [
    {
      "$ref": "https://schema.org/Thing",
    },
  ],
  "description": "A book.",
  "properties": {
    "author": {
      "$ref": "https://schema.org/Person",
    },
    "isbn": {
      "$ref": "https://schema.org/IsbnType",
    },
    "publisher": {
      "$ref": "https://schema.org/Organization",
    },
  },
  "required": [],
  "title": "Book",
  "type": "object",
} as const;

export const schemaOrgSchemas = [
  ThingSchema,
  IsbnTypeSchema,
  NameSchema,
  IsbnSchema,
  AuthorSchema,
  PublisherSchema,
  PersonSchema,
  OrganizationSchema,
  BookSchema,
] as const;

export const schemaOrg = JsonTology.create({
  "baseIri": "https://schema.org",
  "schemas": schemaOrgSchemas,
} as const);

export type Thing = InferType<typeof ThingSchema>;
export type IsbnType = InferType<typeof IsbnTypeSchema>;
export type Name = InferType<typeof NameSchema>;
export type Isbn = InferType<typeof IsbnSchema>;
export type Author = InferType<typeof AuthorSchema>;
export type Publisher = InferType<typeof PublisherSchema>;
export type Person = InferType<typeof PersonSchema>;
export type Organization = InferType<typeof OrganizationSchema>;
export type Book = InferType<typeof BookSchema>;

// ============================================================
// END AUTO-GENERATED
// ============================================================
