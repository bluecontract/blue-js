import { describe, expect, it } from 'vitest';

import {
  BEX_1_0_FIXTURE_COUNT,
  loadBexConformanceFixtureEntries,
  runBexConformanceSuite,
} from './BexConformanceSuiteRunner';

describe('Java BEX rich fixtures', () => {
  it('passes all fixtures', async () => {
    const report = await runBexConformanceSuite();

    expect(report.failures()).toEqual([]);
    expect(report.fixturePackageIdentityMatchesFixtureFiles()).toBe(true);
    expect(report.hasRequiredFixtureCoverage()).toBe(true);
    expect(report.hasExactRequiredFixtureSet()).toBe(true);
    expect(report.passedFixtureIds()).toHaveLength(BEX_1_0_FIXTURE_COUNT);
    expect(report.failedFixtureIds()).toEqual([]);
  });

  it('bex conformance report executes all 159 fixtures', async () => {
    const report = await runBexConformanceSuite();

    expect(report.passedFixtureIds()).toHaveLength(159);
    expect(report.passedFixtureIds().sort()).toEqual(
      loadBexConformanceFixtureEntries()
        .map((entry) => entry.id)
        .sort(),
    );
  });

  it('report fails when a fixture expected value is intentionally wrong', async () => {
    const report = await runBexConformanceSuite({
      mutateFixture: (entry, fixture) =>
        entry.id === 'BEX-CURRENT-001'
          ? {
              ...fixture,
              expectation: {
                ...fixture.expectation,
                resultSimple: 'intentionally-wrong',
              },
            }
          : fixture,
    });

    expect(report.failedFixtureIds()).toContain('BEX-CURRENT-001');
    expect(report.failures()[0]?.message).toContain('intentionally-wrong');
  });
});
