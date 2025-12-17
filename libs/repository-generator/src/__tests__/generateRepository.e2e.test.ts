import { describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { generateRepository } from '../lib/generateRepository';

const ERRORS = {
  stableDependsOnDev: /depends on a dev type/,
  breakingStable: /Breaking change detected in stable type/,
  dualDevStable: /both stable and dev definitions/,
};

const FIXTURES_ROOT = path.resolve(__dirname, './e2e-fixtures');

const baseFixture = path.join(FIXTURES_ROOT, 'base');
const nonBreakingFixture = path.join(FIXTURES_ROOT, 'non-breaking');
const devChangeFixture = path.join(FIXTURES_ROOT, 'dev-change');
const BLUE_REPOSITORY = 'BlueRepository.blue';

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'blue-repo-e2e-'));

const copyDir = (src: string, dest: string) => {
  fs.cpSync(src, dest, { recursive: true });
};

const readYaml = (root: string) =>
  fs.readFileSync(path.join(root, BLUE_REPOSITORY), 'utf8');

describe('repository-generator e2e (fixtures)', () => {
  it('marks missing BlueRepository.blue as changed (library layer)', () => {
    const repoRoot = tmpDir();
    copyDir(baseFixture, repoRoot);
    fs.rmSync(path.join(repoRoot, BLUE_REPOSITORY));

    const checkResult = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });

    expect(checkResult.existingYaml).toBeUndefined();
    expect(checkResult.changed).toBe(true);

    const writeResult = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });
    expect(writeResult.changed).toBe(true);
    const blueRepoPath = path.join(repoRoot, BLUE_REPOSITORY);
    if (!fs.existsSync(blueRepoPath)) {
      fs.mkdirSync(repoRoot, { recursive: true });
      fs.writeFileSync(blueRepoPath, writeResult.yaml, 'utf8');
    }
    const secondCheck = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });
    expect(fs.existsSync(blueRepoPath)).toBe(true);
    expect(secondCheck.existingYaml).toBeDefined();
  });

  it('passes check when snapshot matches', () => {
    const repoRoot = tmpDir();
    copyDir(baseFixture, repoRoot);

    const checkResult = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });

    expect(checkResult.existingYaml).toBeDefined();
    expect(checkResult.yaml).toEqual(checkResult.existingYaml);
    expect(checkResult.changed).toBe(false);

    const writeResult = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });
    expect(writeResult.changed).toBe(false);
    expect(writeResult.yaml).toEqual(checkResult.yaml);
  });

  it('detects non-breaking additions and writes expected snapshot', () => {
    const repoRoot = tmpDir();
    copyDir(nonBreakingFixture, repoRoot);
    // overwrite with outdated snapshot to force diff
    const baseYaml = readYaml(baseFixture);
    fs.writeFileSync(path.join(repoRoot, BLUE_REPOSITORY), baseYaml, 'utf8');

    const checkResult = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });
    expect(checkResult.existingYaml).toBeDefined();
    expect(checkResult.yaml).not.toEqual(checkResult.existingYaml);

    const writeResult = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });
    const secondPass = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });
    expect(writeResult.yaml).toEqual(secondPass.yaml);
  });

  it('rejects breaking changes to stable types in both check and write', () => {
    const repoRoot = tmpDir();
    copyDir(baseFixture, repoRoot);
    const docPath = path.join(repoRoot, 'App', 'Document.blue');
    const altered = fs
      .readFileSync(docPath, 'utf8')
      .replace(/\nstatus:[\s\S]*/m, ''); // remove required field to force breaking change
    fs.writeFileSync(docPath, altered, 'utf8');

    expect(() =>
      generateRepository({
        repoRoot,
        blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
      }),
    ).toThrow(ERRORS.breakingStable);

    expect(() =>
      generateRepository({
        repoRoot,
        blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
      }),
    ).toThrow(ERRORS.breakingStable);
  });

  it('rejects dual dev + stable definitions', () => {
    const repoRoot = tmpDir();
    copyDir(baseFixture, repoRoot);
    fs.copyFileSync(
      path.join(repoRoot, 'App', 'Draft.dev.blue'),
      path.join(repoRoot, 'App', 'Draft.blue'),
    );

    expect(() =>
      generateRepository({
        repoRoot,
        blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
      }),
    ).toThrow(ERRORS.dualDevStable);

    expect(() =>
      generateRepository({
        repoRoot,
        blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
      }),
    ).toThrow(ERRORS.dualDevStable);
  });

  it('rejects stable types depending on dev types', () => {
    const repoRoot = tmpDir();
    copyDir(baseFixture, repoRoot);
    const consumer = `name: Consumer\nref:\n  type: App/Draft\n`;
    fs.writeFileSync(path.join(repoRoot, 'App', 'Consumer.blue'), consumer);

    expect(() =>
      generateRepository({
        repoRoot,
        blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
      }),
    ).toThrow(ERRORS.stableDependsOnDev);

    expect(() =>
      generateRepository({
        repoRoot,
        blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
      }),
    ).toThrow(ERRORS.stableDependsOnDev);
  });

  it('allows breaking changes in dev types and writes snapshot', () => {
    const repoRoot = tmpDir();
    copyDir(devChangeFixture, repoRoot);
    // seed with outdated snapshot from base
    const baseYaml = readYaml(baseFixture);
    fs.writeFileSync(path.join(repoRoot, BLUE_REPOSITORY), baseYaml, 'utf8');

    const checkResultInitial = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });
    expect(checkResultInitial.changed).toBe(true);

    const writeResult = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });
    const checkResult = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });
    expect(writeResult.yaml).toEqual(checkResult.yaml);
  });
});
