export interface GasConsumption {
  readonly reason?: string;
  readonly amount: number;
}

export class GasMeter {
  private consumed = 0;

  constructor(private readonly budget?: number) {}

  consume(amount: number, reason?: string): void {
    if (amount <= 0) return;
    this.consumed += amount;
    if (this.budget !== undefined && this.consumed > this.budget) {
      const exceededBy = this.consumed - this.budget;
      throw new GasBudgetExceededError(
        this.budget,
        this.consumed,
        exceededBy,
        reason
      );
    }
  }

  getBudget(): number | undefined {
    return this.budget;
  }

  getConsumed(): number {
    return this.consumed;
  }

  getRemaining(): number | undefined {
    if (this.budget === undefined) return undefined;
    return Math.max(0, this.budget - this.consumed);
  }
}

export class GasBudgetExceededError extends Error {
  constructor(
    readonly budget: number,
    readonly consumed: number,
    readonly exceededBy: number,
    readonly reason?: string
  ) {
    super(
      `Gas budget of ${budget} exceeded by ${exceededBy}${
        reason ? ` while processing ${reason}` : ''
      }`
    );
    this.name = 'GasBudgetExceededError';
  }
}
