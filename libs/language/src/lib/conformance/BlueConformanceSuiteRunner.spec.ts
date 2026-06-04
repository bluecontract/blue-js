import { describe, expect, it } from 'vitest';

import {
  BLUE_LANGUAGE_1_0_FIXTURE_COUNT,
  loadLanguageConformanceFixtureEntries,
} from './BlueLanguageConformanceReport';
import { runLanguageConformanceSuite } from './BlueConformanceSuiteRunner';

describe('Blue Language 1.0 conformance fixtures', () => {
  it('passes all fixtures', async () => {
    const report = await runLanguageConformanceSuite();

    expect(report.failures()).toEqual([]);
    expect(report.fixturePackageIdentityMatchesFixtureFiles()).toBe(true);
    expect(report.hasRequiredFixtureCoverage()).toBe(true);
    expect(report.hasExactRequiredFixtureSet()).toBe(true);
    expect(report.passedFixtureIds()).toHaveLength(
      BLUE_LANGUAGE_1_0_FIXTURE_COUNT,
    );
    expect(report.failedFixtureIds()).toEqual([]);
  });

  it('language conformance report executes all 77 fixtures', async () => {
    const report = await runLanguageConformanceSuite();

    expect(report.passedFixtureIds()).toHaveLength(77);
    expect(report.passedFixtureIds().sort()).toEqual(
      loadLanguageConformanceFixtureEntries()
        .map((entry) => entry.id)
        .sort(),
    );
  });

  it('report fails when a fixture expected value is intentionally wrong', async () => {
    const report = await runLanguageConformanceSuite({
      mutateFixture: (entry, spec) =>
        entry.id === 'B_root_scalar'
          ? {
              ...spec,
              expectedNodeBlueId: 'intentionally-wrong',
            }
          : spec,
    });

    expect(report.failedFixtureIds()).toEqual(['B_root_scalar']);
  });
});
