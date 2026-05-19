/**
 * Characteristics dispatcher — OWL 2 §9.2.1–9.2.8 Object Property Characteristics
 *
 * Responsible for:
 *   owl:FunctionalProperty         — at most one value per subject
 *   owl:InverseFunctionalProperty  — at most one subject per value
 *   owl:TransitiveProperty         — transitivity assertion
 *   owl:SymmetricProperty          — symmetry assertion
 *   owl:AsymmetricProperty         — asymmetry assertion
 *   owl:ReflexiveProperty          — reflexivity assertion
 *   owl:IrreflexiveProperty        — irreflexivity assertion
 *
 * Bucket strategy: registry-level (characteristics are recorded in the
 * `characteristics` array of the fragment; OwlImporter registers them
 * on the target property schema via the registry after merging).
 *
 * Detection pattern: quads of the form
 *   <propertyIri> rdf:type owl:FunctionalProperty
 * where the predicate is the full rdf:type IRI or the curie form, and the
 * object is one of the seven OWL 2 characteristic class IRIs in full or curie form.
 * The subject is always the property IRI.
 */

import type { QuadInterface } from '../../../interfaces/Quad.js';
import type {
  OwlImportContext, OwlImportFragment
} from '../../../interfaces/OwlImport.js';

// ---------------------------------------------------------------------------
// RDF type predicate — both full IRI and curie forms
// ---------------------------------------------------------------------------

const TYPE_PREDICATES = new Set<string>([
  'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
  'rdf:type'
]);

// ---------------------------------------------------------------------------
// Characteristic IRI → characteristic name mapping
// Both full-IRI and curie forms must be matched because QuadFactory expands
// curies when a Curie handler is provided, but the synchronous JSON-LD walker
// may produce either form depending on the input document's @context.
// Keys are sorted lexicographically: full IRIs (http://…) before curie forms.
// ---------------------------------------------------------------------------

const CHARACTERISTIC_IRI_MAP: ReadonlyMap<string, string> = new Map([
  [
    'http://www.w3.org/2002/07/owl#AsymmetricProperty',
    'Asymmetric'
  ],
  [
    'http://www.w3.org/2002/07/owl#FunctionalProperty',
    'Functional'
  ],
  [
    'http://www.w3.org/2002/07/owl#InverseFunctionalProperty',
    'InverseFunctional'
  ],
  [
    'http://www.w3.org/2002/07/owl#IrreflexiveProperty',
    'Irreflexive'
  ],
  [
    'http://www.w3.org/2002/07/owl#ReflexiveProperty',
    'Reflexive'
  ],
  [
    'http://www.w3.org/2002/07/owl#SymmetricProperty',
    'Symmetric'
  ],
  [
    'http://www.w3.org/2002/07/owl#TransitiveProperty',
    'Transitive'
  ],
  [
    'owl:AsymmetricProperty',
    'Asymmetric'
  ],
  [
    'owl:FunctionalProperty',
    'Functional'
  ],
  [
    'owl:InverseFunctionalProperty',
    'InverseFunctional'
  ],
  [
    'owl:IrreflexiveProperty',
    'Irreflexive'
  ],
  [
    'owl:ReflexiveProperty',
    'Reflexive'
  ],
  [
    'owl:SymmetricProperty',
    'Symmetric'
  ],
  [
    'owl:TransitiveProperty',
    'Transitive'
  ]
]);

// ---------------------------------------------------------------------------
// Empty fragment factory
// ---------------------------------------------------------------------------

function emptyFragment(): OwlImportFragment {
  return {
    'characteristics': [],
    'individuals': [],
    'invariants': [],
    'sameAs': [],
    'schemaDeltas': new Map()
  };
}

/**
 * Process OWL 2 property characteristic axioms (functional, transitive, symmetric,
 * etc.) and return a partial import fragment.
 *
 * Scans all quads for `<propertyIri> rdf:type owl:<CharacteristicProperty>` patterns.
 * For each match where the subject is a known property IRI, emits a
 * `{ propertyIri, characteristic }` tuple into `fragment.characteristics`.
 *
 * Structural impact for FunctionalProperty (maxItems: 1 on array-typed
 * properties) is handled by the Properties dispatcher which owns schemaDeltas.
 * All seven characteristics are purely registry-level from this dispatcher's
 * perspective: no schemaDeltas are emitted here.
 *
 * @param quads - All quads from the input graph.
 * @param ctx   - Shared import context (graph, curie, IRI sets, reporting helpers).
 * @returns OwlImportFragment with characteristics populated.
 */
export function importCharacteristics(quads: QuadInterface[], ctx: OwlImportContext): OwlImportFragment {
  const fragment = emptyFragment();

  // Deduplicate: a single property may appear in multiple quads with the same
  // characteristic (e.g., from different serialisation passes). Use a Set to
  // track already-emitted (propertyIri, characteristic) pairs.
  const seen = new Set<string>();

  for (const quad of quads) {
    // Only process rdf:type quads
    if (!TYPE_PREDICATES.has(quad.predicate.value)) {
      continue;
    }

    // Object must be a NamedNode (IRI), not a literal or blank node
    if (quad.object.termType !== 'NamedNode') {
      continue;
    }

    const characteristicName = CHARACTERISTIC_IRI_MAP.get(quad.object.value);

    if (characteristicName === undefined) {
      // Not a characteristic type quad — leave it for other dispatchers
      continue;
    }

    const propertyIri = quad.subject.value;

    // Only record characteristics for IRIs that are known property subjects.
    // Try curie compaction as a fallback when the IRI is in full form but
    // allPropertyIris was populated with curie strings.
    if (!ctx.allPropertyIris.has(propertyIri)) {
      const compacted = ctx.curie.compact(propertyIri);

      if (!ctx.allPropertyIris.has(compacted)) {
        ctx.reportUnsupported(quad.object.value, propertyIri);
        continue;
      }
    }

    const key = `${propertyIri}::${characteristicName}`;

    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    const mutableCharacteristics = fragment.characteristics as Array<{
      'characteristic': string;
      'propertyIri': string;
    }>;

    mutableCharacteristics.push({
      'characteristic': characteristicName,
      'propertyIri': propertyIri
    });
  }

  return fragment;
}
