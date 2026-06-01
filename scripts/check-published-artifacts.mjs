import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const productionRoots = [
  'libs/language/src',
  'libs/language/dist',
  'libs/bex/src',
  'libs/bex/dist',
  'libs/document-processor/src',
  'libs/document-processor/dist',
];

const forbiddenTokens = [
  'normalizeOfficialFixtureResult',
  'applyExpectedDocumentShape',
  'safeOfficialInitialDocument',
  'isOfficialProcessFixture',
  'installScriptedRuntimeFields',
  'handlerWasReplaced',
  'recordDocumentVisibleOrder',
  ['last', 'Signatures'].join(''),
  "generatedPaths.includes('/type')",
  'rootParent',
];

const hits = [];

for (const rootPath of productionRoots) {
  const absoluteRoot = path.join(root, rootPath);
  if (!fs.existsSync(absoluteRoot)) {
    continue;
  }
  for (const file of productionFiles(absoluteRoot)) {
    const source = fs.readFileSync(file, 'utf8');
    const relative = path.relative(root, file);
    for (const token of forbiddenTokens) {
      if (source.includes(token)) {
        hits.push(`${relative} contains ${token}`);
      }
    }
    if (
      source.includes('canonicalSignature:') ||
      /\.canonicalSignature\s*\(/.test(source)
    ) {
      hits.push(`${relative} uses canonicalSignature in production wiring`);
    }
    if (/checkpoint-manager\.[jt]s$/.test(relative) && /getProperties\(\)\?\.eventId/.test(source)) {
      hits.push(`${relative} reads arbitrary eventId in CheckpointManager`);
    }
  }
}

assertProductionComputeUsesDocumentView();
assertDistFixturesPresent();

if (hits.length > 0) {
  throw new Error(`Published artifact guard failed:\n${hits.join('\n')}`);
}

console.log('Published artifact guard passed.');

function productionFiles(directory) {
  return walk(directory).filter((file) => {
    if (!/\.(cjs|cts|d\.ts|js|jsx|mjs|mts|ts|tsx)$/.test(file)) {
      return false;
    }
    const normalized = file.split(path.sep).join('/');
    return (
      !normalized.includes('/__tests__/') &&
      !normalized.includes('/test-support/') &&
      !/\.(spec|test)\.[cm]?[jt]sx?$/.test(normalized)
    );
  });
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const resolved = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(resolved) : [resolved];
  });
}

function assertProductionComputeUsesDocumentView() {
  const files = [
    'libs/document-processor/src/registry/processors/steps/bex-compute-step-executor.ts',
    'libs/document-processor/src/registry/processors/steps/bex-field-evaluator.ts',
    'libs/document-processor/dist/index.js',
  ];
  for (const file of files) {
    const absolute = path.join(root, file);
    if (!fs.existsSync(absolute)) {
      continue;
    }
    const source = fs.readFileSync(absolute, 'utf8');
    if (!source.includes('.documentView(') && !source.includes('documentView(')) {
      hits.push(`${file} does not use documentView`);
    }
    if (/BexExecutionContext\.builder\(\)\.document\s*\(/.test(source)) {
      hits.push(`${file} calls BexExecutionContext.document(...)`);
    }
  }
}

function assertDistFixturesPresent() {
  const checks = [
    {
      label: 'Language',
      source: 'libs/language/src/lib/conformance/fixtures',
      target: 'libs/language/dist/lib/conformance/fixtures',
    },
    {
      label: 'Blue Contracts',
      source: 'libs/document-processor/src/conformance/fixtures',
      target: 'libs/document-processor/dist/conformance/fixtures',
    },
    {
      label: 'BEX',
      source: 'libs/bex/src/lib/conformance/fixtures',
      target: 'libs/bex/dist/lib/conformance/fixtures',
    },
  ];
  for (const check of checks) {
    const sourceRoot = path.join(root, check.source);
    const targetRoot = path.join(root, check.target);
    if (!fs.existsSync(sourceRoot)) {
      hits.push(`${check.label} source fixtures missing at ${check.source}`);
      continue;
    }
    if (!fs.existsSync(targetRoot)) {
      hits.push(`${check.label} dist fixtures missing at ${check.target}`);
      continue;
    }
    const sourceFiles = relativeFiles(sourceRoot);
    const targetFiles = relativeFiles(targetRoot);
    const missing = sourceFiles.filter((file) => !targetFiles.includes(file));
    const extra = targetFiles.filter((file) => !sourceFiles.includes(file));
    if (missing.length > 0 || extra.length > 0) {
      hits.push(
        `${check.label} dist fixtures mismatch. Missing: ${
          missing.join(', ') || '<none>'
        }. Extra: ${extra.join(', ') || '<none>'}.`,
      );
    }
  }
}

function relativeFiles(directory) {
  return walk(directory)
    .map((file) => path.relative(directory, file).split(path.sep).join('/'))
    .sort();
}
