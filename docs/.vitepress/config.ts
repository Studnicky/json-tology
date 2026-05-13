import { defineConfig } from 'vitepress';
import { jtBrandPlugin } from './plugins/jt-brand.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8')) as { version: string };
import { themeConfig } from './theme.config.js';

// Sidebar order:
//   1. Introduction — onboarding only (no migration guides)
//   2. Core concepts — graph mental model + method-selection guides,
//      placed after Introduction so readers encounter at least one page
//      before the concept pages ask them to compare methods.
//   3. Core authoring surface — schemas, validation, composition, transforms,
//      values, serialization, registry. This is the entire surface for users
//      who don't care about RDF / OWL / SPARQL.
//   4. OPT-IN graph / ontology surface, gated together so it can be skipped:
//      ontology concepts → OWL class axioms → ontology emission.
//   5. Usage examples → browser → data models → type inference → reference.
//      Migration guides live at the bottom of Reference (require familiarity).
//
// Everything from "Ontology concepts" downward is advanced material. A
// typical consumer can ignore it. Only authors who want OWL / SHACL / RDF
// round-trip / SPARQL access need to descend into it.
const sidebar = [
  {
    text: 'Introduction',
    items: [
      { link: '/getting-started', text: 'Getting Started' },
      { link: '/bookstore-domain', text: 'The Bookstore Domain' }
    ]
  },
  {
    text: 'Core concepts',
    items: [
      { link: '/your-types-are-a-graph', text: 'Your types are a graph' },
      { link: '/validation-modes', text: 'Validation modes' },
      { link: '/picking-a-method', text: 'Picking a method' },
      { link: '/argument-conventions', text: 'Argument conventions' }
    ]
  },
  {
    text: 'Schemas',
    items: [
      { link: '/schemas', text: 'Authoring schemas' },
      { link: '/schemas/jt-keywords', text: 'JT keywords' },
      { link: '/compile-time-schema-validation', text: 'Compile-time schema validation' }
    ]
  },
  {
    text: 'Validation',
    items: [
      { link: '/validation/instantiate', text: 'instantiate' },
      { link: '/validation/validate', text: 'validate' },
      { link: '/validation/is', text: 'is' },
      { link: '/validation/errors', text: 'errors' },
      { link: '/validation/subschemaAt', text: 'subschemaAt' }
    ]
  },
  {
    text: 'Composition',
    items: [
      { link: '/composition/extend', text: 'extend' },
      { link: '/composition/pick-omit', text: 'pick / omit' },
      { link: '/composition/partial-required', text: 'partial / required' },
      { link: '/composition/intersection', text: 'intersection' },
      { link: '/composition/discriminated-union', text: 'discriminatedUnion / narrow' },
      { link: '/composition/get-defaults', text: 'getDefaults' },
      { link: '/composition/equivalent', text: 'equivalent' }
    ]
  },
  {
    text: 'Transforms',
    items: [
      { link: '/transforms/decode-encode', text: 'Transform.create / encode' },
      { link: '/transforms/brand', text: 'brand' },
      { link: '/transforms/chain', text: 'chain' }
    ]
  },
  {
    text: 'Value Operations',
    items: [
      { link: '/value/clone-hash', text: 'clone / hash' },
      { link: '/value/diff', text: 'diff / applyOp' },
      { link: '/value/cast-clean-convert', text: 'cast / clean / convert' },
      { link: '/value/create', text: 'create' }
    ]
  },
  {
    text: 'Serialization',
    items: [
      { link: '/serialization/dump', text: 'dump / dumpJson' },
      { link: '/serialization/toSchema', text: 'toSchema' }
    ]
  },
  {
    text: 'Registry',
    items: [
      { link: '/registry/register', text: 'register / has / get / list' },
      { link: '/registry/materialize', text: 'materialize' },
      { link: '/registry/computed', text: 'addComputed / removeComputed' },
      { link: '/registry/invariants', text: 'addInvariant / removeInvariant' },
      { link: '/registry/find-duplicates', text: 'findDuplicates' }
    ]
  },
  // ──────────────────────────────────────────────────────────────────────
  // OPT-IN: graph / ontology surface. Everything below is for advanced
  // users who want OWL / SHACL / RDF round-trip / SPARQL access. A typical
  // Zod-style consumer can stop reading here.
  // ──────────────────────────────────────────────────────────────────────
  {
    text: 'Ontology concepts (opt-in)',
    items: [
      { link: '/advanced/graph-concepts', text: 'Graph concepts (TBox / ABox)' },
      { link: '/advanced/graph-internals', text: 'Graph internals' },
      { link: '/advanced/graph-native-authoring', text: 'Graph-native authoring' },
      { link: '/advanced/sub-schemas', text: 'Sub-schemas and $ref composition' },
      { link: '/advanced/schema-federation', text: 'Schema federation (prefetch + snapshot)' },
      { link: '/advanced/browser-usage', text: 'Browser usage' },
      { link: '/advanced/skolemization', text: 'Skolemization' },
      { link: '/advanced/owl-property-characteristics', text: 'OWL 2 property characteristics' }
    ]
  },
  {
    text: 'OWL class axioms (opt-in)',
    items: [
      { link: '/composition/sub-class-of', text: 'subClassOf / disjointWith / complementOf' },
      { link: '/composition/restrictions', text: 'OWL property restrictions' }
    ]
  },
  {
    text: 'Ontology emission (opt-in)',
    items: [
      { link: '/advanced/ontology#jt-totbox', text: 'toTbox' },
      { link: '/advanced/ontology#jt-toshacl', text: 'toShacl' },
      { link: '/advanced/ontology#jt-ontology', text: 'ontology' },
      { link: '/advanced/quads', text: 'RDF round-trip (toQuads / fromQuads)' },
      { link: '/advanced/sameas', text: 'sameAs (ABox identity)' },
      { link: '/advanced/strict-graph-mode', text: 'Strict graph mode' }
    ]
  },
  {
    text: 'Usage Examples',
    items: [
      { link: '/usage-examples/custom-formats', text: 'Custom format validators' },
      { link: '/usage-examples/transforms-recipes', text: 'Transform recipes' },
      { link: '/usage-examples/class-hydration', text: 'Class hydration' },
      { link: '/usage-examples/class-hydration-orm', text: 'Class hydration: ORM recipes' },
      { link: '/usage-examples/sub-schema-patterns', text: 'Sub-schema patterns' },
      { link: '/usage-examples/bookstore-owl-taxonomy', text: 'Bookstore OWL taxonomy' }
    ]
  },
  {
    text: 'Data models',
    items: [
      { link: '/errors', text: 'ValidationErrors (overview)' },
      { link: '/errors/views', text: 'ValidationErrors views (aggregate / report)' },
      { link: '/errors/classes', text: 'Error class hierarchy' },
      { link: '/value/diff#changeset', text: 'Changeset (Value.diff result)' },
      { link: '/advanced/quads#quad-shape', text: 'Quad / SubjectGroup' },
      { link: '/advanced/utilities', text: 'Curie / Path / Resolver / Hash / Lift' }
    ]
  },
  {
    text: 'Type inference',
    items: [
      { link: '/types/infer', text: 'InferType' },
      { link: '/types/utility', text: 'Utility types' },
      { link: '/types/ranges', text: 'Range types' }
    ]
  },
  {
    text: 'Reference',
    items: [
      { link: '/static-helpers', text: 'Static helpers' },
      { link: '/constraint-brands/keywords', text: 'Constraint brands (keywords)' },
      { link: '/constraint-brands/narrowing', text: 'Constraint brands (narrowing)' },
      { link: '/cli', text: 'CLI' },
      { link: '/references', text: 'External references' },
      { link: '/migration-0.4.0', text: 'Migration to 0.4.0' },
      { link: '/migration-0.4.3', text: 'Migration to 0.4.3' },
      { link: '/migration-0.6.0', text: 'Migration to 0.6.0' }
    ]
  }
];

export default defineConfig({
  vite: {
    define: {
      __JT_VERSION__: JSON.stringify(pkg.version)
    }
  },
  base: '/json-tology/',
  markdown: { config: (md) => { md.use(jtBrandPlugin); } },
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/json-tology/nodes/jst-node.svg' }],
    ['link', { rel: 'mask-icon', href: '/json-tology/nodes/jst-node.svg', color: '#08717A' }],
    ['meta', { name: 'theme-color', content: '#08717A' }]
  ],
  appearance: themeConfig.appearance,
  description: 'One source of truth for TypeScript types, runtime validation, coercion, and OWL ontology output. Author in JSON Schema; share with any backend; reason over the graph.',
  srcDir: '.',
  themeConfig: {
    ...themeConfig,
    nav: [
      { link: '/getting-started', text: 'Docs' },
      { link: 'https://github.com/Studnicky/json-tology', text: 'GitHub' }
    ],
    sidebar,
    socialLinks: [{ icon: 'github', link: 'https://github.com/Studnicky/json-tology' }]
  },
  title: 'json-tology'
});
