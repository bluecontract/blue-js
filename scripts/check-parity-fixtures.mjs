import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
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
const contractsManifestPath = path.join(
  root,
  'libs/document-processor/src/conformance/fixtures/blue-contracts-1.0/fixtures/manifest.yaml',
);
const contractsRegistryRoot = path.join(
  root,
  'libs/document-processor/src/conformance/fixtures/blue-contracts-1.0/registry/blue-contracts-1.0',
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
  path.join(
    root,
    'libs/document-processor/src/conformance/BlueContractsConformanceSuiteRunner.spec.ts',
  ),
];

const languageManifest = readYaml(languageManifestPath);
const bexManifest = readYaml(bexManifestPath);
const contractsManifest = readYaml(contractsManifestPath);

validateFixturePackage({
  label: 'Blue Language fixtures',
  manifest: languageManifest,
  manifestPath: languageManifestPath,
  expectedCount: 77,
  expectedIdentity:
    'sha256:3387cb4b6626fc56cec91d584b2df7f37c229e396dee990750ac50e762a1bc1d',
  identityAlgorithm: 'manifest-order-with-path-markers',
});
validateFixturePackage({
  label: 'Blue Contracts fixtures',
  manifest: contractsManifest,
  manifestPath: contractsManifestPath,
  expectedCount: 133,
  expectedIdentity:
    'sha256:2f197ca3bbdc41b75e772777cc48e51019754347e1bee26b5f3209b71d9bd9ca',
  identityAlgorithm: 'manifest-order-with-path-markers',
});
validateFixturePackage({
  label: 'BEX rich fixtures',
  manifest: bexManifest,
  manifestPath: bexManifestPath,
  expectedCount: 159,
  expectedIdentity:
    'sha256:c0e9323a02d5d7102e727e8bc82f2c1f6e9f40132ba5380ef93240068e9d1946',
  identityAlgorithm: 'bex-lexicographic-paths',
});

for (const runnerPath of conformanceRunnerPaths) {
  if (!fs.existsSync(runnerPath)) {
    throw new Error(
      `Conformance runner is missing: ${path.relative(root, runnerPath)}`,
    );
  }
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
compareFileTreeIfPresent(
  'Blue Contracts Java fixtures',
  path.join(root, '../blue-language-java/src/test/resources/blue-contracts-1.0/fixtures'),
  path.dirname(contractsManifestPath),
);
compareFileTreeIfPresent(
  'Blue Contracts Java runtime registry',
  path.join(root, '../blue-language-java/src/main/resources/registry/blue-contracts-1.0'),
  contractsRegistryRoot,
);
assertNoForbiddenFallbackStrings();
assertNoLegacySignatureState();
assertConformanceApisExecuteFixtures();
assertCheckpointIdentityUsesBlueIds();
assertTypeGeneralizationPlannerDoesNotForceRootParent();
assertScriptedRuntimeDoesNotImplementGeneralization();
assertBexNumericNormalizationPreservesDecimals();
assertProductionComputeUsesDocumentView();
assertScenarioTestsReferenceAllResources();

console.log('Parity fixture guard passed.');
console.log(`Language fixtures: ${languageManifest.fixtures.length}`);
console.log(`BEX rich fixtures: ${bexManifest.counts.totalFixtures}`);
console.log(`Contracts fixtures: ${contractsManifest.fixtures.length}`);

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

function validateFixturePackage({
  label,
  manifest,
  manifestPath,
  expectedCount,
  expectedIdentity,
  identityAlgorithm,
}) {
  if (!manifest || !Array.isArray(manifest.fixtures)) {
    throw new Error(`${label} manifest must define a fixtures list.`);
  }

  assertEqual(manifest.fixtures.length, expectedCount, `${label} manifest count`);
  assertEqual(
    manifest.fixturePackageIdentity,
    expectedIdentity,
    `${label} fixture package identity`,
  );

  const fixtureRoot = path.dirname(manifestPath);
  const manifestPaths = [];
  const fixtureIds = new Set();
  for (const fixture of manifest.fixtures) {
    if (!fixture || typeof fixture !== 'object') {
      throw new Error(`${label} manifest contains a non-object fixture entry.`);
    }
    if (typeof fixture.id !== 'string' || fixture.id.length === 0) {
      throw new Error(`${label} manifest fixture is missing id.`);
    }
    if (fixtureIds.has(fixture.id)) {
      throw new Error(`${label} manifest has duplicate fixture id ${fixture.id}.`);
    }
    fixtureIds.add(fixture.id);

    if (typeof fixture.path !== 'string' || fixture.path.length === 0) {
      throw new Error(`${label} manifest fixture ${fixture.id} is missing path.`);
    }
    const fixturePath = path.join(fixtureRoot, fixture.path);
    if (!fs.existsSync(fixturePath)) {
      throw new Error(`${label} manifest file is missing: ${fixture.path}.`);
    }
    manifestPaths.push(fixture.path);
  }

  const manifestPathSet = new Set(manifestPaths);
  const actualYamlFiles = yamlFiles(fixtureRoot).filter(
    (file) => file !== 'manifest.yaml',
  );
  const extraYamlFiles = actualYamlFiles.filter(
    (file) => !manifestPathSet.has(file),
  );
  if (extraYamlFiles.length > 0) {
    throw new Error(
      `${label} has unlisted YAML fixture files: ${extraYamlFiles.join(', ')}.`,
    );
  }

  const actualIdentity = computeFixturePackageIdentity({
    manifestPath,
    fixtureRoot,
    fixturePaths: manifestPaths,
    identityAlgorithm,
  });
  if (actualIdentity !== manifest.fixturePackageIdentity) {
    throw new Error(
      `${label} identity mismatch. Manifest has ${manifest.fixturePackageIdentity}, computed ${actualIdentity}.`,
    );
  }
}

function computeFixturePackageIdentity({
  manifestPath,
  fixtureRoot,
  fixturePaths,
  identityAlgorithm,
}) {
  const digest = crypto.createHash('sha256');
  const normalizedManifest = normalizeManifestForIdentity(
    fs.readFileSync(manifestPath, 'utf8'),
  );

  if (identityAlgorithm === 'manifest-order-with-path-markers') {
    digest.update('manifest.yaml\n', 'utf8');
    digest.update(normalizedManifest, 'utf8');
    for (const fixturePath of fixturePaths) {
      digest.update(`\n--- ${fixturePath}\n`, 'utf8');
      digest.update(
        normalizeLineEndings(
          fs.readFileSync(path.join(fixtureRoot, fixturePath), 'utf8'),
        ),
        'utf8',
      );
    }
  } else if (identityAlgorithm === 'bex-lexicographic-paths') {
    digest.update(normalizedManifest, 'utf8');
    for (const fixturePath of [...fixturePaths].sort()) {
      digest.update(`${fixturePath}\n`, 'utf8');
      digest.update(
        normalizeLineEndings(
          fs.readFileSync(path.join(fixtureRoot, fixturePath), 'utf8'),
        ),
        'utf8',
      );
      digest.update('\n', 'utf8');
    }
  } else {
    throw new Error(`Unknown fixture identity algorithm: ${identityAlgorithm}`);
  }

  return `sha256:${digest.digest('hex')}`;
}

function normalizeManifestForIdentity(source) {
  const normalized = normalizeLineEndings(source);
  if (!/^fixturePackageIdentity:.*$/m.test(normalized)) {
    throw new Error('Manifest is missing fixturePackageIdentity line.');
  }
  return normalized.replace(
    /^fixturePackageIdentity:.*$/m,
    'fixturePackageIdentity: ""',
  );
}

function normalizeLineEndings(source) {
  return source.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
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

function assertNoForbiddenFallbackStrings() {
  const forbidden = [
    'normalizeOfficialFixtureResult',
    'applyExpectedDocumentShape',
    'safeOfficialInitialDocument',
    'isOfficialProcessFixture',
    'installScriptedRuntimeFields',
    'forcedFatalResult',
    ['last', 'Signatures'].join(''),
    'handlerWasReplaced',
    'recordDocumentVisibleOrder',
  ];
  const files = filePaths(path.join(root, 'libs'))
    .filter((file) => /\.(ts|js|tsx|jsx)$/.test(file))
    .filter((file) => !file.includes('/dist/'));
  const hits = [];
  for (const file of files) {
    const absolute = path.join(root, 'libs', file);
    const source = fs.readFileSync(absolute, 'utf8');
    for (const token of forbidden) {
      if (source.includes(token)) {
        hits.push(`${path.relative(root, absolute)} contains ${token}`);
      }
    }
  }
  if (hits.length > 0) {
    throw new Error(`Forbidden conformance fallback strings found:\n${hits.join('\n')}`);
  }
}

function assertNoLegacySignatureState() {
  const allowed = new Set(['docs/java-parity-migration-report.md']);
  const token = ['last', 'Signatures'].join('');
  const hits = filePaths(root)
    .filter((file) => !file.startsWith('node_modules/'))
    .filter((file) => !file.startsWith('dist/'))
    .filter((file) => /\.(ts|js|md|yaml|yml|json)$/.test(file))
    .filter((file) => !allowed.has(file))
    .filter((file) => {
      const absolute = path.join(root, file);
      return (
        fs.statSync(absolute).isFile() &&
        fs.readFileSync(absolute, 'utf8').includes(token)
      );
    });
  if (hits.length > 0) {
    throw new Error(
      `${token} appears outside migration notes: ${hits.join(', ')}`,
    );
  }
}

function assertConformanceApisExecuteFixtures() {
  const checks = [
    {
      file: 'libs/document-processor/src/conformance/BlueContractsConformanceSuiteRunner.ts',
      required: 'runContractsFixtureEntry',
      forbiddenOnly: 'loadContractsConformanceFixtureEntries().map((entry) => entry.id)',
    },
    {
      file: 'libs/language/src/lib/conformance/BlueConformanceSuiteRunner.ts',
      required: 'runLanguageFixtureEntry',
      forbiddenOnly: 'loadLanguageConformanceFixtureEntries().map((entry) => entry.id)',
    },
    {
      file: 'libs/bex/src/lib/conformance/BexConformanceSuiteRunner.ts',
      required: 'runBexFixture(',
      forbiddenOnly: 'loadBexConformanceFixtureEntries().map((entry) => entry.id)',
    },
  ];

  for (const check of checks) {
    const source = fs.readFileSync(path.join(root, check.file), 'utf8');
    if (!source.includes(check.required)) {
      throw new Error(`${check.file} does not execute fixture bodies.`);
    }
    if (source.includes(check.forbiddenOnly)) {
      throw new Error(`${check.file} appears to report manifest ids only.`);
    }
  }
}

function assertCheckpointIdentityUsesBlueIds() {
  const manager = fs.readFileSync(
    path.join(root, 'libs/document-processor/src/engine/checkpoint-manager.ts'),
    'utf8',
  );
  const runner = fs.readFileSync(
    path.join(root, 'libs/document-processor/src/engine/channel-runner.ts'),
    'utf8',
  );
  const engine = fs.readFileSync(
    path.join(root, 'libs/document-processor/src/engine/processor-engine.ts'),
    'utf8',
  );
  for (const [label, source] of [
    ['CheckpointManager', manager],
    ['ChannelRunner', runner],
    ['ProcessorEngine', engine],
  ]) {
    if (source.includes('canonicalSignature')) {
      throw new Error(`${label} must not use canonicalSignature for checkpoints.`);
    }
  }
  if (/getProperties\(\)\?\.eventId/.test(manager)) {
    throw new Error('CheckpointManager must not read arbitrary eventId by default.');
  }
}

function assertTypeGeneralizationPlannerDoesNotForceRootParent() {
  const source = fs.readFileSync(
    path.join(
      root,
      'libs/document-processor/src/engine/generalization/type-generalization-planner.ts',
    ),
    'utf8',
  );
  if (source.includes('rootParent') || /generatedPaths\.includes\('\/type'\)/.test(source)) {
    throw new Error(
      'TypeGeneralizationPlanner must not unconditionally generalize root parent.',
    );
  }
}

function assertScriptedRuntimeDoesNotImplementGeneralization() {
  const source = fs.readFileSync(
    path.join(
      root,
      'libs/document-processor/src/conformance/BlueContractsConformanceFixtureRunner.ts',
    ),
    'utf8',
  );
  for (const token of ['planPatch(', 'generalizeChangedPath']) {
    if (source.includes(token)) {
      throw new Error(
        `ScriptedContractsRuntime must not implement fixture generalization: ${token}`,
      );
    }
  }
}

function assertBexNumericNormalizationPreservesDecimals() {
  const file = path.join(root, 'libs/bex/src/lib/value/BexValues.ts');
  const source = fs.readFileSync(file, 'utf8');
  const functionSource =
    source.match(/function normalizeBigLikeNumber[\s\S]*?\n}/)?.[0] ?? '';
  if (!functionSource.includes('return text;')) {
    throw new Error('normalizeBigLikeNumber must preserve decimal text.');
  }
  const decimalBranch = functionSource.split('return text;')[0] ?? '';
  if (/Number\(text\)[\s\S]*Number\.isFinite/.test(decimalBranch)) {
    throw new Error(
      'normalizeBigLikeNumber must not convert finite decimals to JavaScript number.',
    );
  }
}

function assertProductionComputeUsesDocumentView() {
  const files = [
    'libs/document-processor/src/registry/processors/steps/bex-compute-step-executor.ts',
    'libs/document-processor/src/registry/processors/steps/bex-field-evaluator.ts',
  ];
  const hits = [];
  for (const file of files) {
    const absolute = path.join(root, file);
    const source = fs.readFileSync(absolute, 'utf8');
    if (!source.includes('.documentView(')) {
      hits.push(`${file} does not build BEX with documentView`);
    }
    if (/\.document\s*\(/.test(source)) {
      hits.push(`${file} still calls BexExecutionContext.document(...)`);
    }
  }
  if (hits.length > 0) {
    throw new Error(hits.join('\n'));
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

function compareFileTreeIfPresent(label, expectedRoot, actualRoot) {
  if (!fs.existsSync(expectedRoot) || !fs.existsSync(actualRoot)) {
    console.log(`${label}: sibling tree not present, skipped.`);
    return;
  }

  const expectedFiles = filePaths(expectedRoot);
  const actualFiles = filePaths(actualRoot);
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
  return filePaths(directory)
    .filter((file) => file.endsWith('.yaml') || file.endsWith('.yml'))
    .sort();
}

function filePaths(directory) {
  return walk(directory)
    .map((file) => path.relative(directory, file).split(path.sep).join('/'))
    .sort();
}
