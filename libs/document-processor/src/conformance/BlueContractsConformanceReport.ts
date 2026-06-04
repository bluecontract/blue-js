export const BLUE_CONTRACTS_1_0_FIXTURE_PACKAGE_IDENTITY =
  'sha256:2f197ca3bbdc41b75e772777cc48e51019754347e1bee26b5f3209b71d9bd9ca';

export const BLUE_CONTRACTS_1_0_FIXTURE_COUNT = 133;

export interface BlueContractsConformanceFailure {
  readonly fixtureId: string;
  readonly category: string;
  readonly operation: string;
  readonly message: string;
  readonly cause?: string;
  readonly classification?: string;
}

export class BlueContractsConformanceReport {
  constructor(
    readonly specVersion: string,
    readonly fixturePackageIdentity: string,
    private readonly passedIds: readonly string[],
    private readonly failed: readonly BlueContractsConformanceFailure[],
    private readonly identityMatches: boolean,
    private readonly requiredCoverage: boolean,
    private readonly exactFixtureSet: boolean,
  ) {}

  fixturePackageIdentityMatchesFixtureFiles(): boolean {
    return this.identityMatches;
  }

  hasRequiredFixtureCoverage(): boolean {
    return this.requiredCoverage;
  }

  hasExactRequiredFixtureSet(): boolean {
    return this.exactFixtureSet;
  }

  passedFixtureIds(): string[] {
    return [...this.passedIds];
  }

  failedFixtureIds(): string[] {
    return this.failed.map((failure) => failure.fixtureId);
  }

  failures(): BlueContractsConformanceFailure[] {
    return [...this.failed];
  }
}
