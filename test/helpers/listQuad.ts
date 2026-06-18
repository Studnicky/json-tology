/**
 * listQuad — test helper for emitting an RDF list as the object of a quad.
 *
 * The project's canonical quad type is `@rdfjs/types#Quad`; there is no
 * project-internal "list term". RDF lists are emitted as standard
 * rdf:first / rdf:rest / rdf:nil triple chains. This helper packages the
 * parent quad and the list triples into a single array test fixtures can
 * splat into a quad collection.
 *
 * Usage:
 *   const quads = [
 *     typeQuad(CLASS_A),
 *     ...listQuad(
 *       Terms.iri(CLASS_A),
 *       Terms.iri(OWL_DISJOINT_UNION_OF),
 *       [Terms.iri(CLASS_B), Terms.iri(CLASS_C)]
 *     )
 *   ];
 */

import type { QuadInterface } from '../../src/interfaces/QuadInterface.js';
import type {
  BnodeTermType, DefaultGraphTermType, IriTermType, QuadObjectType
} from '../../src/types/Quad.js';

import { Lists } from '../../src/modules/quads/Lists.js';
import { Terms } from '../../src/modules/quads/Terms.js';

export function listQuad(
  subject: BnodeTermType | IriTermType,
  predicate: IriTermType,
  items: readonly QuadObjectType[],
  graph: DefaultGraphTermType | IriTermType = Terms.defaultGraph()
): QuadInterface[] {
  const {
    head, triples
  } = Lists.build(items);
  const parent = Terms.quad(subject, predicate, head, graph);

  return [
    parent,
    ...triples
  ];
}
