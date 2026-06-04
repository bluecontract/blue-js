export interface BexGasScheduleValues {
  expressionBase: number;
  statementBase: number;
  documentRead: number;
  eventRead: number;
  stepsRead: number;
  currentContractRead: number;
  varRead: number;
  resultValueRead: number;
  pointerGetBase: number;
  pointerSetBase: number;
  objectSetBase: number;
  appendChangeBase: number;
  appendEventBase: number;
  forEachItem: number;
  functionCall: number;
}

export class BexGasSchedule {
  public static defaults(): BexGasSchedule {
    return new BexGasSchedule({
      expressionBase: 1,
      statementBase: 1,
      documentRead: 2,
      eventRead: 1,
      stepsRead: 1,
      currentContractRead: 1,
      varRead: 1,
      resultValueRead: 2,
      pointerGetBase: 1,
      pointerSetBase: 3,
      objectSetBase: 2,
      appendChangeBase: 5,
      appendEventBase: 5,
      forEachItem: 1,
      functionCall: 2,
    });
  }

  constructor(public readonly values: BexGasScheduleValues) {}

  public with(overrides: Partial<BexGasScheduleValues>): BexGasSchedule {
    return new BexGasSchedule({ ...this.values, ...overrides });
  }
}
