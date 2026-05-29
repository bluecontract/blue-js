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
const scenarioResourceRoot = path.join(
  root,
  'libs/scenarios/src/resources/scenarios',
);
const scenarioTestPath = path.join(root, 'libs/scenarios/src/scenarios.test.ts');

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
  77,
  'Blue Language fixture manifest count',
);
assertEqual(
  bexManifest.counts?.totalFixtures,
  159,
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

compareFixtureTreeIfPresent(
  'Blue Language Java fixtures',
  path.join(
    root,
    '../blue-language-java/src/test/resources/blue-language-1.0/fixtures',
  ),
  path.dirname(languageManifestPath),
);
compareFixtureTreeIfPresent(
  'BEX Java rich fixtures',
  path.join(root, '../blue-bex-java/src/test/resources/rich-fixtures'),
  path.dirname(bexManifestPath),
);
assertScenarioTestsReferenceAllResources();

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

function compareFixtureTreeIfPresent(label, expectedRoot, actualRoot) {
  if (!fs.existsSync(expectedRoot) || !fs.existsSync(actualRoot)) {
    console.log(`${label}: sibling fixture tree not present, skipped.`);
    return;
  }

  const expectedFiles = yamlFiles(expectedRoot);
  const actualFiles = yamlFiles(actualRoot);
  const missing = expectedFiles.filter((file) => !actualFiles.includes(file));
  const extra = actualFiles.filter((file) => !expectedFiles.includes(file));
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `${label} mismatch. Missing: ${missing.join(', ') || '<none>'}. Extra: ${
        extra.join(', ') || '<none>'
      }.`,
    );
  }

  const different = expectedFiles.filter((file) => {
    const expected = fs.readFileSync(path.join(expectedRoot, file), 'utf8');
    const actual = fs.readFileSync(path.join(actualRoot, file), 'utf8');
    return expected !== actual;
  });
  if (different.length > 0) {
    throw new Error(`${label} content differs: ${different.join(', ')}`);
  }
}

function assertScenarioTestsReferenceAllResources() {
  if (!fs.existsSync(scenarioResourceRoot) || !fs.existsSync(scenarioTestPath)) {
    return;
  }

  const resources = yamlFiles(scenarioResourceRoot).map((file) =>
    `scenarios/${file}`,
  );
  const source = fs.readFileSync(scenarioTestPath, 'utf8');
  const references = [
    ...source.matchAll(/['"](scenarios\/[A-Za-z0-9_.\/-]+\.yaml)['"]/g),
  ].map((match) => match[1]);
  const uniqueReferences = [...new Set(references)];
  const missing = resources.filter((file) => !uniqueReferences.includes(file));
  const extra = uniqueReferences.filter((file) => !resources.includes(file));

  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `Scenario test resource coverage mismatch. Missing: ${
        missing.join(', ') || '<none>'
      }. Extra: ${extra.join(', ') || '<none>'}.`,
    );
  }
}

function yamlFiles(directory) {
  return walk(directory)
    .filter((file) => file.endsWith('.yaml') || file.endsWith('.yml'))
    .map((file) => path.relative(directory, file).split(path.sep).join('/'))
    .sort();
}
