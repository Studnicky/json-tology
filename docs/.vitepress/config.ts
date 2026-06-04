import { defineConfig, type HeadConfig } from 'vitepress';
import { jtBrandPlugin } from './plugins/jt-brand.mjs';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8')) as {
  version: string;
  'json-tology'?: { seo?: { googleSiteVerification?: string; bingSiteVerification?: string; twitterHandle?: string } };
};
const __here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__here, '../..');
import { themeConfig } from './theme.config.js';

/**
 * SEO tokens live in package.json under `json-tology.seo`. The two
 * verification tokens (Google + Bing) are property-ownership markers,
 * not credentials — anyone can read them. The Twitter handle is the
 * public-facing account.
 *
 * Empty string suppresses the corresponding head tag at build time —
 * we ship no orphaned meta tags pointing at unowned properties.
 */
const seo = pkg['json-tology']?.seo ?? {};
const VERIFY_GOOGLE = seo.googleSiteVerification ?? '';
const VERIFY_BING = seo.bingSiteVerification ?? '';
const SITE_TWITTER_HANDLE = seo.twitterHandle ?? '';

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
      { link: '/instantiate-vs-materialize', text: 'instantiate vs materialize' },
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
      { link: '/advanced/owl-property-characteristics', text: 'OWL 2 property characteristics' },
      { link: '/advanced/owl-import', text: 'OWL 2 TBox import (fromTbox)' }
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
      { link: '/advanced/shacl-validation', text: 'SHACL validation (validateWithShacl)' },
      { link: '/advanced/quads', text: 'RDF round-trip (toQuads / fromQuads)' },
      { link: '/advanced/predicates', text: 'RDF predicates (canonical / custom)' },
      { link: '/advanced/sameas', text: 'sameAs (ABox identity)' },
      { link: '/advanced/strict-graph-mode', text: 'Strict graph mode' },
      { link: '/advanced/duplicate-detection', text: 'Duplicate shape detection' },
      { link: '/advanced/instance-graphs', text: 'Instance graphs (aboxGraph)' }
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
      { link: '/usage-examples/bookstore-owl-taxonomy', text: 'Bookstore OWL taxonomy' },
      { link: '/usage-examples/multi-format-etl', text: 'Multi-format ETL' }
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
      { link: '/package-exports', text: 'Package exports map' },
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
const SITE_NPM = 'https://www.npmjs.com/package/json-tology';
const SITE_LOGO = `${SITE_URL}jst-node-512.png`;

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
    ['link', { rel: 'manifest', href: `${SITE_BASE}manifest.webmanifest` }],
    ['link', { rel: 'alternate', type: 'application/rss+xml', title: `${SITE_TITLE} — changelog`, href: `${SITE_BASE}feed.xml` }],

    /* `hreflang` declares this is the en-US canonical of the site. With
       only one language variant published, `x-default` points at the same
       URL — harmless duplication that disambiguates intent for international
       search engines and avoids "language not declared" webmaster-tools
       warnings. */
    ['link', { rel: 'alternate', hreflang: 'en-US', href: SITE_URL }],
    ['link', { rel: 'alternate', hreflang: 'x-default', href: SITE_URL }],
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
    ['meta', { name: 'bingbot', content: 'index, follow' }],
    ['meta', { name: 'generator', content: 'VitePress' }],
    /* `referrer` policy. `origin-when-cross-origin` strips the path on
       outbound clicks (so external sites only see the bare hostname in
       their analytics, not the specific docs page) while keeping the full
       URL on internal navigation. Good privacy posture; doesn't harm SEO. */
    ['meta', { name: 'referrer', content: 'origin-when-cross-origin' }],
    ['link', { rel: 'sitemap', type: 'application/xml', href: `${SITE_BASE}sitemap.xml` }],

    /* Search-console verification meta tags. Empty content suppresses the
       tag at build time; once the verification value is in package.json,
       the next deploy emits the tag and the property activates. */
    ...(VERIFY_GOOGLE !== '' ? [['meta', { name: 'google-site-verification', content: VERIFY_GOOGLE }] satisfies HeadConfig] : []),
    ...(VERIFY_BING !== '' ? [['meta', { name: 'msvalidate.01', content: VERIFY_BING }] satisfies HeadConfig] : []),

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
    ...(SITE_TWITTER_HANDLE !== '' ? [
      ['meta', { name: 'twitter:site', content: SITE_TWITTER_HANDLE }] satisfies HeadConfig,
      ['meta', { name: 'twitter:creator', content: SITE_TWITTER_HANDLE }] satisfies HeadConfig
    ] : []),

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
    })],

    /* Organization schema powers the Google Knowledge Panel. `sameAs`
       lists the canonical accounts that represent this organization across
       the web — GitHub repo, npm registry, author profile — so search
       engines can disambiguate `json-tology` from unrelated brands with
       the same name. `logo` is the square mark; absolute URL is mandatory. */
    ['script', { type: 'application/ld+json' }, JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      'name': SITE_TITLE,
      'url': SITE_URL,
      'logo': SITE_LOGO,
      'sameAs': [SITE_REPO, SITE_NPM, SITE_AUTHOR_URL],
      'founder': {
        '@type': 'Person',
        'name': SITE_AUTHOR_NAME,
        'url': SITE_AUTHOR_URL
      }
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
    /* VitePress sets `pageData.title` from the first H1 when no frontmatter
       title is present, and `pageData.description = ''` (empty string, not
       `undefined`) when no description is supplied. We OR-coalesce so empty
       strings fall through to the site-level defaults; ??-coalescing would
       leak empty `''` into `og:description` / `twitter:description`. */
    const frontmatterTitle = pageData.frontmatter['title'] as string | undefined;
    const frontmatterDescription = pageData.frontmatter['description'] as string | undefined;
    const title = frontmatterTitle || pageData.title || SITE_TITLE;
    const description = frontmatterDescription || pageData.description || SITE_DESCRIPTION;
    const displayTitle = title === SITE_TITLE ? SITE_TITLE : `${title} | ${SITE_TITLE}`;
    /* Force VitePress's `<title>` resolution to honour the frontmatter title
       over a content-derived H1 (relevant when a page uses a custom hero
       with its own `<h1>` that differs from the frontmatter title). */
    if (frontmatterTitle !== undefined) pageData.title = frontmatterTitle;
    /* Suppress the `:title | json-tology` template on any page whose title
       is already the site title — without this the home renders as
       `json-tology | json-tology` (the template appends unconditionally). */
    if (title === SITE_TITLE) {
      (pageData as { titleTemplate?: string | false }).titleTemplate = false;
    }

    /* BreadcrumbList structured data. Google renders this as the
       "Home > Section > Page" trail above the SERP result, replacing the
       bare URL. Built from URL segments — root is always "json-tology";
       each path segment becomes a position with a humanised label and its
       absolute URL. */
    const segments = relPath === '' ? [] : relPath.split('/');
    const crumbs: Array<{ '@type': 'ListItem'; 'position': number; 'name': string; 'item': string }> = [
      { '@type': 'ListItem', 'position': 1, 'name': SITE_TITLE, 'item': SITE_URL }
    ];
    let accumulated = '';
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i] as string;
      accumulated = accumulated === '' ? seg : `${accumulated}/${seg}`;
      const isLast = i === segments.length - 1;
      const label = isLast
        ? title
        : seg.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      crumbs.push({
        '@type': 'ListItem',
        'position': i + 2,
        'name': label,
        'item': `${SITE_URL}${accumulated}`
      });
    }
    const breadcrumb = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': crumbs
    };

    /* Article timestamps when VitePress has resolved a `lastUpdated` value
       from git. `article:modified_time` is the freshness signal Google uses
       to rank time-sensitive content. Guard `lastUpdated === 0` (uncommitted)
       and NaN to avoid `Date(0).toISOString()` polluting the freshness signal
       with 1970, and to avoid the constructor throwing on NaN. */
    const lastUpdated = (typeof pageData.lastUpdated === 'number'
      && Number.isFinite(pageData.lastUpdated)
      && pageData.lastUpdated > 0)
      ? new Date(pageData.lastUpdated).toISOString()
      : undefined;

    pageData.frontmatter['head'] = [
      ...(pageData.frontmatter['head'] as ReadonlyArray<readonly [string, Record<string, string>]> ?? []),
      ['link', { rel: 'canonical', href: pageUrl }],
      ['meta', { property: 'og:url', content: pageUrl }],
      ['meta', { property: 'og:title', content: displayTitle }],
      ['meta', { property: 'og:description', content: description }],
      ['meta', { name: 'twitter:title', content: displayTitle }],
      ['meta', { name: 'twitter:description', content: description }],
      ['meta', { name: 'description', content: description }],
      ...(lastUpdated !== undefined ? [
        ['meta', { property: 'article:modified_time', content: lastUpdated }] as const,
        ['meta', { property: 'article:author', content: SITE_AUTHOR_NAME }] as const
      ] : []),
      ['script', { type: 'application/ld+json' }, JSON.stringify(breadcrumb)]
    ];
  },
  /**
   * Build-end hook. Generates the changelog RSS feed by parsing
   * `CHANGELOG.md` once per build and writing `feed.xml` into the VitePress
   * dist root. RSS is still the standard discovery channel for tooling
   * integrators (npm release watchers, dependency-update bots); shipping a
   * feed alongside the docs costs almost nothing and gets cited from
   * `<link rel="alternate" type="application/rss+xml">` in the head.
   */
  buildEnd(siteConfig): void {
    const changelogPath = resolve(siteConfig.root, '..', 'CHANGELOG.md');
    if (!existsSync(changelogPath)) return;
    const md = readFileSync(changelogPath, 'utf-8');
    const re = /## \[([^\]]+)\][^\n]*?-\s*(\d{4}-\d{2}-\d{2})\n([\s\S]*?)(?=\n## |\n$)/g;
    interface FeedEntryInterface {
      readonly version: string;
      readonly date: string;
      readonly body: string;
    }
    const entries: FeedEntryInterface[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(md)) !== null) {
      entries.push({ version: m[1] as string, date: m[2] as string, body: (m[3] ?? '').trim() });
    }
    const rfc822 = (isoDate: string): string => new Date(`${isoDate}T12:00:00Z`).toUTCString();
    const escape = (s: string): string => s
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
    const items = entries.map((entry) => {
      const url = `${SITE_URL}#${entry.version.toLowerCase()}`;
      return [
        '    <item>',
        `      <title>${escape(SITE_TITLE)} ${escape(entry.version)}</title>`,
        `      <link>${escape(url)}</link>`,
        `      <guid isPermaLink="false">${escape(SITE_URL)}changelog/${escape(entry.version)}</guid>`,
        `      <pubDate>${rfc822(entry.date)}</pubDate>`,
        `      <description><![CDATA[${entry.body}]]></description>`,
        '    </item>'
      ].join('\n');
    }).join('\n');
    const feed = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
      '  <channel>',
      `    <title>${escape(SITE_TITLE)} — changelog</title>`,
      `    <link>${escape(SITE_URL)}</link>`,
      `    <description>${escape(SITE_DESCRIPTION)}</description>`,
      '    <language>en-US</language>',
      `    <atom:link href="${escape(SITE_URL)}feed.xml" rel="self" type="application/rss+xml" />`,
      items,
      '  </channel>',
      '</rss>',
      ''
    ].join('\n');
    writeFileSync(resolve(siteConfig.outDir, 'feed.xml'), feed);
  },
  appearance: themeConfig.appearance,
  // Internal planning documents — excluded from the published site.
  // These files contain <LIST>, <your test files> and similar template
  // placeholders that the Vue compiler in VitePress treats as unclosed HTML
  // tags, causing build failures. Plans are development artifacts; they are
  // not user documentation and must not appear on the published site.
  srcExclude: ['plans/**/*.md'],
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
