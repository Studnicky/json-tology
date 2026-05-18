import type {
  BnodeTermType, DefaultGraphTermType, IriTermType, QuadObjectType
} from '../types/Quad.js';

/**
 * RDF quad interface — compliant with the rdf/js DataModel spec
 * (https://rdf.js.org/data-model-spec/).
 *
 * - subject   IriTermType | BnodeTermType   (NamedNode | BlankNode)
 * - predicate IriTermType                   (NamedNode)
 * - object    QuadObjectType                (NamedNode | BlankNode | Literal | List†)
 * - graph     IriTermType | BnodeTermType | DefaultGraphTermType (always present)
 *
 * † ListTermType is a project extension; not part of the rdf/js spec.
 */
export interface QuadInterface {
  'graph': BnodeTermType | DefaultGraphTermType | IriTermType;
  'object': QuadObjectType;
  'predicate': IriTermType;
  'subject': BnodeTermType | IriTermType;
}
