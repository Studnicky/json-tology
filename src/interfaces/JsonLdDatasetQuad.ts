/**
 * JsonLdDatasetQuad — shape of a single quad as emitted by `jsonld.toRDF()`.
 *
 * @remarks
 * Each property holds a `DatasetTerm` with a `termType` discriminator and a
 * `value` string. The `object` additionally carries an optional `datatype`
 * and `language` for RDF literals. This interface is used exclusively by
 * {@link QuadFactory.fromDatasetQuad} to convert jsonld dataset quads into
 * the project-canonical `QuadInterface` representation.
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

export interface DatasetTerm {
  'termType': string;
  'value': string;
}

export interface DatasetLiteralTerm extends DatasetTerm {
  'datatype'?: DatasetTerm;
  'language'?: string;
}

export interface JsonLdDatasetQuad {
  'graph': DatasetTerm;
  'object': DatasetLiteralTerm;
  'predicate': DatasetTerm;
  'subject': DatasetTerm;
}
