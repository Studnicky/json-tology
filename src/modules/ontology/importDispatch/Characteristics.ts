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

import type { QuadInterface } from '../../../interfaces/QuadInterface.js';
import type { OwlImportContextInterface } from '../../../interfaces/OwlImportContextInterface.js';
import type { OwlImportFragmentInterface } from '../../../interfaces/OwlImportFragmentInterface.js';
import type { RecordCharacteristicOptionsInterface } from '../../../interfaces/RecordCharacteristicOptionsInterface.js';
import {
  OWL, RDF
} from '../../../constants/IRI.js';
import { ImportRelation } from './ImportRelation.js';

// ---------------------------------------------------------------------------
// OWL 2 IRI prefix for characteristic class URIs.
// Both full-IRI and curie forms must be matched: QuadBackedSchemaGraph
// compacts named-node targets via the active prefix map, but raw inputs
// may still carry the full IRI form when no matching prefix exists.
// ---------------------------------------------------------------------------

const CHARACTERISTIC_IRI_MAP: ReadonlyMap<string, string> = new Map([
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
  ],
  [
    OWL.AsymmetricProperty,
    'Asymmetric'
  ],
  [
    OWL.FunctionalProperty,
    'Functional'
  ],
  [
    OWL.InverseFunctionalProperty,
    'InverseFunctional'
  ],
  [
    OWL.IrreflexiveProperty,
    'Irreflexive'
  ],
  [
    OWL.ReflexiveProperty,
    'Reflexive'
  ],
  [
    OWL.SymmetricProperty,
    'Symmetric'
  ],
  [
    OWL.TransitiveProperty,
    'Transitive'
  ]
]);

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
 * @returns OwlImportFragmentInterface with characteristics populated.
 *
 * @remarks
 * Implements OWL 2 §9.2.1–9.2.8. The seven characteristic class IRIs are
 * matched in both full-IRI and curie forms. Duplicate (propertyIri,
 * characteristic) pairs are deduplicated via a local Set. Unsupported property
 * IRIs (not found in `ctx.allPropertyIris` even after compaction) are reported
 * via `ctx.reportUnsupported` and skipped.
 *
 * @example
 * ```ts
 * const fragment = Characteristics.dispatch(quads, ctx);
 * // fragment.characteristics contains { propertyIri, characteristic } entries
 * ```
 *
 * @category OWL Import
 * @since 0.1.0
 * @see OwlImportContextInterface
 * @group importDispatch
 */
export class Characteristics {
  public static dispatch(_quads: QuadInterface[], context: OwlImportContextInterface): OwlImportFragmentInterface {
    const fragment = ImportRelation.emptyFragment();
    const seen = new Set<string>();

    for (const relation of context.graph.allRelations()) {
      if (relation.predicate !== RDF.type) {
        continue;
      }

      if (typeof relation.target !== 'string') {
        continue;
      }

      const characteristicName = CHARACTERISTIC_IRI_MAP.get(relation.target);

      if (characteristicName === undefined) {
        continue;
      }

      Characteristics.recordCharacteristic({
        characteristicName,
        'characteristicTarget': relation.target,
        'ctx': context,
        fragment,
        'propertyIri': relation.source.id,
        seen
      });
    }

    return fragment;
  }

  /**
   * Attempt to record a characteristic for the relation's source property.
   * Skips when the source IRI is not a known property subject (even after
   * curie compaction), reporting it as unsupported.
   */
  private static recordCharacteristic(options: RecordCharacteristicOptionsInterface): void {
    const {
      characteristicName,
      characteristicTarget,
      'ctx': context,
      fragment,
      propertyIri,
      seen
    } = options;

    if (!context.allPropertyIris.has(propertyIri)) {
      const compacted = context.curie.compact(propertyIri);

      if (!context.allPropertyIris.has(compacted)) {
        context.reportUnsupported(characteristicTarget, propertyIri);

        return;
      }
    }

    const key = `${propertyIri}::${characteristicName}`;

    if (seen.has(key)) {
      return;
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
}
