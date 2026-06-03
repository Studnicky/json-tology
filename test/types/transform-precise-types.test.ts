/**
 * Compile-time assertions for the precise-typing fixes (designs/0005 §6, §8):
 *
 *  #6 — `Transform.getDecoder` accepts a branded `Compose.*` schema directly,
 *       with no `as unknown as Record<string, unknown>` cast.
 *  #8 — `addTransform`'s `encode` returns the schema's brand-free InputType
 *       (`LooseInputType<InferSchemaType<…>>`), so the natural wire-producing
 *       encoder type-checks with no cast. `decode` still receives the branded
 *       OutputType.
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

// #8 — addTransform's encode returns the brand-free InputType (no cast).
function addTransformEncodeIsBrandFree(): void {
  const TimestampSchema = {
    '$id': 'ex:Timestamp',
    'minLength': 1,
    'type': 'string'
  } as const;

  const jt = JsonTology.create({
    'baseIRI': 'https://ex.io',
    'schemas': [TimestampSchema]
  });

  jt.addTransform(TimestampSchema, {
    // `input` is the validated, branded OutputType (a length-constrained string).
    'decode': (input: string): Date => {
      return new Date(input);
    },
    // returns a plain `string` — the brand-free InputType. With the old branded
    // signature this required a cast; now it type-checks as written.
    'encode': (output: Date): string => {
      return output.toISOString();
    }
  });
}

void addTransformEncodeIsBrandFree;
