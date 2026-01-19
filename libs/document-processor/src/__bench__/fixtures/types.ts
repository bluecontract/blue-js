export type BenchFixture = {
  name: string;
  document: Record<string, unknown>;
  events: ReadonlyArray<Record<string, unknown>>;
};
