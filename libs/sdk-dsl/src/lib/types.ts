import type { BlueNode, JsonBlueValue } from '@blue-labs/language';
import type { ZodTypeAny } from 'zod';

export type BlueValueInput = BlueNode | JsonBlueValue;

export type ContractLike = BlueValueInput;

export type TypeInput = string | { blueId: string } | BlueNode | ZodTypeAny;

export interface FieldBuilder<TDone> {
  type(typeInput: TypeInput): FieldBuilder<TDone>;
  description(text: string): FieldBuilder<TDone>;
  value(value: BlueValueInput): FieldBuilder<TDone>;
  required(required: boolean): FieldBuilder<TDone>;
  minimum(value: number): FieldBuilder<TDone>;
  maximum(value: number): FieldBuilder<TDone>;
  done(): TDone;
}

export interface OperationBuilder<TDone> {
  channel(channelKey: string): OperationBuilder<TDone>;
  description(text: string): OperationBuilder<TDone>;
  requestType(typeInput: TypeInput): OperationBuilder<TDone>;
  request(requestSchema: BlueValueInput): OperationBuilder<TDone>;
  requestDescription(text: string): OperationBuilder<TDone>;
  noRequest(): OperationBuilder<TDone>;
  steps(
    customizer: (
      steps: import('./builders/steps-builder').StepsBuilder,
    ) => void,
  ): OperationBuilder<TDone>;
  done(): TDone;
}
