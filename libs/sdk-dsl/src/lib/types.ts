import type { BlueNode, JsonBlueValue } from '@blue-labs/language';
import type { ZodTypeAny } from 'zod';

export type BlueValueInput = BlueNode | JsonBlueValue;

export type ContractLike = BlueValueInput;

export type TypeInput = string | { blueId: string } | BlueNode | ZodTypeAny;

export type EventPatternInput = BlueValueInput | TypeInput;

export type StringMapInput =
  | Record<string, string | null>
  | ReadonlyMap<string, string | null>;

export type ChannelBindingsInput =
  | Record<string, string>
  | ReadonlyMap<string, string>;

export interface NodeObjectWriter {
  type(typeInput: TypeInput): this;
  put(key: string, value: BlueValueInput): this;
  putNode(key: string, value: BlueValueInput): this;
  putStringMap(key: string, map: StringMapInput): this;
  putExpression(key: string, expression: string): this;
}

export interface StepPayloadBuilder extends NodeObjectWriter {
  addProperty(key: string, value: BlueNode): this;
  removeProperty(key: string): this;
  setType(type: BlueNode): this;
  setItems(items: BlueNode[]): this;
  getItems(): BlueNode[] | null | undefined;
  setProperties(properties: Record<string, BlueNode>): this;
  getProperties(): Record<string, BlueNode> | null | undefined;
  clone(): BlueNode;
}

export interface ChangesetBuilderLike {
  replaceValue(path: string, value: BlueValueInput): ChangesetBuilderLike;
  replaceExpression(path: string, expression: string): ChangesetBuilderLike;
  addValue(path: string, value: BlueValueInput): ChangesetBuilderLike;
  remove(path: string): ChangesetBuilderLike;
}

export interface BootstrapOptionsBuilderLike {
  assignee(channelKey: string | null | undefined): BootstrapOptionsBuilderLike;
  defaultMessage(text: string | null | undefined): BootstrapOptionsBuilderLike;
  channelMessage(
    channelKey: string | null | undefined,
    text: string | null | undefined,
  ): BootstrapOptionsBuilderLike;
}

export interface MyOsSingleDocumentPermissionGrantRequestedOptions {
  requestId?: string | null | undefined;
  stepName?: string | null | undefined;
  grantSessionSubscriptionOnResult?: boolean | null | undefined;
  name?: string | null | undefined;
  description?: string | null | undefined;
}

export interface MyOsSubscribeToSessionRequestedOptions {
  requestId?: string | null | undefined;
  stepName?: string | null | undefined;
  events?: readonly EventPatternInput[] | null | undefined;
  name?: string | null | undefined;
  description?: string | null | undefined;
}

export interface MyOsCallOperationRequestedOptions {
  requestId?: string | null | undefined;
  stepName?: string | null | undefined;
  name?: string | null | undefined;
  description?: string | null | undefined;
}

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
