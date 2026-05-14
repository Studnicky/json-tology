/**
 * Parse .cpuprofile files and show top self-time functions from json-tology.
 */

import { readFileSync } from 'node:fs';

interface ProfileNode {
  'callFrame': {
    'columnNumber': number;
    'functionName': string;
    'lineNumber': number;
    'scriptId': string;
    'url': string;
  };
  'children'?: number[];
  'hitCount': number;
  'id': number;
}

interface Profile {
  'endTime': number;
  'nodes': ProfileNode[];
  'samples': number[];
  'startTime': number;
  'timeDeltas': number[];
}

const files = [
  'examples/docs/benchmarks/validate-valid.cpuprofile',
  'examples/docs/benchmarks/validate-invalid.cpuprofile',
  'examples/docs/benchmarks/coerce.cpuprofile',
  'examples/docs/benchmarks/convert.cpuprofile',
  'examples/docs/benchmarks/clean.cpuprofile'
];

for (const file of files) {
  const profile: Profile = JSON.parse(readFileSync(file, 'utf8')) as Profile;

  // Self time from samples + timeDeltas
  const selfTime = new Map<number, number>();

  for (let index = 0; index < profile.samples.length; index++) {
    const nodeId = profile.samples[index];
    const delta = profile.timeDeltas[index];

    selfTime.set(nodeId, (selfTime.get(nodeId) ?? 0) + delta);
  }

  const totalTime = profile.timeDeltas.reduce((sum, delta) => {
    return sum + delta;
  }, 0);

  const nodeMap = new Map<number, ProfileNode>();

  for (const node of profile.nodes) {
    nodeMap.set(node.id, node);
  }

  const entries = [...selfTime.entries()]
    .map(([
      id,
      time
    ]) => {
      return {
        'node': nodeMap.get(id),
        time
      };
    })
    .filter((entry) => {
      return entry.node?.callFrame.url.includes('json-tology') === true;
    })
    .sort((first, second) => {
      return second.time - first.time;
    })
    .slice(0, 15);

  console.log(`\n${'='.repeat(90)}`);
  console.log(`${file} — total: ${(totalTime / 1000).toFixed(1)}ms`);
  console.log('='.repeat(90));
  console.log(`${'Self%'.padStart(7)}  ${'Self ms'.padStart(8)}  Function`);
  console.log(`${'-'.repeat(7)}  ${'-'.repeat(8)}  ${'-'.repeat(60)}`);

  for (const entry of entries) {
    if (entry.node === undefined) {
      continue;
    }
    const pct = ((entry.time / totalTime) * 100).toFixed(1);
    const ms = (entry.time / 1000).toFixed(1);
    const url = entry.node.callFrame.url.replace(/^.*json-tology\//u, '');
    const line = String(entry.node.callFrame.lineNumber + 1);
    const name = entry.node.callFrame.functionName || '(anonymous)';

    console.log(`${pct.padStart(7)}  ${ms.padStart(8)}  ${name} (${url}:${line})`);
  }
}
