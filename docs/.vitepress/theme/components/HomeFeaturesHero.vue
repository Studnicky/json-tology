<script setup lang="ts">
// Renders the hero + features block manually so docs/index.md can use layout: doc
// and retain the standard sidebar.
</script>

<template>
  <div class="home-hero-features">
    <div class="hero-section">
      <h1 class="hero-name">json-tology</h1>
      <p class="hero-text">TypeScript types from JSON Schema.</p>
      <p class="hero-tagline">
        Author once with JSON Schema. Get typed validation, parsing, defaults,
        transforms, and serialization. Pydantic-style ergonomics for TypeScript.
      </p>
      <div class="hero-actions">
        <a href="/getting-started" class="action-brand">Get Started</a>
        <a href="https://github.com/Studnicky/json-tology" class="action-alt" target="_blank" rel="noopener">View on GitHub</a>
      </div>
    </div>

    <div class="features-grid">
      <div class="feature">
        <h3>Compile-time Types</h3>
        <p><code>InferType&lt;typeof Schema&gt;</code> derives the TypeScript type from your as-const schema literal. No code generation, no separate type definition.</p>
      </div>
      <div class="feature">
        <h3>Runtime Validation</h3>
        <p><code>validate()</code>, <code>is()</code>, <code>errors()</code> check data against a registered schema and return structured <code>ValidationErrors</code> with JSON Pointer paths.</p>
      </div>
      <div class="feature">
        <h3>Coercion with Defaults</h3>
        <p><code>coerce()</code> validates, applies defaults, runs Transform decoders, and strips unknown properties in one pass. Throws a typed <code>InstantiationError</code> on failure.</p>
      </div>
      <div class="feature">
        <h3>Composition</h3>
        <p><code>extend</code>, <code>pick</code>, <code>omit</code>, <code>partial</code>, <code>required</code>, <code>intersection</code>, <code>discriminatedUnion</code>: Pydantic-style derivations from base schemas, all type-safe.</p>
      </div>
      <div class="feature">
        <h3>Transforms and Brands</h3>
        <p>Per-field decode/encode pipelines via <code>Transform</code>, plus brand types for nominal typing. Round-trip wire format to decoded values with type safety.</p>
      </div>
      <div class="feature">
        <h3>Tree-Shakable</h3>
        <p>Sub-path exports - <code>json-tology/value</code>, <code>json-tology/schema</code>, <code>json-tology/types</code> - let users opt into only what they need. Graph and ontology are fully tree-shakable.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-hero-features {
  padding: 2rem 0 1rem;
}

.hero-section {
  text-align: center;
  padding: 2rem 0;
}

.hero-name {
  font-size: 3rem;
  font-weight: 800;
  background: linear-gradient(120deg, var(--vp-c-brand-1), var(--vp-c-brand-2));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  line-height: 1.1;
}

.hero-text {
  font-size: 1.4rem;
  font-weight: 600;
  color: var(--vp-c-text-1);
  margin-top: 0.5rem;
}

.hero-tagline {
  color: var(--vp-c-text-2);
  font-size: 1rem;
  max-width: 560px;
  margin: 0.75rem auto 0;
  line-height: 1.6;
}

.hero-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-top: 1.5rem;
  flex-wrap: wrap;
}

.action-brand,
.action-alt {
  display: inline-block;
  border-radius: 20px;
  font-size: 0.95rem;
  font-weight: 600;
  padding: 0.5rem 1.5rem;
  text-decoration: none;
  transition: opacity 0.2s;
}

.action-brand {
  background: var(--vp-c-brand-1);
  color: var(--vp-c-white);
}

.action-alt {
  background: transparent;
  border: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-1);
}

.action-brand:hover,
.action-alt:hover {
  opacity: 0.85;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1rem;
  margin-top: 2rem;
}

.feature {
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  padding: 1rem 1.25rem;
  background: var(--vp-c-bg-alt);
}

.feature h3 {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 0.5rem;
  border: none;
}

.feature p {
  font-size: 0.9rem;
  color: var(--vp-c-text-2);
  line-height: 1.5;
  margin: 0;
}
</style>
