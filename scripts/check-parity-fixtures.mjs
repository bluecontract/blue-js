import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const root = process.cwd();

const languageManifestPath = path.join(
  root,
  'libs/language/src/lib/conformance/fixtures/blue-language-1.0/fixtures/manifest.yaml',
);
const bexManifestPath = path.join(
  root,
  'libs/bex/src/lib/conformance/fixtures/rich-fixtures/manifest.yaml',
);

const conformanceRunnerPaths = [
  path.join(
    root,
    'libs/language/src/lib/conformance/BlueConformanceSuiteRunner.spec.ts',
  ),
  path.join(root, 'libs/bex/src/lib/conformance/BexRichFixtureTest.spec.ts'),
];

const languageManifest = readYaml(languageManifestPath);
const bexManifest = readYaml(bexManifestPath);

assertEqual(
  languageManifest.fixtures?.length,
  58,
  'Blue Language fixture manifest count',
);
assertEqual(
  bexManifest.counts?.totalFixtures,
  155,
  'BEX rich fixture manifest total count',
);

const bexFixtureRoot = path.dirname(bexManifestPath);
const bexFixtureFiles = walk(bexFixtureRoot).filter(
  (file) => file.endsWith('.yaml') && !file.endsWith('manifest.yaml'),
);
assertEqual(
  bexFixtureFiles.length,
  bexManifest.counts.totalFixtures,
  'BEX rich fixture file count',
);

for (const runnerPath of conformanceRunnerPaths) {
  assertNoDisabledTests(runnerPath);
}

console.log('Parity fixture guard passed.');
console.log(`Language fixtures: ${languageManifest.fixtures.length}`);
console.log(`BEX rich fixtures: ${bexManifest.counts.totalFixtures}`);

function readYaml(file) {
  return yaml.load(fs.readFileSync(file, 'utf8'));
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const resolved = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(resolved) : [resolved];
  });
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} expected ${expected}, received ${actual}`);
  }
}

function assertNoDisabledTests(file) {
  const source = fs.readFileSync(file, 'utf8');
  const forbidden = [
    /\.only\b/,
    /\.skip\b/,
    /\btest\.todo\b/,
    /\bit\.todo\b/,
    /\bdescribe\.only\b/,
  ];
  for (const pattern of forbidden) {
    if (pattern.test(source)) {
      throw new Error(
        `Conformance runner ${path.relative(root, file)} contains ${pattern}`,
      );
    }
  }
}
