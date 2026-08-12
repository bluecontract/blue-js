#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { GeneratorMode } from '../lib/types';
import { generateRepository } from '../lib/generateRepository';

interface CliOptions {
  repoRoot: string;
  blueRepository: string;
  mode: GeneratorMode;
  verbose: boolean;
  json: boolean;
  failOnDiff: boolean;
  languageRegistry?: string;
  contractsRegistry?: string;
  providerBundle?: string;
}

function parseArgs(argv: string[]): CliOptions {
  const options: Partial<CliOptions> = {
    repoRoot: process.cwd(),
    blueRepository: 'BlueRepository.blue',
    verbose: false,
    json: false,
    failOnDiff: true,
  };

  const readValue = (index: number, option: string): string => {
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${option}.`);
    }
    return value;
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--repo-root':
        options.repoRoot = readValue(i, arg);
        i += 1;
        break;
      case '--blue-repository':
        options.blueRepository = readValue(i, arg);
        i += 1;
        break;
      case '--mode':
        options.mode = readValue(i, arg) as GeneratorMode;
        i += 1;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--json':
        options.json = true;
        break;
      case '--allow-diff':
        options.failOnDiff = false;
        break;
      case '--language-registry':
      case '--language-registry-manifest':
        options.languageRegistry = readValue(i, arg);
        i += 1;
        break;
      case '--contracts-registry':
      case '--contracts-registry-manifest':
        options.contractsRegistry = readValue(i, arg);
        i += 1;
        break;
      case '--provider-bundle':
        options.providerBundle = readValue(i, arg);
        i += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.mode || (options.mode !== 'check' && options.mode !== 'write')) {
    throw new Error('Missing or invalid --mode (expected "check" or "write").');
  }

  return options as CliOptions;
}

function logJson(enabled: boolean, payload: unknown) {
  if (enabled) {
    console.log(JSON.stringify(payload, null, 2));
  }
}

function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const repoRoot = path.resolve(args.repoRoot);
    const blueRepositoryPath = path.resolve(repoRoot, args.blueRepository);
    const providerBundlePath = path.resolve(
      repoRoot,
      args.providerBundle ??
        args.blueRepository.replace(/\.blue$/i, '.provider.json'),
    );

    const result = generateRepository({
      repoRoot,
      blueRepositoryPath,
      verbose: args.verbose,
      languageRegistryPath: args.languageRegistry
        ? path.resolve(repoRoot, args.languageRegistry)
        : undefined,
      contractsRegistryPath: args.contractsRegistry
        ? path.resolve(repoRoot, args.contractsRegistry)
        : undefined,
      providerBundlePath,
    });

    const fileMatches =
      result.existingYaml !== undefined && result.existingYaml === result.yaml;
    const providerFileMatches =
      result.existingProviderBundleJson !== undefined &&
      result.existingProviderBundleJson === result.providerBundleJson;

    if (args.mode === 'check') {
      if (!result.existingYaml) {
        logJson(args.json, {
          repoBlueId: result.currentRepoBlueId,
          changed: true,
          reason: 'BlueRepository.blue is missing.',
          registryPackageIdentities: result.registryPackageIdentities,
        });
        if (args.failOnDiff) {
          throw new Error(
            'BlueRepository.blue is missing. Run with --mode write to create it.',
          );
        }
        console.warn('BlueRepository.blue is missing. Run with --mode write.');
        return;
      }
      if (!fileMatches) {
        logJson(args.json, {
          repoBlueId: result.currentRepoBlueId,
          changed: true,
          reason: 'BlueRepository.blue is out of date.',
          registryPackageIdentities: result.registryPackageIdentities,
        });
        if (args.failOnDiff) {
          throw new Error(
            'BlueRepository.blue is out of date. Run with --mode write.',
          );
        }
        console.warn(
          'BlueRepository.blue is out of date. Run with --mode write.',
        );
        return;
      }
      if (!providerFileMatches) {
        logJson(args.json, {
          repoBlueId: result.currentRepoBlueId,
          changed: true,
          reason: 'Repository provider bundle is missing or out of date.',
          providerBundleIdentity: result.providerBundle.providerBundleIdentity,
          registryPackageIdentities: result.registryPackageIdentities,
        });
        if (args.failOnDiff) {
          throw new Error(
            'Repository provider bundle is missing or out of date. Run with --mode write.',
          );
        }
        console.warn(
          'Repository provider bundle is missing or out of date. Run with --mode write.',
        );
        return;
      }

      console.log('BlueRepository.blue is up to date.');
      logJson(args.json, {
        repoBlueId: result.currentRepoBlueId,
        changed: false,
        providerBundleIdentity: result.providerBundle.providerBundleIdentity,
        registryPackageIdentities: result.registryPackageIdentities,
      });
      return;
    }

    if (!result.existingYaml || result.changed) {
      fs.mkdirSync(path.dirname(blueRepositoryPath), { recursive: true });
      fs.writeFileSync(blueRepositoryPath, result.yaml, 'utf8');
      if (args.verbose) {
        console.info(
          `Wrote BlueRepository.blue with RepoBlueId ${result.currentRepoBlueId}`,
        );
      }
    } else if (!fileMatches) {
      throw new Error(
        'RepoBlueId is unchanged but BlueRepository.blue differs. Please revert manual edits or regenerate from a clean state.',
      );
    } else if (args.verbose) {
      console.info('No changes detected; BlueRepository.blue left untouched.');
    }

    if (!providerFileMatches) {
      fs.mkdirSync(path.dirname(providerBundlePath), { recursive: true });
      fs.writeFileSync(providerBundlePath, result.providerBundleJson, 'utf8');
      if (args.verbose) {
        console.info(
          `Wrote repository provider bundle ${result.providerBundle.providerBundleIdentity}`,
        );
      }
    }

    console.log(result.currentRepoBlueId);
    logJson(args.json, {
      repoBlueId: result.currentRepoBlueId,
      changed: result.changed || !fileMatches || !providerFileMatches,
      providerBundleIdentity: result.providerBundle.providerBundleIdentity,
      registryPackageIdentities: result.registryPackageIdentities,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error encountered.';
    console.error(message);
    process.exit(1);
  }
}

main();
