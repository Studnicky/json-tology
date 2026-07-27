import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';
import { RdfJsTermEntity } from './RdfJsTermEntity.js';

/**
 * JsonLdDatasetQuadEntity — shape of a single quad as emitted by `jsonld.toRDF()`.
 *
 * @remarks
 * `subject`, `predicate`, and `graph` carry a `DatasetTerm` (a `termType`
 * discriminator and a `value` string). `object` additionally carries an
 * optional `datatype` (itself a `DatasetTerm`) and `language` for RDF
 * literals. This entity is used exclusively by {@link QuadFactory.fromDatasetQuad}
 * to convert jsonld dataset quads into the project-canonical `QuadInterface`
 * representation.
 *
 * @example
 * ```ts
 * const quad = QuadFactory.fromDatasetQuad(datasetQuad);
 * ```
 *
 * @category RDF
 * @since 0.1.0
 * @see {@link QuadFactory}
 * @group QuadFactory
 */
export namespace JsonLdDatasetQuadEntity {
  export const Schema = {
    'definitions': {
      'DatasetLiteralTerm': {
        'properties': {
          'datatype': { '$ref': '#/definitions/DatasetTerm' },
          'language': { 'type': 'string' },
          ...RdfJsTermEntity.Schema.properties
        },
        'required': RdfJsTermEntity.Schema.required,
        'type': 'object'
      },
      'DatasetTerm': RdfJsTermEntity.Schema
    },
    'properties': {
      'graph': { '$ref': '#/definitions/DatasetTerm' },
      'object': { '$ref': '#/definitions/DatasetLiteralTerm' },
      'predicate': { '$ref': '#/definitions/DatasetTerm' },
      'subject': { '$ref': '#/definitions/DatasetTerm' }
    },
    'required': [
      'graph',
      'object',
      'predicate',
      'subject'
    ],
    'type': 'object'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return RdfJsTermEntity.validate(value.graph)
      && RdfJsTermEntity.validate(value.object)
      && RdfJsTermEntity.validate(value.predicate)
      && RdfJsTermEntity.validate(value.subject);
  }
}
