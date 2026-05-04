#!/usr/bin/env node
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const workspaceRoot = path.resolve(repoRoot, '..');
const defaultBlueQuickjsRoot = path.join(
  workspaceRoot,
  'clean_repos',
  'blue-quickjs',
);
const backupRoot = path.join(
  repoRoot,
  'node_modules',
  '.local-package-shim-backups',
);

const packageMap = new Map([
  ['@blue-quickjs/abi-manifest', 'libs/abi-manifest'],
  ['@blue-quickjs/blue-documents', 'libs/blue-documents'],
  ['@blue-quickjs/deterministic-builder', 'libs/deterministic-builder'],
  ['@blue-quickjs/deterministic-bundler', 'libs/deterministic-bundler'],
  ['@blue-quickjs/dv', 'libs/dv'],
  ['@blue-quickjs/execution-profiles', 'libs/execution-profiles'],
  ['@blue-quickjs/quickjs-runtime', 'libs/quickjs-runtime'],
  ['@blue-quickjs/quickjs-wasm', 'libs/quickjs-wasm'],
  ['@blue-quickjs/quickjs-wasm-constants', 'libs/quickjs-wasm-constants'],
]);

const args = parseArgs(process.argv.slice(2));
const blueQuickjsRoot = path.resolve(
  args.root ?? process.env.BLUE_QUICKJS_LOCAL_ROOT ?? defaultBlueQuickjsRoot,
);

if (args.help) {
  printHelp();
  process.exit(0);
}

if (args.restore) {
  restorePackages();
  process.exit(0);
}

const problems = validateLocalPackages(blueQuickjsRoot);
if (args.check) {
  for (const problem of problems) {
    console.error(problem);
  }
  process.exit(problems.length === 0 ? 0 : 1);
}

if (problems.length > 0) {
  for (const problem of problems) {
    console.error(problem);
  }
  console.error('');
  console.error(
    'Local package shim aborted. Build/install the local package tree first, or use --check to inspect only.',
  );
  process.exit(1);
}

if (!args.force) {
  console.error('Refusing to replace installed packages without --force.');
  console.error(
    'Run with --check first, then rerun with --force to create shims.',
  );
  process.exit(1);
}

shimPackages(blueQuickjsRoot);

function parseArgs(rawArgs) {
  const parsed = {
    root: undefined,
    force: false,
    check: false,
    restore: false,
    help: false,
  };
  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (arg === '--root') {
      parsed.root = rawArgs[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--force') {
      parsed.force = true;
      continue;
    }
    if (arg === '--check') {
      parsed.check = true;
      continue;
    }
    if (arg === '--restore') {
      parsed.restore = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function validateLocalPackages(root) {
  const problems = [];
  if (!existsSync(root)) {
    problems.push(`Missing local blue-quickjs root: ${root}`);
    return problems;
  }

  for (const [name, relativePackagePath] of packageMap) {
    const packageDir = path.join(root, relativePackagePath);
    const packageJsonPath = path.join(packageDir, 'package.json');
    const distIndexPath = path.join(packageDir, 'dist', 'index.js');
    const distTypesPath = path.join(packageDir, 'dist', 'index.d.ts');
    if (!existsSync(packageJsonPath)) {
      problems.push(`Missing package.json for ${name}: ${packageJsonPath}`);
      continue;
    }
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    if (packageJson.name !== name) {
      problems.push(
        `Package name mismatch for ${name}: ${packageJsonPath} declares ${String(packageJson.name)}`,
      );
    }
    if (!existsSync(distIndexPath)) {
      problems.push(`Missing built JS for ${name}: ${distIndexPath}`);
    }
    if (!existsSync(distTypesPath)) {
      problems.push(`Missing built types for ${name}: ${distTypesPath}`);
    }
  }
  return problems;
}

function shimPackages(root) {
  const scopeDir = path.join(repoRoot, 'node_modules', '@blue-quickjs');
  mkdirSync(scopeDir, { recursive: true });
  mkdirSync(backupRoot, { recursive: true });

  for (const [name, relativePackagePath] of packageMap) {
    const packageDir = path.join(root, relativePackagePath);
    const targetPath = packageTargetPath(name);
    const backupPath = backupTargetPath(name);

    if (existsSync(targetPath)) {
      const stat = lstatSync(targetPath);
      if (stat.isSymbolicLink()) {
        rmSync(targetPath);
      } else if (!existsSync(backupPath)) {
        renameSync(targetPath, backupPath);
      } else {
        rmSync(targetPath, { recursive: true, force: true });
      }
    }

    symlinkSync(packageDir, targetPath, 'dir');
    console.log(`${name} -> ${path.relative(repoRoot, packageDir)}`);
  }
}

function restorePackages() {
  for (const name of packageMap.keys()) {
    const targetPath = packageTargetPath(name);
    const backupPath = backupTargetPath(name);
    if (existsSync(targetPath) && lstatSync(targetPath).isSymbolicLink()) {
      rmSync(targetPath);
    }
    if (existsSync(backupPath) && !existsSync(targetPath)) {
      renameSync(backupPath, targetPath);
      console.log(`restored ${name}`);
    }
  }
}

function packageTargetPath(packageName) {
  const [, unscoped] = packageName.split('/');
  return path.join(repoRoot, 'node_modules', '@blue-quickjs', unscoped);
}

function backupTargetPath(packageName) {
  return path.join(backupRoot, packageName.replace('/', '__'));
}

function printHelp() {
  console.log(`Usage:
  node scripts/shim-local-blue-quickjs-packages.mjs --check [--root <path>]
  node scripts/shim-local-blue-quickjs-packages.mjs --force [--root <path>]
  node scripts/shim-local-blue-quickjs-packages.mjs --restore

Default root:
  ${defaultBlueQuickjsRoot}

The local packages must be built first because their package.json files point at dist/index.js and dist/index.d.ts.
`);
}
