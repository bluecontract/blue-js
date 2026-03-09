import type { BlueNode, JsonBlueValue } from '@blue-labs/language';
import type { ZodTypeAny } from 'zod';

export type BlueValueInput = BlueNode | JsonBlueValue;

export type ContractLike = BlueValueInput;

export type TypeInput = string | { blueId: string } | BlueNode | ZodTypeAny;

export type EventPatternInput = BlueValueInput | TypeInput;

export interface AIResponseNamedEventMatcher {
  readonly namedEvent: string;
}

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

export interface PayNoteEventStepOptions {
  requestId?: string | null | undefined;
  stepName?: string | null | undefined;
  name?: string | null | undefined;
  description?: string | null | undefined;
}

export interface PayNoteAmountEventOptions extends PayNoteEventStepOptions {
  amount?: BlueValueInput | null | undefined;
}

export interface PayNoteCardTransactionEventOptions extends PayNoteEventStepOptions {
  cardTransactionDetails?: BlueValueInput | null | undefined;
}

export interface PayNoteMonitoringRequestedOptions extends PayNoteEventStepOptions {
  requestedAt?: number | null | undefined;
  targetMerchantId?: string | null | undefined;
  events?: readonly string[] | null | undefined;
}

export interface PayNoteLinkedChargeRequestedOptions extends PayNoteAmountEventOptions {
  paymentMandateDocumentId?: string | null | undefined;
  paynote?: BlueValueInput | null | undefined;
}

export interface PayNotePaymentMandateSpendAuthorizationRequestedOptions extends PayNoteEventStepOptions {
  authorizationId?: string | null | undefined;
  amountMinor?: number | null | undefined;
  currency?: string | null | undefined;
  counterpartyType?: string | null | undefined;
  counterpartyId?: string | null | undefined;
  requestingDocumentId?: string | null | undefined;
  requestingSessionId?: string | null | undefined;
  requestedAt?: string | null | undefined;
}

export interface PayNotePaymentMandateSpendSettledOptions extends PayNoteEventStepOptions {
  inResponseTo?: BlueValueInput | null | undefined;
  authorizationId?: string | null | undefined;
  settlementId?: string | null | undefined;
  status?: string | null | undefined;
  reason?: string | null | undefined;
  reservedDeltaMinor?: number | null | undefined;
  capturedDeltaMinor?: number | null | undefined;
  holdId?: string | null | undefined;
  transactionId?: string | null | undefined;
  settledAt?: string | null | undefined;
}

export interface ConversationCustomerActionDefinition {
  label?: string | null | undefined;
  variant?: string | null | undefined;
  inputTitle?: string | null | undefined;
  inputPlaceholder?: string | null | undefined;
  inputRequired?: boolean | null | undefined;
  inputSchema?: BlueValueInput | null | undefined;
}

export interface ConversationCustomerActionRequestedOptions extends PayNoteEventStepOptions {
  title?: string | null | undefined;
  message?: string | null | undefined;
  actions?: readonly ConversationCustomerActionDefinition[] | null | undefined;
}

export interface ConversationCustomerActionRespondedOptions extends PayNoteEventStepOptions {
  inResponseTo?: BlueValueInput | null | undefined;
  actionLabel?: string | null | undefined;
  input?: BlueValueInput | null | undefined;
  respondedAt?: string | null | undefined;
}

export interface ConversationDocumentBootstrapRequestOptions extends PayNoteEventStepOptions {
  bootstrapAssignee?: string | null | undefined;
  defaultMessage?: string | null | undefined;
  channelMessages?:
    | Record<string, string>
    | ReadonlyMap<string, string>
    | null
    | undefined;
}

export interface ConversationDocumentBootstrapResponseOptions extends PayNoteEventStepOptions {
  inResponseTo?: BlueValueInput | null | undefined;
}

export interface ConversationDocumentBootstrapRespondedOptions extends ConversationDocumentBootstrapResponseOptions {
  status?: string | null | undefined;
  reason?: string | null | undefined;
}

export interface ConversationDocumentBootstrapCompletedOptions extends ConversationDocumentBootstrapResponseOptions {
  documentId?: string | null | undefined;
}

export interface ConversationDocumentBootstrapFailedOptions extends ConversationDocumentBootstrapResponseOptions {
  reason?: string | null | undefined;
}

export interface PaymentMandateAllowedPayNoteInput {
  documentBlueId?: string | null | undefined;
  typeBlueId?: string | null | undefined;
}

export interface PaymentMandateCounterpartyInput {
  counterpartyType?: string | null | undefined;
  counterpartyId?: string | null | undefined;
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

export interface WorkflowBuilder<TDone> {
  channel(channelKey: string): WorkflowBuilder<TDone>;
  event(eventType: TypeInput): WorkflowBuilder<TDone>;
  event(matcher: BlueValueInput): WorkflowBuilder<TDone>;
  steps(
    customizer: (
      steps: import('./builders/steps-builder').StepsBuilder,
    ) => void,
  ): WorkflowBuilder<TDone>;
  done(): TDone;
}
