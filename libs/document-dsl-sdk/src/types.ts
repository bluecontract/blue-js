import type { z } from 'zod';

export type BluePrimitive = string | number | boolean | null;
export type BlueValue = BluePrimitive | BlueObject | BlueValue[];
export type BlueObject = { [key: string]: BlueValue };

export type BlueContract = BlueObject;
export type BlueDocument = BlueObject & {
  contracts?: Record<string, BlueContract>;
};

export type BlueTypeInput = string | { blueId: string } | z.ZodTypeAny;

export interface ChannelConfig {
  type?: BlueTypeInput;
  timelineId?: string;
  [key: string]: BlueValue | BlueTypeInput | undefined;
}

export interface SectionConfig {
  title?: string;
  summary?: string;
}

export interface OperationConfig {
  type?: string;
  channel?: string;
  description?: string;
  request?: BlueValue;
  steps?: BlueObject[];
}

export interface WorkflowConfig {
  type?: string;
  channel?: string;
  operation?: string;
  postfix?: string;
  event?: BlueValue;
  steps?: BlueObject[];
}
