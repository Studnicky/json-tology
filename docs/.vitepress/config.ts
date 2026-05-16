import { defineConfig } from 'vitepress';
import { jtBrandPlugin } from './plugins/jt-brand.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8')) as { version: string };
const __here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__here, '../..');
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
//   6. Migration guides live in their own section at the very bottom — they
//      are read once per version bump and assume familiarity with the rest.
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
      { link: '/registry/register', text: 'register / registry access' },
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
      { link: '/comparisons', text: 'Library comparisons' },
      { link: '/benchmarks', text: 'Benchmarks' },
      { link: '/references', text: 'External references' }
    ]
  },
  {
    text: 'Migration',
    items: [
      { link: '/migration-0.4.0', text: 'Migration to 0.4.0' },
      { link: '/migration-0.4.3', text: 'Migration to 0.4.3' },
      { link: '/migration-0.6.0', text: 'Migration to 0.6.0' }
    ]
  }
];

// ── Site identity — single source of truth for SEO, OG, JSON-LD ─────────
const SITE_TITLE = 'json-tology';
const SITE_TAGLINE = 'TypeScript types, validation, and OWL ontology from one JSON Schema';
const SITE_DESCRIPTION = 'One source of truth for TypeScript types, runtime validation, coercion, and OWL ontology output. Author in JSON Schema; share with any backend; reason over the graph.';
const SITE_DESCRIPTION_SHORT = 'One source of truth for TypeScript types, runtime validation, coercion, and OWL ontology output. Reason over the graph.';
const SITE_URL = 'https://studnicky.github.io/json-tology/';
const SITE_BASE = '/json-tology/';
const SITE_OG_IMAGE = `${SITE_URL}og-image.png`;
const SITE_THEME_COLOR = '#08717A';
const SITE_KEYWORDS = 'json-schema, typescript, validation, type-inference, ontology, owl, shacl, rdf, jsonld, semantic-web, graph, runtime-validation, coercion, ajv-alternative, zod-alternative, valibot-alternative, typebox-alternative';
const SITE_AUTHOR_NAME = 'Andrew Studnicky';
const SITE_AUTHOR_URL = 'https://github.com/Studnicky';
const SITE_REPO = 'https://github.com/Studnicky/json-tology';

export default defineConfig({
  vite: {
    define: {
      __JT_VERSION__: JSON.stringify(pkg.version)
    },
    resolve: {
      alias: {
        // The browser bench scenarios import json-tology directly so the page
        // measures whatever HEAD is, not whatever happens to be on esm.sh.
        'json-tology': resolve(REPO_ROOT, 'src/index.ts')
      }
    }
  },
  base: SITE_BASE,
  cleanUrls: true,
  description: SITE_DESCRIPTION,
  lang: 'en-US',
  lastUpdated: true,
  markdown: { config: (md) => { md.use(jtBrandPlugin); } },
  sitemap: { hostname: SITE_URL },
  title: SITE_TITLE,
  titleTemplate: `:title | ${SITE_TITLE}`,
  head: [
    // ── Favicon stack — every common form pointing at the same icon
    ['link', { rel: 'icon', type: 'image/svg+xml', href: `${SITE_BASE}nodes/jst-node.svg` }],
    ['link', { rel: 'icon', type: 'image/x-icon', href: `${SITE_BASE}favicon.ico` }],
    ['link', { rel: 'icon', type: 'image/png', sizes: '32x32', href: `${SITE_BASE}jst-node-512.png` }],
    ['link', { rel: 'icon', type: 'image/png', sizes: '192x192', href: `${SITE_BASE}jst-node-512.png` }],
    ['link', { rel: 'shortcut icon', href: `${SITE_BASE}favicon.ico` }],
    ['link', { rel: 'apple-touch-icon', sizes: '180x180', href: `${SITE_BASE}apple-touch-icon.png` }],
    ['link', { rel: 'mask-icon', href: `${SITE_BASE}nodes/jst-node.svg`, color: SITE_THEME_COLOR }],
    ['meta', { name: 'theme-color', content: SITE_THEME_COLOR }],
    ['meta', { name: 'color-scheme', content: 'dark light' }],
    ['meta', { name: 'msapplication-TileColor', content: SITE_THEME_COLOR }],
    ['meta', { name: 'msapplication-TileImage', content: `${SITE_BASE}jst-node-512.png` }],
    ['meta', { name: 'application-name', content: SITE_TITLE }],
    ['meta', { name: 'apple-mobile-web-app-title', content: SITE_TITLE }],
    ['meta', { name: 'apple-mobile-web-app-capable', content: 'yes' }],
    ['meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' }],

    // ── SEO basics
    ['meta', { name: 'description', content: SITE_DESCRIPTION }],
    ['meta', { name: 'keywords', content: SITE_KEYWORDS }],
    ['meta', { name: 'author', content: SITE_AUTHOR_NAME }],
    ['meta', { name: 'robots', content: 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1' }],
    ['meta', { name: 'googlebot', content: 'index, follow' }],
    ['meta', { name: 'generator', content: 'VitePress' }],
    ['link', { rel: 'sitemap', type: 'application/xml', href: `${SITE_BASE}sitemap.xml` }],

    // ── Open Graph (FB, Slack, Discord, LinkedIn). Per-page overrides in transformPageData.
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: SITE_TITLE }],
    ['meta', { property: 'og:title', content: `${SITE_TITLE} — ${SITE_TAGLINE}` }],
    ['meta', { property: 'og:description', content: SITE_DESCRIPTION }],
    ['meta', { property: 'og:url', content: SITE_URL }],
    ['meta', { property: 'og:image', content: SITE_OG_IMAGE }],
    ['meta', { property: 'og:image:secure_url', content: SITE_OG_IMAGE }],
    ['meta', { property: 'og:image:type', content: 'image/png' }],
    ['meta', { property: 'og:image:width', content: '1200' }],
    ['meta', { property: 'og:image:height', content: '630' }],
    ['meta', { property: 'og:image:alt', content: `${SITE_TITLE} — ${SITE_TAGLINE}` }],
    ['meta', { property: 'og:locale', content: 'en_US' }],

    // ── Twitter Card. Per-page overrides in transformPageData.
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:title', content: `${SITE_TITLE} — ${SITE_TAGLINE}` }],
    ['meta', { name: 'twitter:description', content: SITE_DESCRIPTION_SHORT }],
    ['meta', { name: 'twitter:image', content: SITE_OG_IMAGE }],
    ['meta', { name: 'twitter:image:alt', content: `${SITE_TITLE} — ${SITE_TAGLINE}` }],

    // ── JSON-LD: SoftwareSourceCode for code-discovery results
    ['script', { type: 'application/ld+json' }, JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'SoftwareSourceCode',
      'name': SITE_TITLE,
      'description': SITE_DESCRIPTION,
      'url': SITE_URL,
      'codeRepository': SITE_REPO,
      'programmingLanguage': 'TypeScript',
      'runtimePlatform': 'Node.js >=24',
      'license': 'https://opensource.org/licenses/MIT',
      'image': SITE_OG_IMAGE,
      'author': {
        '@type': 'Person',
        'name': SITE_AUTHOR_NAME,
        'url': SITE_AUTHOR_URL
      },
      'keywords': SITE_KEYWORDS
    })],

    // ── JSON-LD: WebSite for site-card results
    ['script', { type: 'application/ld+json' }, JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      'name': SITE_TITLE,
      'url': SITE_URL,
      'description': SITE_DESCRIPTION,
      'inLanguage': 'en-US'
    })]
  ],
  /**
   * Per-page metadata. Emits page-specific og:url / og:title / og:description /
   * twitter:title / twitter:description / canonical so social unfurls and SEO
   * results surface the page's own title and URL rather than the site-level
   * default. Without this, every Discord paste of any page would show the
   * homepage card.
   */
  transformPageData(pageData): void {
    const relPath = pageData.relativePath
      .replace(/\.md$/, '')
      .replace(/(^|\/)index$/, '');
    const pageUrl = relPath === '' ? SITE_URL : `${SITE_URL}${relPath}`;
    const title = (pageData.frontmatter['title'] as string | undefined)
      ?? pageData.title
      ?? SITE_TITLE;
    const description = (pageData.frontmatter['description'] as string | undefined)
      ?? pageData.description
      ?? SITE_DESCRIPTION;
    const displayTitle = title === SITE_TITLE ? SITE_TITLE : `${title} | ${SITE_TITLE}`;

    pageData.frontmatter['head'] = [
      ...(pageData.frontmatter['head'] as ReadonlyArray<readonly [string, Record<string, string>]> ?? []),
      ['link', { rel: 'canonical', href: pageUrl }],
      ['meta', { property: 'og:url', content: pageUrl }],
      ['meta', { property: 'og:title', content: displayTitle }],
      ['meta', { property: 'og:description', content: description }],
      ['meta', { name: 'twitter:title', content: displayTitle }],
      ['meta', { name: 'twitter:description', content: description }],
      ['meta', { name: 'description', content: description }]
    ];
  },
  appearance: themeConfig.appearance,
  srcDir: '.',
  themeConfig: {
    ...themeConfig,
    nav: [
      { link: '/getting-started', text: 'Docs' },
      { link: SITE_REPO, text: 'GitHub' }
    ],
    sidebar,
    socialLinks: [{ icon: 'github', link: SITE_REPO }]
  }
});
