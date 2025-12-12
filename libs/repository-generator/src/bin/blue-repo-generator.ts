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
}

function parseArgs(argv: string[]): CliOptions {
  const options: Partial<CliOptions> = {
    repoRoot: process.cwd(),
    blueRepository: 'BlueRepository.blue',
    verbose: false,
    json: false,
    failOnDiff: true,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--repo-root':
        options.repoRoot = argv[++i];
        break;
      case '--blue-repository':
        options.blueRepository = argv[++i];
        break;
      case '--mode':
        options.mode = argv[++i] as GeneratorMode;
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

    const result = generateRepository({
      repoRoot,
      blueRepositoryPath,
      verbose: args.verbose,
    });

    const fileMatches =
      result.existingYaml !== undefined && result.existingYaml === result.yaml;

    if (args.mode === 'check') {
      if (!result.existingYaml) {
        throw new Error(
          'BlueRepository.blue is missing. Run with --mode write to create it.',
        );
      }
      if (!fileMatches) {
        logJson(args.json, {
          repoBlueId: result.currentRepoBlueId,
          changed: true,
          reason: 'BlueRepository.blue is out of date.',
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

      console.log('BlueRepository.blue is up to date.');
      logJson(args.json, {
        repoBlueId: result.currentRepoBlueId,
        changed: false,
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

    console.log(result.currentRepoBlueId);
    logJson(args.json, {
      repoBlueId: result.currentRepoBlueId,
      changed: result.changed || !fileMatches,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error encountered.';
    console.error(message);
    process.exit(1);
  }
}

main();
