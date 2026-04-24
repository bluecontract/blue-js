#!/usr/bin/env node

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../../..');

const outputPath = path.join(
  repoRoot,
  'libs/language/docs/blue-id-call-sites.md',
);

const ignoredDirectories = new Set([
  '.git',
  '.nx',
  'coverage',
  'dist',
  'node_modules',
  'out-tsc',
  'test-output',
]);

const ignoredPathFragments = [
  'libs/language/docs/',
  'libs/language/scripts/audit/',
];

const scannedExtensions = new Set([
  '.cjs',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.mts',
  '.ts',
  '.tsx',
]);

const directCalculatorPattern =
  /\bBlueIdCalculator\.calculateBlueId(?:Sync)?\s*\(/;
const instancePattern = /\.calculateBlueId(?:Sync)?\s*\(/;
const entrypointPattern =
  /\b(?:public\s+(?:static\s+)?|export\s+const\s+)calculateBlueId(?:Sync)?(?:\s*=|\()/;
const helperPattern = /(?<![\w.])calculateBlueId(?:Sync)?\(/;

const walk = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (ignoredDirectories.has(entry.name)) {
        continue;
      }
      files.push(...(await walk(path.join(directory, entry.name))));
      continue;
    }

    if (!entry.isFile() || !scannedExtensions.has(path.extname(entry.name))) {
      continue;
    }

    const absolutePath = path.join(directory, entry.name);
    const relativePath = path.relative(repoRoot, absolutePath);
    if (
      ignoredPathFragments.some((fragment) => relativePath.includes(fragment))
    ) {
      continue;
    }
    files.push(absolutePath);
  }

  return files;
};

const classifyKind = (line) => {
  if (directCalculatorPattern.test(line)) {
    return 'BlueIdCalculator.calculateBlueId*';
  }
  if (instancePattern.test(line)) {
    return 'Blue.calculateBlueId* instance/API';
  }
  if (entrypointPattern.test(line)) {
    return 'BlueId calculation entrypoint/wrapper';
  }
  if (helperPattern.test(line)) {
    return 'src/utils/blueId helper';
  }
  return null;
};

const classifyArea = (relativePath) => {
  if (relativePath.startsWith('libs/document-processor/')) {
    return 'document-processor';
  }
  if (relativePath.startsWith('libs/dsl-sdk/')) {
    return 'dsl-sdk';
  }
  if (relativePath.includes('/scripts/benchmark/')) {
    return 'language benchmark scripts';
  }
  if (relativePath === 'libs/language/src/lib/Blue.ts') {
    return 'Blue public API';
  }
  if (relativePath.startsWith('libs/language/src/utils/blueId/')) {
    return 'public utility helper wrappers';
  }
  if (relativePath.startsWith('libs/language/src/lib/provider/')) {
    return 'language providers';
  }
  if (
    relativePath.startsWith('libs/language/src/lib/merge/') ||
    relativePath.endsWith('/MergeReverser.ts') ||
    relativePath.endsWith('/NodeTypes.ts') ||
    relativePath.endsWith('/NodeTypeMatcher.ts') ||
    relativePath.endsWith('/TypeSchemaResolver.ts')
  ) {
    return 'language resolver and type utilities';
  }
  if (
    relativePath.includes('/__tests__/') ||
    relativePath.includes('/test-support/') ||
    relativePath.includes('/tests/')
  ) {
    return 'tests and test support';
  }
  if (relativePath.startsWith('libs/language/')) {
    return 'language other';
  }
  return 'other workspace code';
};

const escapeMarkdownCell = (value) =>
  value.replaceAll('\\', '\\\\').replaceAll('|', '\\|').replaceAll('`', '\\`');

const collectCallSites = async () => {
  const files = await walk(path.join(repoRoot, 'libs'));
  const callSites = [];

  for (const absolutePath of files) {
    const relativePath = path.relative(repoRoot, absolutePath);
    const content = await readFile(absolutePath, 'utf8');
    const lines = content.split(/\r?\n/);

    lines.forEach((line, index) => {
      const kind = classifyKind(line);
      if (!kind) {
        return;
      }

      callSites.push({
        area: classifyArea(relativePath),
        file: relativePath,
        kind,
        line: index + 1,
        source: line.trim(),
      });
    });
  }

  return callSites.sort((a, b) => {
    const area = a.area.localeCompare(b.area);
    if (area !== 0) {
      return area;
    }
    const file = a.file.localeCompare(b.file);
    if (file !== 0) {
      return file;
    }
    return a.line - b.line;
  });
};

const summarize = (callSites, key) => {
  const counts = new Map();
  for (const callSite of callSites) {
    counts.set(callSite[key], (counts.get(callSite[key]) ?? 0) + 1);
  }
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b));
};

const renderMarkdown = (callSites) => {
  const files = new Set(callSites.map((callSite) => callSite.file));
  const generatedAt = new Date().toISOString();
  const lines = [
    '# BlueId Call-Site Inventory',
    '',
    `Generated by \`node libs/language/scripts/audit/blue-id-call-sites.mjs --write\` at ${generatedAt}.`,
    '',
    'This is a Phase 0 baseline. It records current call-sites before Phase A',
    'moves production identity calculation to a spec-canonical path.',
    '',
    '## Summary',
    '',
    `- Total call-sites: ${callSites.length}`,
    `- Files with call-sites: ${files.size}`,
    '',
    '### By Area',
    '',
    '| Area | Count |',
    '| --- | ---: |',
    ...summarize(callSites, 'area').map(
      ([area, count]) => `| ${escapeMarkdownCell(area)} | ${count} |`,
    ),
    '',
    '### By Call Kind',
    '',
    '| Kind | Count |',
    '| --- | ---: |',
    ...summarize(callSites, 'kind').map(
      ([kind, count]) => `| ${escapeMarkdownCell(kind)} | ${count} |`,
    ),
    '',
    '## Call-Sites',
    '',
    '| Area | Kind | Location | Source |',
    '| --- | --- | --- | --- |',
  ];

  for (const callSite of callSites) {
    lines.push(
      `| ${escapeMarkdownCell(callSite.area)} | ${escapeMarkdownCell(
        callSite.kind,
      )} | \`${callSite.file}:${callSite.line}\` | \`${escapeMarkdownCell(
        callSite.source,
      )}\` |`,
    );
  }

  lines.push('');
  return lines.join('\n');
};

const main = async () => {
  const shouldWrite = process.argv.includes('--write');
  const callSites = await collectCallSites();
  const markdown = renderMarkdown(callSites);

  if (shouldWrite) {
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, markdown);
    console.log(`Wrote ${path.relative(repoRoot, outputPath)}`);
    return;
  }

  console.log(markdown);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
