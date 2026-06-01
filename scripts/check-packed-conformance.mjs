import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const npmCacheRoot = path.join(os.tmpdir(), 'blue-js-npm-cache');

fs.mkdirSync(npmCacheRoot, { recursive: true });

const expectedIdentities = {
  language:
    'sha256:3387cb4b6626fc56cec91d584b2df7f37c229e396dee990750ac50e762a1bc1d',
  contracts:
    'sha256:2f197ca3bbdc41b75e772777cc48e51019754347e1bee26b5f3209b71d9bd9ca',
  bex: 'sha256:c0e9323a02d5d7102e727e8bc82f2c1f6e9f40132ba5380ef93240068e9d1946',
};

run('npx', ['nx', 'run-many', '-t', 'build', '--all', '--skip-nx-cache'], {
  env: { NX_DAEMON: 'false', NX_ISOLATE_PLUGINS: 'false' },
});
run('node', ['scripts/check-published-artifacts.mjs']);

assertFixtureCopy({
  label: 'Language',
  source: 'libs/language/src/lib/conformance/fixtures',
  target: 'libs/language/dist/lib/conformance/fixtures',
});
assertFixtureCopy({
  label: 'Blue Contracts',
  source: 'libs/document-processor/src/conformance/fixtures',
  target: 'libs/document-processor/dist/conformance/fixtures',
});
assertFixtureCopy({
  label: 'BEX',
  source: 'libs/bex/src/lib/conformance/fixtures',
  target: 'libs/bex/dist/lib/conformance/fixtures',
});

assertDryRunPackContainsFixtures({
  workspace: '@blue-labs/language',
  requiredPrefix: 'dist/lib/conformance/fixtures/',
});
assertDryRunPackContainsFixtures({
  workspace: '@blue-labs/document-processor',
  requiredPrefix: 'dist/conformance/fixtures/',
});
assertDryRunPackContainsFixtures({
  workspace: '@blue-labs/bex',
  requiredPrefix: 'dist/lib/conformance/fixtures/',
});

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-packed-'));
try {
  installWorkspaceSymlink(
    tempRoot,
    '@blue-labs/shared-utils',
    'libs/shared/utils',
  );
  installWorkspaceSymlink(
    tempRoot,
    '@blue-labs/repository-contract',
    'libs/repository-contract',
  );
  installWorkspaceSymlink(tempRoot, '@blue-labs/language', 'libs/language');
  installWorkspaceSymlink(tempRoot, '@blue-labs/bex', 'libs/bex');
  installWorkspaceSymlink(
    tempRoot,
    '@blue-labs/document-processor',
    'libs/document-processor',
  );
  installExternalRepositoryTypes(tempRoot);
  const checkFile = path.join(tempRoot, 'check.mjs');
  fs.writeFileSync(checkFile, conformanceSmokeSource(), 'utf8');
  run('node', [checkFile], { cwd: tempRoot });
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

console.log('Packed package conformance smoke passed.');

function run(command, args, options = {}) {
  const executable =
    process.platform === 'win32' && ['npm', 'npx', 'node'].includes(command)
      ? `${command}.cmd`
      : command;
  execFileSync(executable, args, {
    cwd: options.cwd ?? root,
    stdio: 'inherit',
    env: { ...process.env, npm_config_cache: npmCacheRoot, ...options.env },
  });
}

function assertFixtureCopy({ label, source, target }) {
  const sourceRoot = path.join(root, source);
  const targetRoot = path.join(root, target);
  const sourceFiles = relativeFiles(sourceRoot);
  const targetFiles = relativeFiles(targetRoot);
  const missing = sourceFiles.filter((file) => !targetFiles.includes(file));
  const extra = targetFiles.filter((file) => !sourceFiles.includes(file));
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `${label} fixture copy mismatch. Missing: ${
        missing.join(', ') || '<none>'
      }. Extra: ${extra.join(', ') || '<none>'}.`,
    );
  }
  console.log(`${label} dist fixture files: ${targetFiles.length}`);
}

function assertDryRunPackContainsFixtures({ workspace, requiredPrefix }) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const output = execFileSync(
    npm,
    ['pack', '--workspace', workspace, '--dry-run', '--json'],
    {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, npm_config_cache: npmCacheRoot },
    },
  );
  const [pack] = JSON.parse(output);
  const files = pack.files.map((file) => file.path);
  if (!files.some((file) => file.startsWith(requiredPrefix))) {
    throw new Error(
      `${workspace} dry-run package is missing ${requiredPrefix} resources.`,
    );
  }
  console.log(`${workspace} dry-run files: ${files.length}`);
}

function installWorkspaceSymlink(tempRoot, packageName, relativeTarget) {
  const target = path.join(root, relativeTarget);
  const link = path.join(tempRoot, 'node_modules', ...packageName.split('/'));
  fs.mkdirSync(path.dirname(link), { recursive: true });
  fs.symlinkSync(target, link, 'dir');
}

function installExternalRepositoryTypes(tempRoot) {
  const target = path.resolve(root, '../blue-repository-js/libs/types');
  if (!fs.existsSync(target)) {
    throw new Error(`@blue-repository/types not found at ${target}`);
  }
  const link = path.join(
    tempRoot,
    'node_modules',
    '@blue-repository',
    'types',
  );
  fs.mkdirSync(path.dirname(link), { recursive: true });
  fs.symlinkSync(target, link, 'dir');
}

function conformanceSmokeSource() {
  return `
import { runLanguageConformanceSuite } from '@blue-labs/language';
import { runContractsConformanceSuite } from '@blue-labs/document-processor';
import { runBexConformanceSuite } from '@blue-labs/bex';

const expected = ${JSON.stringify(expectedIdentities, null, 2)};

await assertReport('Language', expected.language, await runLanguageConformanceSuite());
await assertReport('Contracts', expected.contracts, await runContractsConformanceSuite());
await assertReport('BEX', expected.bex, await runBexConformanceSuite());

function assertReport(label, expectedIdentity, report) {
  if (report.fixturePackageIdentity !== expectedIdentity) {
    throw new Error(label + ' fixture identity changed: ' + report.fixturePackageIdentity);
  }
  if (!report.fixturePackageIdentityMatchesFixtureFiles()) {
    throw new Error(label + ' fixture identity does not match files.');
  }
  if (!report.hasExactRequiredFixtureSet()) {
    throw new Error(label + ' fixture set is not exact.');
  }
  const failures = report.failures();
  if (failures.length > 0) {
    throw new Error(label + ' conformance failures: ' + JSON.stringify(failures, null, 2));
  }
  console.log(label + ' conformance passed: ' + report.passedFixtureIds().length);
}
`;
}

function relativeFiles(directory) {
  return walk(directory)
    .map((file) => path.relative(directory, file).split(path.sep).join('/'))
    .sort();
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const resolved = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(resolved) : [resolved];
  });
}
