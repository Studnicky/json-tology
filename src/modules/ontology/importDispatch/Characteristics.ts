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
 * Detection pattern: walks `ctx.graph.allRelations()` and matches `rdf:type`
 * relations whose target is one of the seven OWL 2 characteristic class IRIs
 * (full or compact form). The relation source is the property IRI.
 */

import type { QuadInterface } from '../../../interfaces/Quad.js';
import type {
  OwlImportContext, OwlImportFragment
} from '../../../interfaces/OwlImport.js';
import { RDF } from '../../../constants/IRI.js';

// ---------------------------------------------------------------------------
// Characteristic IRI → characteristic name mapping
// Both full-IRI and curie forms must be matched: QuadBackedSchemaGraph
// compacts named-node targets via the active prefix map, but raw inputs
// may still carry the full IRI form when no matching prefix exists.
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
 * Walks `ctx.graph.allRelations()` and emits a
 * `{ propertyIri, characteristic }` tuple for each `rdf:type` relation whose
 * target is a recognised OWL 2 property characteristic IRI.
 *
 * Structural impact for FunctionalProperty (maxItems: 1 on array-typed
 * properties) is handled by the Properties dispatcher which owns schemaDeltas.
 * All seven characteristics are purely registry-level from this dispatcher's
 * perspective: no schemaDeltas are emitted here.
 *
 * @param _quads - All quads from the input graph (unused; graph is traversed via ctx).
 * @param ctx    - Shared import context (graph, curie, IRI sets, reporting helpers).
 * @returns OwlImportFragment with characteristics populated.
 */
export function importCharacteristics(_quads: QuadInterface[], ctx: OwlImportContext): OwlImportFragment {
  const fragment = emptyFragment();

  // Deduplicate: a single property may appear in multiple relations with the
  // same characteristic. Use a Set to track already-emitted
  // (propertyIri, characteristic) pairs.
  const seen = new Set<string>();

  for (const relation of ctx.graph.allRelations()) {
    // Only process rdf:type relations.
    if (relation.predicate !== RDF.type) {
      continue;
    }

    // Target must be a NamedNode IRI string (QuadBackedSchemaGraph encodes
    // rdf:type targets as IRI strings rather than node objects).
    if (typeof relation.target !== 'string') {
      continue;
    }

    const characteristicName = CHARACTERISTIC_IRI_MAP.get(relation.target);

    if (characteristicName === undefined) {
      // Not a characteristic type relation — leave it for other dispatchers.
      continue;
    }

    const propertyIri = relation.source.id;

    // Only record characteristics for IRIs that are known property subjects.
    // Try curie compaction as a fallback when the IRI is in full form but
    // allPropertyIris was populated with curie strings.
    if (!ctx.allPropertyIris.has(propertyIri)) {
      const compacted = ctx.curie.compact(propertyIri);

      if (!ctx.allPropertyIris.has(compacted)) {
        ctx.reportUnsupported(relation.target, propertyIri);
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
