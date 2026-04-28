export type BlueContextRepositories = Record<string, string> | string;

export interface BlueContext {
  repositories: BlueContextRepositories;
  fallbackToCurrentInlineDefinitions?: boolean;
}

export type NodeToJsonFormat = 'official' | 'simple' | 'original';

export interface NodeToJsonOptions {
  format?: NodeToJsonFormat;
  blueContext?: BlueContext;
}
