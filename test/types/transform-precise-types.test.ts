/**
 * Compile-time assertions for the precise-typing fixes (designs/0005 §6, §8):
 *
 *  #6 — `Transform.getDecoder` accepts a branded `Compose.*` schema directly,
 *       with no `as unknown as Record<string, unknown>` cast.
 *  #8 — `addTransform` is a normalize transform: `decode` consumes the raw
 *       wire payload and produces the schema's canonical (branded) form;
 *       `encode` is the inverse (canonical → wire). The author brands the
 *       decoded leaf explicitly.
 *
 * Both checks are guarded in unexecuted functions: the bodies are type-checked
 * (the point of the test) but never run.
 *
 * Compile with: tsc --noEmit --project tsconfig.test-types.json
 */

import { Compose } from '../../src/modules/composition/Compose.js';
import { Transform } from '../../src/modules/transform/Transform.js';
import { JsonTology } from '../../src/index.js';

// #6 — a branded Compose.subClassOf schema is accepted by getDecoder with no cast.
function getDecoderAcceptsBrandedSchema(): void {
  const StringValueSchema = {
    '$id': 'ex:StringValue',
    'type': 'string'
  } as const;

  const IriSchema = Compose.subClassOf(StringValueSchema, {
    '$id': 'ex:IriString',
    'format': 'iri',
    'type': 'string'
  });

  // No `as unknown as Record<string, unknown>` — the branded interface (which
  // has no string index signature) is accepted directly by `schema: object`.
  Transform.getDecoder(IriSchema);
}

void getDecoderAcceptsBrandedSchema;

// #8 — addTransform is a normalize transform: decode consumes the raw wire
// payload and produces the schema's canonical form. Both sides speak the
// brand-free structural canonical (`UnbrandType`), so the mapper is plain —
// no per-leaf `brand()`; `validate` (run by `instantiate`) is the brand boundary.
function addTransformProducesCanonical(): void {
  const TimestampSchema = {
    '$id': 'ex:Timestamp',
    'minLength': 1,
    'type': 'string'
  } as const;

  const jt = JsonTology.create({
    'baseIri': 'https://ex.io',
    'schemas': [TimestampSchema]
  });

  jt.addTransform(TimestampSchema, {
    // `raw` is the free wire payload; decode produces the canonical string as a
    // plain value — the length-brand is applied at validation, not here.
    'decode': (raw: { 'ms': number }) => {
      return new Date(raw.ms).toISOString();
    },
    // encode is the inverse: canonical → raw wire payload.
    'encode': (value) => {
      return { 'ms': new Date(value).getTime() };
    }
  });
}

void addTransformProducesCanonical;
