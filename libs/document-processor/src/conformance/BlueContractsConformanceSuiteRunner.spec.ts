import { describe, expect, it } from 'vitest';

import { BLUE_CONTRACTS_1_0_FIXTURE_COUNT } from './BlueContractsConformanceReport.js';
import {
  loadContractsConformanceFixtureEntries,
  runContractsConformanceSuite,
} from './BlueContractsConformanceSuiteRunner.js';

const CONFORMANCE_SUITE_TIMEOUT_MS = 30_000;

describe('Blue Contracts 1.0 conformance fixtures', () => {
  it(
    'passes all fixtures',
    async () => {
      const report = await runContractsConformanceSuite();

      expect(report.failures()).toEqual([]);
      expect(report.fixturePackageIdentityMatchesFixtureFiles()).toBe(true);
      expect(report.hasRequiredFixtureCoverage()).toBe(true);
      expect(report.hasExactRequiredFixtureSet()).toBe(true);
      expect(report.passedFixtureIds()).toHaveLength(
        BLUE_CONTRACTS_1_0_FIXTURE_COUNT,
      );
      expect(report.failedFixtureIds()).toEqual([]);
    },
    CONFORMANCE_SUITE_TIMEOUT_MS,
  );

  it(
    'contracts conformance report executes all 133 fixtures',
    async () => {
      const report = await runContractsConformanceSuite();

      expect(report.passedFixtureIds()).toHaveLength(133);
      expect(report.passedFixtureIds().sort()).toEqual(
        loadContractsConformanceFixtureEntries()
          .map((entry) => entry.id)
          .sort(),
      );
    },
    CONFORMANCE_SUITE_TIMEOUT_MS,
  );

  it(
    'report fails when a fixture expected value is intentionally wrong',
    async () => {
      const report = await runContractsConformanceSuite({
        mutateFixture: (entry, spec) =>
          entry.id === 'T001_registry_runtime_type_blueids'
            ? {
                ...spec,
                expectedRuntimeBlueIds: {
                  ...(spec.expectedRuntimeBlueIds as Record<string, unknown>),
                  CONTRACT: 'intentionally-wrong',
                },
              }
            : spec,
      });

      expect(report.failedFixtureIds()).toEqual([
        'T001_registry_runtime_type_blueids',
      ]);
    },
    CONFORMANCE_SUITE_TIMEOUT_MS,
  );
});
