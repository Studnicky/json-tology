/**
 * Unit tests for importPropertyRestrictions — OWL 2 §8.2
 *
 * One assertion per restriction kind:
 *   - owl:allValuesFrom    → items: { $ref: C }
 *   - owl:someValuesFrom   → invariant (runtime fn) emitted, no structural patch
 *   - owl:hasValue         → const: v
 *   - owl:cardinality N    → minItems: N, maxItems: N
 *   - owl:minCardinality N → minItems: N
 *   - owl:maxCardinality N → maxItems: N
 *   - owl:minQualifiedCardinality N → minItems: N
 *   - owl:maxQualifiedCardinality N → maxItems: N
 *
 * Bookstore round-trip: RareBook (maxCardinality + someValuesFrom on authors)
 *   and InPrintBook (hasValue on printStatus) round-trip via OwlImporter.
 */

import assert from 'node:assert/strict';
import {
  describe,
  it
} from 'node:test';
import { PropertyRestrictions } from '../../src/modules/ontology/importDispatch/PropertyRestrictions.js';
import { OwlImporter } from '../../src/modules/ontology/OwlImporter.js';
import type { OwlImportContextInterface } from '../../src/interfaces/OwlImportContextInterface.js';
import type { OwlImportFragmentInterface } from '../../src/interfaces/OwlImportFragmentInterface.js';
import type { QuadInterface } from '../../src/interfaces/QuadInterface.js';
import { SchemaGraph } from '../../src/modules/graph/SchemaGraph.js';
import { Curie } from '../../src/modules/quads/Curie.js';
import { STANDARD_PREFIXES } from '../../src/constants/STANDARD_PREFIXES.js';
import { Compose } from '../../src/index.js';
import { OwlProjection } from '../../src/modules/rdf/OwlProjection.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CLASS_IRI = 'urn:example:Widget';
const PROP_IRI = `${CLASS_IRI}#items`;
const RANGE_IRI = 'urn:example:Item';

/**
 * Build a minimal OwlImportContextInterface from a SchemaGraph backed by the given quads.
 */
function makeCtx(quads: QuadInterface[]): OwlImportContextInterface {
  const graph = SchemaGraph.fromQuads(quads, { 'baseIri': 'urn:example' });
  const curie = new Curie(STANDARD_PREFIXES);
  const unsupported: Array<{
    'axiomIri': string;
    'subjectIri': null | string;
  }> = [];
  const rdfTypeIri = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
  const owlClassIri = 'http://www.w3.org/2002/07/owl#Class';
  const allClassIris = new Set<string>();
  const allPropertyIris = new Set<string>();

  for (const quad of quads) {
    if (quad.predicate.value === rdfTypeIri
      && quad.object.termType === 'NamedNode'
      && (quad.object.value === owlClassIri || quad.object.value === 'owl:Class')) {
      allClassIris.add(quad.subject.value);
    }
  }

  return {
    allClassIris,
    allPropertyIris,
    'baseIri': 'urn:example',
    curie,
    graph,
    'isDatatype': () => {
      return false;
    },
    'prefixes': STANDARD_PREFIXES,
    'reportUnsupported': (axiomIri, subjectIri) => {
      unsupported.push({
        axiomIri,
        subjectIri
      });
    }
  };
}

/**
 * Build quads + context for a schema that carries jt:restrictions via Compose.
 */
function quadsForSchema(schema: Record<string, unknown>): {
  'ctx': OwlImportContextInterface;
  'quads': QuadInterface[];
} {
  const graph = new SchemaGraph(schema);
  const quads = OwlProjection.graph(graph);

  return {
    'ctx': makeCtx(quads),
    quads
  };
}

/**
 * Run importPropertyRestrictions against a schema and return the fragment.
 */
function importFromSchema(schema: Record<string, unknown>): OwlImportFragmentInterface {
  const {
    ctx,
    quads
  } = quadsForSchema(schema);

  return PropertyRestrictions.dispatch(quads, ctx);
}

/**
 * Get the properties delta for a class IRI from the fragment.
 */
function getProps(
  fragment: OwlImportFragmentInterface,
  classIri: string
): Record<string, unknown> {
  const delta = fragment.schemaDeltas.get(classIri);

  return delta?.properties ?? {};
}

// ---------------------------------------------------------------------------
// Per-restriction-kind tests
// ---------------------------------------------------------------------------

void describe('importPropertyRestrictions', () => {
  void describe('owl:allValuesFrom', () => {
    void it('adds items.$ref to the property schema delta', () => {
      const schema = Compose.subClassOf(
        Compose.allValuesFrom(PROP_IRI, RANGE_IRI),
        {
          '$id': CLASS_IRI,
          'type': 'object'
        } as const
      );

      const fragment = importFromSchema(schema);
      const props = getProps(fragment, CLASS_IRI);

      // PROP_IRI = CLASS_IRI + '#items', so the property key is 'items'
      const propDelta = props.items as Record<string, unknown> | undefined;

      assert.ok(propDelta !== undefined, 'property "items" should be in delta');
      // allValuesFrom maps to items: { $ref: RANGE_IRI }
      const nestedItems = propDelta.items as Record<string, unknown> | undefined;

      assert.ok(nestedItems !== undefined, 'items.$ref sub-key should be present');
      assert.equal(nestedItems.$ref, RANGE_IRI, 'items.$ref must equal the range class IRI');
    });
  });

  void describe('owl:someValuesFrom', () => {
    void it('emits a runtime invariant and no structural schema patch', () => {
      const schema = Compose.subClassOf(
        Compose.someValuesFrom(PROP_IRI, RANGE_IRI),
        {
          '$id': CLASS_IRI,
          'type': 'object'
        } as const
      );

      const fragment = importFromSchema(schema);

      // No structural delta for the class
      assert.equal(fragment.schemaDeltas.has(CLASS_IRI), false, 'no structural delta for someValuesFrom');

      // One invariant attached to the class IRI
      const inv = fragment.invariants.filter((entry) => {
        return entry.schemaId === CLASS_IRI;
      });

      assert.equal(inv.length, 1, 'one invariant emitted');
      const inv0 = inv.at(0);

      if (inv0 === undefined) {
        throw new Error('expected invariant at index 0');
      }
      assert.ok(inv0.invariant.name.includes('someValuesFrom'), 'invariant name contains someValuesFrom');

      // The invariant fn returns null for a non-empty array
      const result = inv0.invariant.fn({ 'items': ['x'] });

      assert.equal(result, null, 'non-empty array satisfies someValuesFrom');

      // Empty array → error message
      const fail = inv0.invariant.fn({ 'items': [] });

      assert.ok(typeof fail === 'string', 'empty array fails someValuesFrom');
    });
  });

  void describe('owl:hasValue', () => {
    void it('adds const to the property schema delta', () => {
      const PRINT_STATUS = `${CLASS_IRI}#status`;

      const schema = Compose.subClassOf(
        Compose.hasValue(PRINT_STATUS, 'active'),
        {
          '$id': CLASS_IRI,
          'type': 'object'
        } as const
      );

      const fragment = importFromSchema(schema);
      const props = getProps(fragment, CLASS_IRI);
      const statusProp = props.status as Record<string, unknown> | undefined;

      assert.ok(statusProp !== undefined, 'property "status" should be in delta');
      assert.equal(statusProp.const, 'active', 'const value matches');
    });

    void it('handles numeric hasValue', () => {
      const RANK_PROP = `${CLASS_IRI}#rank`;

      const schema = Compose.subClassOf(
        Compose.hasValue(RANK_PROP, 42),
        {
          '$id': CLASS_IRI,
          'type': 'object'
        } as const
      );

      const fragment = importFromSchema(schema);
      const props = getProps(fragment, CLASS_IRI);
      const rankProp = props.rank as Record<string, unknown> | undefined;

      assert.ok(rankProp !== undefined, 'property "rank" should be in delta');
      assert.equal(rankProp.const, 42);
    });
  });

  void describe('owl:cardinality', () => {
    void it('sets minItems and maxItems to N', () => {
      const schema = Compose.subClassOf(
        Compose.cardinality(PROP_IRI, 3),
        {
          '$id': CLASS_IRI,
          'type': 'object'
        } as const
      );

      const fragment = importFromSchema(schema);
      const props = getProps(fragment, CLASS_IRI);
      const itemsProp = props.items as Record<string, unknown> | undefined;

      assert.ok(itemsProp !== undefined);
      assert.equal(itemsProp.minItems, 3);
      assert.equal(itemsProp.maxItems, 3);
    });
  });

  void describe('owl:minCardinality', () => {
    void it('sets minItems', () => {
      const schema = Compose.subClassOf(
        Compose.minimumCardinality(PROP_IRI, 2),
        {
          '$id': CLASS_IRI,
          'type': 'object'
        } as const
      );

      const fragment = importFromSchema(schema);
      const props = getProps(fragment, CLASS_IRI);
      const itemsProp = props.items as Record<string, unknown> | undefined;

      assert.ok(itemsProp !== undefined);
      assert.equal(itemsProp.minItems, 2);
      assert.equal(itemsProp.maxItems, undefined, 'no maxItems for minCardinality');
    });
  });

  void describe('owl:maxCardinality', () => {
    void it('sets maxItems', () => {
      const schema = Compose.subClassOf(
        Compose.maximumCardinality(PROP_IRI, 5),
        {
          '$id': CLASS_IRI,
          'type': 'object'
        } as const
      );

      const fragment = importFromSchema(schema);
      const props = getProps(fragment, CLASS_IRI);
      const itemsProp = props.items as Record<string, unknown> | undefined;

      assert.ok(itemsProp !== undefined);
      assert.equal(itemsProp.maxItems, 5);
      assert.equal(itemsProp.minItems, undefined, 'no minItems for maxCardinality');
    });
  });

  void describe('multiple restrictions on the same property', () => {
    void it('merges minCardinality + maxCardinality into a single property delta', () => {
      const schema = Compose.subClassOf(
        Compose.minimumCardinality(PROP_IRI, 1),
        Compose.subClassOf(
          Compose.maximumCardinality(PROP_IRI, 5),
          {
            '$id': CLASS_IRI,
            'type': 'object'
          } as const
        )
      );

      const fragment = importFromSchema(schema);
      const props = getProps(fragment, CLASS_IRI);
      const itemsProp = props.items as Record<string, unknown> | undefined;

      assert.ok(itemsProp !== undefined);
      assert.equal(itemsProp.minItems, 1);
      assert.equal(itemsProp.maxItems, 5);
    });
  });

  // -------------------------------------------------------------------------
  // Bookstore round-trip: RareBook
  // -------------------------------------------------------------------------

  void describe('bookstore round-trip — RareBook', () => {
    void it('maxCardinality(authors, 1) produces maxItems: 1 in import delta', async () => {
      const { RareBookSchema } = await import('../../examples/docs/bookstore/entities/RareBook.js');
      const fragment = importFromSchema(RareBookSchema);
      const RARE_BOOK_IRI = 'urn:bookstore:RareBook';
      const props = getProps(fragment, RARE_BOOK_IRI);
      const authorsProp = props.authors as Record<string, unknown> | undefined;

      assert.ok(authorsProp !== undefined, 'authors property delta must exist');
      assert.equal(authorsProp.maxItems, 1, 'maxCardinality(authors, 1) → maxItems: 1');
    });

    void it('someValuesFrom(authors, AuthorName) emits an invariant for RareBook', async () => {
      const { RareBookSchema } = await import('../../examples/docs/bookstore/entities/RareBook.js');
      const fragment = importFromSchema(RareBookSchema);
      const RARE_BOOK_IRI = 'urn:bookstore:RareBook';
      const invEntries = fragment.invariants.filter((entry) => {
        return entry.schemaId === RARE_BOOK_IRI;
      });

      assert.ok(invEntries.length > 0, 'at least one invariant for RareBook (someValuesFrom)');
      assert.ok(
        invEntries.some((entry) => {
          return entry.invariant.name.includes('someValuesFrom');
        }),
        'someValuesFrom invariant present'
      );
    });
  });

  // -------------------------------------------------------------------------
  // Bookstore round-trip: InPrintBook
  // -------------------------------------------------------------------------

  void describe('bookstore round-trip — InPrintBook', () => {
    void it('hasValue(printStatus, "inPrint") produces const: "inPrint" in import delta', async () => {
      const { InPrintBookSchema } = await import('../../examples/docs/bookstore/entities/InPrintBook.js');
      const fragment = importFromSchema(InPrintBookSchema);
      const IN_PRINT_IRI = 'urn:bookstore:InPrintBook';
      const props = getProps(fragment, IN_PRINT_IRI);
      const statusProp = props.printStatus as Record<string, unknown> | undefined;

      assert.ok(statusProp !== undefined, 'printStatus property delta must exist');
      assert.equal(statusProp.const, 'inPrint', 'hasValue → const: "inPrint"');
    });
  });

  // -------------------------------------------------------------------------
  // OwlImporter integration: restrictions surface in result
  // -------------------------------------------------------------------------

  void describe('OwlImporter integration', () => {
    void it('PropertyRestrictions projects owl:maxCardinality without marking it unsupported', () => {
      const schema = Compose.subClassOf(
        Compose.maximumCardinality(PROP_IRI, 3),
        {
          '$id': CLASS_IRI,
          'type': 'object'
        } as const
      );

      const graph = new SchemaGraph(schema);
      const quads = OwlProjection.graph(graph);

      // Pass QuadInterface[] directly — OwlImporter.import() accepts this form.
      const importer = new OwlImporter({ 'baseIri': 'urn:example' });
      const result = importer.import(quads);

      // PropertyRestrictions fully projects owl:maxCardinality; it must not
      // appear in result.unsupported.
      const prUnsupported = result.unsupported.filter((unsup) => {
        return unsup.axiomIri === 'owl:maxCardinality';
      });

      assert.equal(prUnsupported.length, 0, 'owl:maxCardinality must not appear in unsupported');
    });
  });
});
