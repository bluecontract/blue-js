import { BlueNode } from '@blue-labs/language';
import type { ZodTypeAny } from 'zod';

import type {
  BlueValueInput,
  BootstrapOptionsBuilderLike,
  ChangesetBuilderLike,
  ConversationCustomerActionDefinition,
  ConversationCustomerActionRespondedOptions,
  ConversationCustomerActionRequestedOptions,
  ConversationDocumentBootstrapCompletedOptions,
  ConversationDocumentBootstrapFailedOptions,
  ConversationDocumentBootstrapRequestOptions,
  ConversationDocumentBootstrapRespondedOptions,
  EventPatternInput,
  MyOsCallOperationRequestedOptions,
  MyOsSingleDocumentPermissionGrantRequestedOptions,
  MyOsSubscribeToSessionRequestedOptions,
  PayNoteAmountEventOptions,
  PayNoteCardTransactionEventOptions,
  PayNoteLinkedChargeRequestedOptions,
  PayNoteMonitoringRequestedOptions,
  PayNotePaymentMandateSpendAuthorizationRequestedOptions,
  PayNotePaymentMandateSpendSettledOptions,
  StepPayloadBuilder,
  TypeInput,
} from '../types';
import { BootstrapOptionsBuilder } from '../internal/bootstrap-options-builder';
import { ChangesetBuilder } from '../internal/changeset-builder';
import { isBlank, wrapExpression } from '../internal/expression';
import {
  createLinkedDocumentsPermissionSet,
  EMPTY_INTERACTION_CONFIG_REGISTRY,
} from '../internal/interactions';
import type {
  AccessConfig,
  AIIntegrationConfig,
  AINamedEventExpectation,
  AgencyConfig,
  InteractionConfigRegistry,
  LinkedAccessConfig,
} from '../internal/interactions';
import { NodeObjectBuilder } from '../internal/node-object-builder';
import { assertRepositoryTypeAliasAvailable } from '../internal/runtime-type-support';
import { resolveTypeInput } from '../internal/type-input';
import { toBlueNode } from '../internal/value-to-node';

type WorkerSessionBindingInput =
  | Record<string, BlueValueInput>
  | ReadonlyMap<string, BlueValueInput>;

type WorkerSessionOptionsCustomizer =
  | ((options: AgencySessionOptionsBuilder) => void)
  | undefined;

type SimpleStepOptions = {
  readonly stepName?: string | null | undefined;
  readonly name?: string | null | undefined;
  readonly description?: string | null | undefined;
};

type RevokeRequestOptions = SimpleStepOptions & {
  readonly reason?: string | null | undefined;
};

type PaymentStepCustomizer = (payload: PaymentRequestPayloadBuilder) => void;

export class StepsBuilder {
  private readonly steps: BlueNode[] = [];

  constructor(
    private readonly interactionConfigs: InteractionConfigRegistry = EMPTY_INTERACTION_CONFIG_REGISTRY,
  ) {}

  jsRaw(name: string, code: string): this {
    const step = new BlueNode()
      .setName(requireNonEmpty(name, 'step name'))
      .setType(resolveTypeInput('Conversation/JavaScript Code'));
    step.addProperty('code', toBlueNode(code));
    this.steps.push(step);
    return this;
  }

  updateDocument(
    name: string,
    customizer: (changeset: ChangesetBuilderLike) => void,
  ): this {
    if (typeof customizer !== 'function') {
      throw new Error('changeset customizer is required');
    }

    const changeset = new ChangesetBuilder();
    customizer(changeset);
    return this.addUpdateDocumentStep(
      requireNonEmpty(name, 'step name'),
      new BlueNode().setItems(changeset.build()),
    );
  }

  updateDocumentFromExpression(name: string, expression: string): this {
    return this.addUpdateDocumentStep(
      requireNonEmpty(name, 'step name'),
      toBlueNode(wrapExpression(expression)),
    );
  }

  replaceValue(name: string, path: string, value: BlueValueInput): this {
    return this.updateDocument(name, (changeset) =>
      changeset.replaceValue(path, value),
    );
  }

  replaceExpression(name: string, path: string, expression: string): this {
    return this.updateDocument(name, (changeset) =>
      changeset.replaceExpression(path, expression),
    );
  }

  triggerEvent(name: string, eventNode: BlueNode): this {
    const step = new BlueNode()
      .setName(requireNonEmpty(name, 'step name'))
      .setType(resolveTypeInput('Conversation/Trigger Event'));
    step.addProperty('event', toBlueNode(eventNode));
    this.steps.push(step);
    return this;
  }

  emit(name: string, event: BlueValueInput): this {
    return this.triggerEvent(name, toBlueNode(event));
  }

  emitType(
    name: string,
    typeInput: TypeInput,
    payloadCustomizer?: (eventNode: StepPayloadBuilder) => void,
  ): this {
    const eventNode = NodeObjectBuilder.create().type(typeInput);
    payloadCustomizer?.(eventNode);
    return this.triggerEvent(name, eventNode.build());
  }

  namedEvent(name: string, eventName: string): this;
  namedEvent(
    name: string,
    eventName: string,
    payloadCustomizer: (payload: StepPayloadBuilder) => void,
  ): this;
  namedEvent(
    name: string,
    eventName: string,
    payloadCustomizer?: (payload: StepPayloadBuilder) => void,
  ): this {
    if (isBlank(eventName)) {
      throw new Error('eventName cannot be blank');
    }

    const eventNode = NodeObjectBuilder.create()
      .type('Common/Named Event')
      .put('name', eventName.trim());

    if (payloadCustomizer) {
      const payload = NodeObjectBuilder.create();
      payloadCustomizer(payload);
      const payloadNode = payload.build();
      if (hasMeaningfulContent(payloadNode)) {
        eventNode.putNode('payload', payloadNode);
      }
    }

    return this.triggerEvent(name, eventNode.build());
  }

  bootstrapDocument(
    stepName: string,
    documentNode: BlueValueInput,
    channelBindings: Record<string, string> | ReadonlyMap<string, string>,
  ): this;
  bootstrapDocument(
    stepName: string,
    documentNode: BlueValueInput,
    channelBindings: Record<string, string> | ReadonlyMap<string, string>,
    optionsCustomizer: (options: BootstrapOptionsBuilderLike) => void,
  ): this;
  bootstrapDocument(
    stepName: string,
    documentNode: BlueValueInput,
    channelBindings: Record<string, string> | ReadonlyMap<string, string>,
    optionsCustomizer?: (options: BootstrapOptionsBuilderLike) => void,
  ): this {
    const eventNode = NodeObjectBuilder.create()
      .type('Conversation/Document Bootstrap Requested')
      .putNode('document', documentNode)
      .putStringMap('channelBindings', channelBindings);

    applyBootstrapOptions(eventNode, optionsCustomizer);
    return this.triggerEvent(stepName, eventNode.build());
  }

  bootstrapDocumentExpr(
    stepName: string,
    documentExpression: string,
    channelBindings: Record<string, string> | ReadonlyMap<string, string>,
    optionsCustomizer?: (options: BootstrapOptionsBuilderLike) => void,
  ): this {
    if (isBlank(documentExpression)) {
      throw new Error('documentExpression cannot be blank');
    }

    const eventNode = NodeObjectBuilder.create()
      .type('Conversation/Document Bootstrap Requested')
      .putExpression('document', documentExpression)
      .putStringMap('channelBindings', channelBindings);

    applyBootstrapOptions(eventNode, optionsCustomizer);
    return this.triggerEvent(stepName, eventNode.build());
  }

  ext<TExtension>(
    extensionFactory: (steps: StepsBuilder) => TExtension,
  ): TExtension {
    if (extensionFactory == null) {
      throw new Error('extensionFactory cannot be null');
    }

    const extension = extensionFactory(this);
    if (extension == null) {
      throw new Error('extensionFactory cannot return null');
    }

    return extension;
  }

  myOs(): MyOsSteps {
    return this.ext((steps) => new MyOsSteps(steps));
  }

  paynote(): PayNoteSteps {
    return this.ext((steps) => new PayNoteSteps(steps));
  }

  conversation(): ConversationSteps {
    return this.ext((steps) => new ConversationSteps(steps));
  }

  ai(aiName: string): AISteps {
    return new AISteps(this, this.requireAiIntegration(aiName));
  }

  triggerPayment(
    paymentEventType: TypeInput,
    payloadCustomizer: PaymentStepCustomizer,
  ): this;
  triggerPayment(
    stepName: string,
    paymentEventType: TypeInput,
    payloadCustomizer: PaymentStepCustomizer,
  ): this;
  triggerPayment(
    stepNameOrType: string | TypeInput,
    typeOrCustomizer: TypeInput | PaymentStepCustomizer,
    maybeCustomizer?: PaymentStepCustomizer,
  ): this {
    const stepName =
      typeof maybeCustomizer === 'function'
        ? requireNonEmpty(stepNameOrType as string, 'step name')
        : 'TriggerPayment';
    const paymentEventType =
      typeof maybeCustomizer === 'function'
        ? (typeOrCustomizer as TypeInput)
        : (stepNameOrType as TypeInput);
    const payloadCustomizer =
      typeof maybeCustomizer === 'function'
        ? maybeCustomizer
        : (typeOrCustomizer as PaymentStepCustomizer);

    return this.emitPaymentRequest(
      'triggerPayment',
      stepName,
      paymentEventType,
      payloadCustomizer,
    );
  }

  requestBackwardPayment(payloadCustomizer: PaymentStepCustomizer): this;
  requestBackwardPayment(
    stepName: string,
    payloadCustomizer: PaymentStepCustomizer,
  ): this;
  requestBackwardPayment(
    stepNameOrCustomizer: string | PaymentStepCustomizer,
    maybeCustomizer?: PaymentStepCustomizer,
  ): this {
    const stepName =
      typeof stepNameOrCustomizer === 'function'
        ? 'RequestBackwardPayment'
        : requireNonEmpty(stepNameOrCustomizer, 'step name');
    const payloadCustomizer =
      typeof stepNameOrCustomizer === 'function'
        ? stepNameOrCustomizer
        : maybeCustomizer;

    assertRepositoryTypeAliasAvailable(
      'PayNote/Backward Payment Requested',
      'requestBackwardPayment',
    );

    return this.emitPaymentRequest(
      'requestBackwardPayment',
      stepName,
      'PayNote/Backward Payment Requested',
      payloadCustomizer,
    );
  }

  askAI(aiName: string, askCustomizer: (ask: AskAIBuilder) => void): this;
  askAI(
    aiName: string,
    stepName: string,
    askCustomizer: (ask: AskAIBuilder) => void,
  ): this;
  askAI(
    aiName: string,
    stepNameOrCustomizer: string | ((ask: AskAIBuilder) => void),
    maybeCustomizer?: (ask: AskAIBuilder) => void,
  ): this {
    const integration = this.requireAiIntegration(aiName);
    const stepName =
      typeof stepNameOrCustomizer === 'function'
        ? 'AskAI'
        : requireNonEmpty(stepNameOrCustomizer, 'step name');
    const askCustomizer =
      typeof stepNameOrCustomizer === 'function'
        ? stepNameOrCustomizer
        : maybeCustomizer;

    if (typeof askCustomizer !== 'function') {
      throw new Error('ask customizer is required');
    }

    const ask = new AskAIBuilder(this, integration, stepName);
    askCustomizer(ask);
    return ask.build() as this;
  }

  access(accessName: string): AccessSteps {
    const normalized = requireNonEmpty(accessName, 'access name');
    const config = this.interactionConfigs.accessConfigs.get(normalized);
    if (!config) {
      throw new Error(
        `Unknown access: '${normalized}'. Define it with .access("${normalized}")...done().`,
      );
    }
    return new AccessSteps(this, config);
  }

  accessLinked(linkedAccessName: string): LinkedAccessSteps {
    const normalized = requireNonEmpty(linkedAccessName, 'linked access name');
    const config = this.interactionConfigs.linkedAccessConfigs.get(normalized);
    if (!config) {
      throw new Error(
        `Unknown linked access: '${normalized}'. Define it with .accessLinked("${normalized}")...done().`,
      );
    }
    return new LinkedAccessSteps(this, config);
  }

  viaAgency(agencyName: string): AgencySteps {
    const normalized = requireNonEmpty(agencyName, 'agency name');
    const config = this.interactionConfigs.agencyConfigs.get(normalized);
    if (!config) {
      throw new Error(
        `Unknown agency: '${normalized}'. Define it with .agency("${normalized}")...done().`,
      );
    }
    return new AgencySteps(this, config);
  }

  raw(stepNode: BlueNode): this {
    this.steps.push(toBlueNode(stepNode));
    return this;
  }

  build(): BlueNode[] {
    return this.steps.map((step) => step.clone());
  }

  private addUpdateDocumentStep(name: string, changesetNode: BlueNode): this {
    const step = new BlueNode()
      .setName(name)
      .setType(resolveTypeInput('Conversation/Update Document'));
    step.addProperty('changeset', changesetNode);
    this.steps.push(step);
    return this;
  }

  private requireAiIntegration(aiName: string): AIIntegrationConfig {
    const normalized = requireNonEmpty(aiName, 'ai name');
    const config = this.interactionConfigs.aiConfigs.get(normalized);
    if (!config) {
      throw new Error(
        `Unknown AI integration: '${normalized}'. Define it with .ai("${normalized}")...done().`,
      );
    }
    return config;
  }

  private emitPaymentRequest(
    context: string,
    stepName: string,
    paymentEventType: TypeInput,
    payloadCustomizer: PaymentStepCustomizer | undefined,
  ): this {
    if (typeof payloadCustomizer !== 'function') {
      throw new Error(`${context} requires a payload customizer`);
    }

    const payload = new PaymentRequestPayloadBuilder();
    payloadCustomizer(payload);

    const processor = payload.processorName();
    if (!processor) {
      throw new Error('triggerPayment requires non-empty processor field');
    }

    const eventNode = payload.build().clone();
    eventNode.setType(resolveTypeInput(paymentEventType));
    return this.triggerEvent(stepName, eventNode);
  }
}

abstract class PaymentRailBuilderBase<TParent> {
  constructor(protected readonly parent: TParent) {}

  done(): TParent {
    return this.parent;
  }
}

export class AchRailBuilder<
  TParent extends PaymentRequestPayloadBuilder,
> extends PaymentRailBuilderBase<TParent> {
  routingNumber(value: BlueValueInput): this {
    this.parent.putCustom('routingNumber', value);
    return this;
  }

  accountNumber(value: BlueValueInput): this {
    this.parent.putCustom('accountNumber', value);
    return this;
  }

  accountType(value: BlueValueInput): this {
    this.parent.putCustom('accountType', value);
    return this;
  }

  network(value: BlueValueInput): this {
    this.parent.putCustom('network', value);
    return this;
  }

  companyEntryDescription(value: BlueValueInput): this {
    this.parent.putCustom('companyEntryDescription', value);
    return this;
  }
}

export class SepaRailBuilder<
  TParent extends PaymentRequestPayloadBuilder,
> extends PaymentRailBuilderBase<TParent> {
  ibanFrom(value: BlueValueInput): this {
    this.parent.putCustom('ibanFrom', value);
    return this;
  }

  ibanTo(value: BlueValueInput): this {
    this.parent.putCustom('ibanTo', value);
    return this;
  }

  bicTo(value: BlueValueInput): this {
    this.parent.putCustom('bicTo', value);
    return this;
  }

  remittanceInformation(value: BlueValueInput): this {
    this.parent.putCustom('remittanceInformation', value);
    return this;
  }
}

export class WireRailBuilder<
  TParent extends PaymentRequestPayloadBuilder,
> extends PaymentRailBuilderBase<TParent> {
  bankSwift(value: BlueValueInput): this {
    this.parent.putCustom('bankSwift', value);
    return this;
  }

  bankName(value: BlueValueInput): this {
    this.parent.putCustom('bankName', value);
    return this;
  }

  accountNumber(value: BlueValueInput): this {
    this.parent.putCustom('accountNumber', value);
    return this;
  }

  beneficiaryName(value: BlueValueInput): this {
    this.parent.putCustom('beneficiaryName', value);
    return this;
  }

  beneficiaryAddress(value: BlueValueInput): this {
    this.parent.putCustom('beneficiaryAddress', value);
    return this;
  }
}

export class CardRailBuilder<
  TParent extends PaymentRequestPayloadBuilder,
> extends PaymentRailBuilderBase<TParent> {
  cardOnFileRef(value: BlueValueInput): this {
    this.parent.putCustom('cardOnFileRef', value);
    return this;
  }

  merchantDescriptor(value: BlueValueInput): this {
    this.parent.putCustom('merchantDescriptor', value);
    return this;
  }
}

export class TokenizedCardRailBuilder<
  TParent extends PaymentRequestPayloadBuilder,
> extends PaymentRailBuilderBase<TParent> {
  networkToken(value: BlueValueInput): this {
    this.parent.putCustom('networkToken', value);
    return this;
  }

  tokenProvider(value: BlueValueInput): this {
    this.parent.putCustom('tokenProvider', value);
    return this;
  }

  cryptogram(value: BlueValueInput): this {
    this.parent.putCustom('cryptogram', value);
    return this;
  }
}

export class CreditLineRailBuilder<
  TParent extends PaymentRequestPayloadBuilder,
> extends PaymentRailBuilderBase<TParent> {
  creditLineId(value: BlueValueInput): this {
    this.parent.putCustom('creditLineId', value);
    return this;
  }

  merchantAccountId(value: BlueValueInput): this {
    this.parent.putCustom('merchantAccountId', value);
    return this;
  }

  cardholderAccountId(value: BlueValueInput): this {
    this.parent.putCustom('cardholderAccountId', value);
    return this;
  }
}

export class LedgerRailBuilder<
  TParent extends PaymentRequestPayloadBuilder,
> extends PaymentRailBuilderBase<TParent> {
  ledgerAccountFrom(value: BlueValueInput): this {
    this.parent.putCustom('ledgerAccountFrom', value);
    return this;
  }

  ledgerAccountTo(value: BlueValueInput): this {
    this.parent.putCustom('ledgerAccountTo', value);
    return this;
  }

  memo(value: BlueValueInput): this {
    this.parent.putCustom('memo', value);
    return this;
  }
}

export class CryptoRailBuilder<
  TParent extends PaymentRequestPayloadBuilder,
> extends PaymentRailBuilderBase<TParent> {
  asset(value: BlueValueInput): this {
    this.parent.putCustom('asset', value);
    return this;
  }

  chain(value: BlueValueInput): this {
    this.parent.putCustom('chain', value);
    return this;
  }

  fromWalletRef(value: BlueValueInput): this {
    this.parent.putCustom('fromWalletRef', value);
    return this;
  }

  toAddress(value: BlueValueInput): this {
    this.parent.putCustom('toAddress', value);
    return this;
  }

  txPolicy(value: BlueValueInput): this {
    this.parent.putCustom('txPolicy', value);
    return this;
  }
}

export class PaymentRequestPayloadBuilder {
  private readonly payload = NodeObjectBuilder.create();
  private processorValue: string | null = null;

  processor(processor: string): this {
    this.processorValue = requireNonEmpty(processor, 'processor');
    this.payload.put('processor', this.processorValue);
    return this;
  }

  payer(payer: BlueValueInput): this {
    this.payload.putNode('payer', payer);
    return this;
  }

  payee(payee: BlueValueInput): this {
    this.payload.putNode('payee', payee);
    return this;
  }

  from(from: BlueValueInput): this {
    this.payload.putNode('from', from);
    return this;
  }

  to(to: BlueValueInput): this {
    this.payload.putNode('to', to);
    return this;
  }

  currency(currency: string): this {
    this.payload.put('currency', requireNonEmpty(currency, 'currency'));
    return this;
  }

  amountMinor(amountMinor: number): this {
    this.payload.put('amountMinor', amountMinor);
    return this;
  }

  amountMinorExpression(expression: string): this {
    this.payload.putExpression('amountMinor', expression);
    return this;
  }

  attachPayNote(payNote: BlueValueInput): this {
    this.payload.putNode('attachedPayNote', payNote);
    return this;
  }

  reason(reason: string): this {
    this.payload.put('reason', requireNonEmpty(reason, 'reason'));
    return this;
  }

  viaAch(): AchRailBuilder<this> {
    return new AchRailBuilder(this);
  }

  viaSepa(): SepaRailBuilder<this> {
    return new SepaRailBuilder(this);
  }

  viaWire(): WireRailBuilder<this> {
    return new WireRailBuilder(this);
  }

  viaCard(): CardRailBuilder<this> {
    return new CardRailBuilder(this);
  }

  viaTokenizedCard(): TokenizedCardRailBuilder<this> {
    return new TokenizedCardRailBuilder(this);
  }

  viaCreditLine(): CreditLineRailBuilder<this> {
    return new CreditLineRailBuilder(this);
  }

  viaLedger(): LedgerRailBuilder<this> {
    return new LedgerRailBuilder(this);
  }

  viaCrypto(): CryptoRailBuilder<this> {
    return new CryptoRailBuilder(this);
  }

  ext<TExtension>(
    extensionFactory: (payload: PaymentRequestPayloadBuilder) => TExtension,
  ): TExtension {
    if (extensionFactory == null) {
      throw new Error('extensionFactory cannot be null');
    }

    const extension = extensionFactory(this);
    if (extension == null) {
      throw new Error('extensionFactory cannot return null');
    }

    return extension;
  }

  putCustom(key: string, value: BlueValueInput): this {
    const normalized = requireNonEmpty(key, 'custom key');
    if (normalized === 'processor') {
      throw new Error('Use processor(...) to set processor');
    }

    this.payload.putNode(normalized, value);
    return this;
  }

  putCustomExpression(key: string, expression: string): this {
    const normalized = requireNonEmpty(key, 'custom key');
    if (normalized === 'processor') {
      throw new Error('Use processor(...) to set processor');
    }

    this.payload.putExpression(normalized, expression);
    return this;
  }

  build(): BlueNode {
    return this.payload.build();
  }

  processorName(): string | null {
    return this.processorValue;
  }
}

export class MyOsSteps {
  constructor(
    private readonly parent: StepsBuilder,
    private readonly adminChannelKey = 'myOsAdminChannel',
  ) {}

  singleDocumentPermissionGrantRequested(
    onBehalfOf: string,
    targetSessionId: BlueValueInput,
    permissions: BlueValueInput,
    options?: MyOsSingleDocumentPermissionGrantRequestedOptions,
  ): StepsBuilder {
    return this.requestSingleDocPermission(
      onBehalfOf,
      options?.requestId,
      targetSessionId,
      permissions,
      options,
    );
  }

  requestSingleDocPermission(
    onBehalfOf: string,
    requestId: string | null | undefined,
    targetSessionId: BlueValueInput,
    permissions: BlueValueInput,
    options?: SimpleStepOptions,
  ): StepsBuilder {
    requireValueInput(targetSessionId, 'targetSessionId');
    if (permissions == null) {
      throw new Error('permissions is required');
    }

    const eventNode = NodeObjectBuilder.create()
      .type('MyOS/Single Document Permission Grant Requested')
      .put('onBehalfOf', requireNonEmpty(onBehalfOf, 'onBehalfOf'))
      .putNode('targetSessionId', targetSessionId)
      .putNode('permissions', permissions);

    putOptionalStepMetadata(eventNode, options);
    putOptionalString(eventNode, 'requestId', requestId);

    return this.parent.triggerEvent(
      resolveStepName(options?.stepName, 'RequestSingleDocumentPermission'),
      eventNode.build(),
    );
  }

  requestLinkedDocsPermission(
    onBehalfOf: string,
    requestId: string | null | undefined,
    targetSessionId: BlueValueInput,
    links: BlueValueInput,
    options?: SimpleStepOptions,
  ): StepsBuilder {
    requireValueInput(targetSessionId, 'targetSessionId');
    if (links == null) {
      throw new Error('links is required');
    }

    const eventNode = NodeObjectBuilder.create()
      .type('MyOS/Linked Documents Permission Grant Requested')
      .put('onBehalfOf', requireNonEmpty(onBehalfOf, 'onBehalfOf'))
      .putNode('targetSessionId', targetSessionId)
      .putNode('links', links);

    putOptionalStepMetadata(eventNode, options);
    putOptionalString(eventNode, 'requestId', requestId);

    return this.parent.triggerEvent(
      resolveStepName(options?.stepName, 'RequestLinkedDocumentsPermission'),
      eventNode.build(),
    );
  }

  revokeSingleDocPermission(
    requestId: string | null | undefined,
    options?: RevokeRequestOptions,
  ): StepsBuilder {
    return this.emitRevokeRequested(
      'MyOS/Single Document Permission Revoke Requested',
      requestId,
      resolveStepName(options?.stepName, 'RevokeSingleDocumentPermission'),
      options,
    );
  }

  revokeLinkedDocsPermission(
    requestId: string | null | undefined,
    options?: RevokeRequestOptions,
  ): StepsBuilder {
    return this.emitRevokeRequested(
      'MyOS/Linked Documents Permission Revoke Requested',
      requestId,
      resolveStepName(options?.stepName, 'RevokeLinkedDocumentsPermission'),
      options,
    );
  }

  grantWorkerAgencyPermission(
    onBehalfOf: string,
    requestId: string | null | undefined,
    allowedWorkerAgencyPermissions: BlueValueInput,
    options?: SimpleStepOptions,
  ): StepsBuilder {
    if (allowedWorkerAgencyPermissions == null) {
      throw new Error('allowedWorkerAgencyPermissions is required');
    }

    const eventNode = NodeObjectBuilder.create()
      .type('MyOS/Worker Agency Permission Grant Requested')
      .put('onBehalfOf', requireNonEmpty(onBehalfOf, 'onBehalfOf'));

    const permissionsNode = toBlueNode(allowedWorkerAgencyPermissions);
    if (hasMeaningfulContent(permissionsNode)) {
      eventNode.putNode('allowedWorkerAgencyPermissions', permissionsNode);
    }

    putOptionalStepMetadata(eventNode, options);
    putOptionalString(eventNode, 'requestId', requestId);

    return this.parent.triggerEvent(
      resolveStepName(options?.stepName, 'RequestWorkerAgencyPermission'),
      eventNode.build(),
    );
  }

  revokeWorkerAgencyPermission(
    requestId: string | null | undefined,
    options?: RevokeRequestOptions,
  ): StepsBuilder {
    return this.emitRevokeRequested(
      'MyOS/Worker Agency Permission Revoke Requested',
      requestId,
      resolveStepName(options?.stepName, 'RevokeWorkerAgencyPermission'),
      options,
    );
  }

  subscribeToSessionRequested(
    targetSessionId: BlueValueInput,
    subscriptionId: string,
    options?: MyOsSubscribeToSessionRequestedOptions,
  ): StepsBuilder {
    requireValueInput(targetSessionId, 'targetSessionId');

    const subscription = NodeObjectBuilder.create().put(
      'id',
      requireNonEmpty(subscriptionId, 'subscriptionId'),
    );
    if (options?.events != null && options.events.length > 0) {
      subscription.putNode(
        'events',
        new BlueNode().setItems(
          options.events.map((eventPattern) =>
            toEventPatternNode(eventPattern),
          ),
        ),
      );
    }

    const eventNode = NodeObjectBuilder.create()
      .type('MyOS/Subscribe to Session Requested')
      .putNode('targetSessionId', targetSessionId)
      .putNode('subscription', subscription.build());

    putOptionalStepMetadata(eventNode, options);
    putOptionalString(eventNode, 'requestId', options?.requestId);

    return this.parent.triggerEvent(
      resolveStepName(options?.stepName, 'SubscribeToSession'),
      eventNode.build(),
    );
  }

  subscribeToSession(
    targetSessionId: BlueValueInput,
    subscriptionId: string,
    ...eventPatterns: EventPatternInput[]
  ): StepsBuilder {
    return this.subscribeToSessionRequested(targetSessionId, subscriptionId, {
      events: eventPatterns,
    });
  }

  callOperationRequested(
    onBehalfOf: string,
    targetSessionId: BlueValueInput,
    operation: string,
    request?: BlueValueInput,
    options?: MyOsCallOperationRequestedOptions,
  ): StepsBuilder {
    requireValueInput(targetSessionId, 'targetSessionId');

    const eventNode = NodeObjectBuilder.create()
      .type('MyOS/Call Operation Requested')
      .put('onBehalfOf', requireNonEmpty(onBehalfOf, 'onBehalfOf'))
      .putNode('targetSessionId', targetSessionId)
      .put('operation', requireNonEmpty(operation, 'operation'));

    if (request != null) {
      eventNode.putNode('request', request);
    }

    putOptionalStepMetadata(eventNode, options);
    putOptionalString(eventNode, 'requestId', options?.requestId);

    return this.parent.triggerEvent(
      resolveStepName(options?.stepName, 'CallOperation'),
      eventNode.build(),
    );
  }

  callOperation(
    onBehalfOf: string,
    targetSessionId: BlueValueInput,
    operation: string,
    request?: BlueValueInput,
  ): StepsBuilder {
    return this.callOperationRequested(
      onBehalfOf,
      targetSessionId,
      operation,
      request,
    );
  }

  startWorkerSession(
    onBehalfOf: string,
    document: BlueValueInput,
    channelBindings?: WorkerSessionBindingInput,
    optionsCustomizer?: WorkerSessionOptionsCustomizer,
    stepName?: string,
  ): StepsBuilder {
    if (document == null) {
      throw new Error('document is required');
    }

    const eventNode = NodeObjectBuilder.create()
      .type('MyOS/Start Worker Session Requested')
      .put('onBehalfOf', requireNonEmpty(onBehalfOf, 'onBehalfOf'))
      .putNode('document', document);

    const bindingsNode = buildBlueValueMapNode(channelBindings);
    if (bindingsNode) {
      eventNode.putNode('channelBindings', bindingsNode);
    }

    const options = new AgencySessionOptionsBuilder();
    optionsCustomizer?.(options);
    options.applyTo(eventNode);

    return this.parent.triggerEvent(
      resolveStepName(stepName, 'StartWorkerSession'),
      eventNode.build(),
    );
  }

  bootstrapDocument(
    stepName: string,
    documentNode: BlueValueInput,
    channelBindings: Record<string, string> | ReadonlyMap<string, string>,
    optionsCustomizer?: (options: BootstrapOptionsBuilderLike) => void,
  ): StepsBuilder {
    return this.parent.bootstrapDocument(
      stepName,
      documentNode,
      channelBindings,
      (options) => {
        options.assignee(this.adminChannelKey);
        optionsCustomizer?.(options);
      },
    );
  }

  private emitRevokeRequested(
    typeInput: TypeInput,
    requestId: string | null | undefined,
    stepName: string,
    options?: RevokeRequestOptions,
  ): StepsBuilder {
    const eventNode = NodeObjectBuilder.create().type(typeInput);
    putOptionalStepMetadata(eventNode, options);
    putOptionalString(eventNode, 'requestId', requestId);
    putOptionalString(eventNode, 'reason', options?.reason);
    return this.parent.triggerEvent(stepName, eventNode.build());
  }
}

export class PayNoteSteps {
  constructor(private readonly parent: StepsBuilder) {}

  reserveFundsRequested(
    stepName = 'ReserveFundsRequested',
    options?: PayNoteAmountEventOptions,
  ): StepsBuilder {
    return this.emitAmountRequest(
      'PayNote/Reserve Funds Requested',
      stepName,
      options,
    );
  }

  captureFundsRequested(
    stepName = 'CaptureFundsRequested',
    options?: PayNoteAmountEventOptions,
  ): StepsBuilder {
    return this.emitAmountRequest(
      'PayNote/Capture Funds Requested',
      stepName,
      options,
    );
  }

  reserveFundsAndCaptureImmediatelyRequested(
    stepName = 'ReserveAndCaptureImmediatelyRequested',
    options?: PayNoteAmountEventOptions,
  ): StepsBuilder {
    return this.emitAmountRequest(
      'PayNote/Reserve Funds and Capture Immediately Requested',
      stepName,
      options,
    );
  }

  reservationReleaseRequested(
    stepName = 'ReservationReleaseRequested',
    options?: PayNoteAmountEventOptions,
  ): StepsBuilder {
    return this.emitAmountRequest(
      'PayNote/Reservation Release Requested',
      stepName,
      options,
    );
  }

  cardTransactionCaptureLockRequested(
    stepName = 'RequestCaptureLock',
    options?: PayNoteCardTransactionEventOptions,
  ): StepsBuilder {
    return this.emitCardTransactionRequest(
      'PayNote/Card Transaction Capture Lock Requested',
      stepName,
      options,
    );
  }

  cardTransactionCaptureUnlockRequested(
    stepName = 'RequestCaptureUnlock',
    options?: PayNoteCardTransactionEventOptions,
  ): StepsBuilder {
    return this.emitCardTransactionRequest(
      'PayNote/Card Transaction Capture Unlock Requested',
      stepName,
      options,
    );
  }

  startCardTransactionMonitoringRequested(
    stepName = 'StartCardTransactionMonitoring',
    options?: PayNoteMonitoringRequestedOptions,
  ): StepsBuilder {
    const eventNode = NodeObjectBuilder.create().type(
      'PayNote/Start Card Transaction Monitoring Requested',
    );
    putOptionalStepMetadata(eventNode, options);
    putOptionalString(eventNode, 'requestId', options?.requestId);
    putOptionalNumber(eventNode, 'requestedAt', options?.requestedAt);
    putOptionalString(eventNode, 'targetMerchantId', options?.targetMerchantId);
    if (options?.events && options.events.length > 0) {
      eventNode.putNode(
        'events',
        new BlueNode().setItems(
          options.events.map((event) => toBlueNode(event)),
        ),
      );
    }
    return this.parent.triggerEvent(stepName, eventNode.build());
  }

  linkedCardChargeRequested(
    stepName = 'LinkedCardChargeRequested',
    options?: PayNoteLinkedChargeRequestedOptions,
  ): StepsBuilder {
    return this.emitLinkedChargeRequest(
      'PayNote/Linked Card Charge Requested',
      stepName,
      options,
    );
  }

  linkedCardChargeAndCaptureImmediatelyRequested(
    stepName = 'LinkedCardChargeAndCaptureImmediatelyRequested',
    options?: PayNoteLinkedChargeRequestedOptions,
  ): StepsBuilder {
    return this.emitLinkedChargeRequest(
      'PayNote/Linked Card Charge and Capture Immediately Requested',
      stepName,
      options,
    );
  }

  reverseCardChargeRequested(
    stepName = 'ReverseCardChargeRequested',
    options?: PayNoteLinkedChargeRequestedOptions,
  ): StepsBuilder {
    return this.emitLinkedChargeRequest(
      'PayNote/Reverse Card Charge Requested',
      stepName,
      options,
    );
  }

  reverseCardChargeAndCaptureImmediatelyRequested(
    stepName = 'ReverseCardChargeAndCaptureImmediatelyRequested',
    options?: PayNoteLinkedChargeRequestedOptions,
  ): StepsBuilder {
    return this.emitLinkedChargeRequest(
      'PayNote/Reverse Card Charge and Capture Immediately Requested',
      stepName,
      options,
    );
  }

  paymentMandateSpendAuthorizationRequested(
    stepName = 'RequestPaymentMandateSpendAuthorization',
    options?: PayNotePaymentMandateSpendAuthorizationRequestedOptions,
  ): StepsBuilder {
    const eventNode = NodeObjectBuilder.create().type(
      'PayNote/Payment Mandate Spend Authorization Requested',
    );
    putOptionalStepMetadata(eventNode, options);
    putOptionalString(eventNode, 'requestId', options?.requestId);
    putOptionalString(eventNode, 'authorizationId', options?.authorizationId);
    putOptionalNumber(eventNode, 'amountMinor', options?.amountMinor);
    putOptionalString(eventNode, 'currency', options?.currency);
    putOptionalString(eventNode, 'counterpartyType', options?.counterpartyType);
    putOptionalString(eventNode, 'counterpartyId', options?.counterpartyId);
    putOptionalString(
      eventNode,
      'requestingDocumentId',
      options?.requestingDocumentId,
    );
    putOptionalString(
      eventNode,
      'requestingSessionId',
      options?.requestingSessionId,
    );
    putOptionalString(eventNode, 'requestedAt', options?.requestedAt);
    return this.parent.triggerEvent(stepName, eventNode.build());
  }

  paymentMandateSpendSettled(
    stepName = 'PaymentMandateSpendSettled',
    options?: PayNotePaymentMandateSpendSettledOptions,
  ): StepsBuilder {
    const eventNode = NodeObjectBuilder.create().type(
      'PayNote/Payment Mandate Spend Settled',
    );
    putOptionalStepMetadata(eventNode, options);
    putOptionalNode(eventNode, 'inResponseTo', options?.inResponseTo);
    putOptionalString(eventNode, 'authorizationId', options?.authorizationId);
    putOptionalString(eventNode, 'settlementId', options?.settlementId);
    putOptionalString(eventNode, 'status', options?.status);
    putOptionalString(eventNode, 'reason', options?.reason);
    putOptionalNumber(
      eventNode,
      'reservedDeltaMinor',
      options?.reservedDeltaMinor,
    );
    putOptionalNumber(
      eventNode,
      'capturedDeltaMinor',
      options?.capturedDeltaMinor,
    );
    putOptionalString(eventNode, 'holdId', options?.holdId);
    putOptionalString(eventNode, 'transactionId', options?.transactionId);
    putOptionalString(eventNode, 'settledAt', options?.settledAt);
    return this.parent.triggerEvent(stepName, eventNode.build());
  }

  private emitAmountRequest(
    typeInput: TypeInput,
    stepName: string,
    options?: PayNoteAmountEventOptions,
  ): StepsBuilder {
    const eventNode = NodeObjectBuilder.create().type(typeInput);
    putOptionalStepMetadata(eventNode, options);
    putOptionalString(eventNode, 'requestId', options?.requestId);
    putOptionalNode(eventNode, 'amount', options?.amount);
    return this.parent.triggerEvent(stepName, eventNode.build());
  }

  private emitCardTransactionRequest(
    typeInput: TypeInput,
    stepName: string,
    options?: PayNoteCardTransactionEventOptions,
  ): StepsBuilder {
    const eventNode = NodeObjectBuilder.create().type(typeInput);
    putOptionalStepMetadata(eventNode, options);
    putOptionalString(eventNode, 'requestId', options?.requestId);
    putOptionalNode(
      eventNode,
      'cardTransactionDetails',
      options?.cardTransactionDetails,
    );
    return this.parent.triggerEvent(stepName, eventNode.build());
  }

  private emitLinkedChargeRequest(
    typeInput: TypeInput,
    stepName: string,
    options?: PayNoteLinkedChargeRequestedOptions,
  ): StepsBuilder {
    const eventNode = NodeObjectBuilder.create().type(typeInput);
    putOptionalStepMetadata(eventNode, options);
    putOptionalString(eventNode, 'requestId', options?.requestId);
    putOptionalNode(eventNode, 'amount', options?.amount);
    putOptionalString(
      eventNode,
      'paymentMandateDocumentId',
      options?.paymentMandateDocumentId,
    );
    putOptionalNode(eventNode, 'paynote', options?.paynote);
    return this.parent.triggerEvent(stepName, eventNode.build());
  }
}

export class ConversationSteps {
  constructor(private readonly parent: StepsBuilder) {}

  documentBootstrapRequested(
    stepName: string,
    documentNode: BlueValueInput,
    channelBindings: Record<string, string> | ReadonlyMap<string, string>,
    options?: ConversationDocumentBootstrapRequestOptions,
  ): StepsBuilder {
    if (documentNode == null) {
      throw new Error('document is required');
    }

    const eventNode = NodeObjectBuilder.create()
      .type('Conversation/Document Bootstrap Requested')
      .putNode('document', documentNode)
      .putStringMap('channelBindings', channelBindings);
    putOptionalStepMetadata(eventNode, options);
    putOptionalString(eventNode, 'requestId', options?.requestId);
    putOptionalString(
      eventNode,
      'bootstrapAssignee',
      options?.bootstrapAssignee,
    );
    putInitialMessages(eventNode, options);
    return this.parent.triggerEvent(stepName, eventNode.build());
  }

  documentBootstrapRequestedExpr(
    stepName: string,
    documentExpression: string,
    channelBindings: Record<string, string> | ReadonlyMap<string, string>,
    options?: ConversationDocumentBootstrapRequestOptions,
  ): StepsBuilder {
    if (isBlank(documentExpression)) {
      throw new Error('documentExpression cannot be blank');
    }

    const eventNode = NodeObjectBuilder.create()
      .type('Conversation/Document Bootstrap Requested')
      .putExpression('document', documentExpression)
      .putStringMap('channelBindings', channelBindings);
    putOptionalStepMetadata(eventNode, options);
    putOptionalString(eventNode, 'requestId', options?.requestId);
    putOptionalString(
      eventNode,
      'bootstrapAssignee',
      options?.bootstrapAssignee,
    );
    putInitialMessages(eventNode, options);
    return this.parent.triggerEvent(stepName, eventNode.build());
  }

  documentBootstrapResponded(
    stepName = 'DocumentBootstrapResponded',
    options?: ConversationDocumentBootstrapRespondedOptions,
  ): StepsBuilder {
    const eventNode = NodeObjectBuilder.create().type(
      'Conversation/Document Bootstrap Responded',
    );
    putOptionalStepMetadata(eventNode, options);
    putOptionalNode(eventNode, 'inResponseTo', options?.inResponseTo);
    putOptionalString(eventNode, 'status', options?.status);
    putOptionalString(eventNode, 'reason', options?.reason);
    return this.parent.triggerEvent(stepName, eventNode.build());
  }

  documentBootstrapCompleted(
    stepName = 'DocumentBootstrapCompleted',
    options?: ConversationDocumentBootstrapCompletedOptions,
  ): StepsBuilder {
    const eventNode = NodeObjectBuilder.create().type(
      'Conversation/Document Bootstrap Completed',
    );
    putOptionalStepMetadata(eventNode, options);
    putOptionalNode(eventNode, 'inResponseTo', options?.inResponseTo);
    putOptionalString(eventNode, 'documentId', options?.documentId);
    return this.parent.triggerEvent(stepName, eventNode.build());
  }

  documentBootstrapFailed(
    stepName = 'DocumentBootstrapFailed',
    options?: ConversationDocumentBootstrapFailedOptions,
  ): StepsBuilder {
    const eventNode = NodeObjectBuilder.create().type(
      'Conversation/Document Bootstrap Failed',
    );
    putOptionalStepMetadata(eventNode, options);
    putOptionalNode(eventNode, 'inResponseTo', options?.inResponseTo);
    putOptionalString(eventNode, 'reason', options?.reason);
    return this.parent.triggerEvent(stepName, eventNode.build());
  }

  customerActionRequested(
    stepName = 'CustomerActionRequested',
    options?: ConversationCustomerActionRequestedOptions,
  ): StepsBuilder {
    const eventNode = NodeObjectBuilder.create().type(
      'Conversation/Customer Action Requested',
    );
    putOptionalStepMetadata(eventNode, options);
    putOptionalString(eventNode, 'requestId', options?.requestId);
    putOptionalString(eventNode, 'title', options?.title);
    putOptionalString(eventNode, 'message', options?.message);
    if (options?.actions && options.actions.length > 0) {
      eventNode.putNode(
        'actions',
        new BlueNode().setItems(
          options.actions.map((action) => buildCustomerActionNode(action)),
        ),
      );
    }
    return this.parent.triggerEvent(stepName, eventNode.build());
  }

  customerActionResponded(
    stepName = 'CustomerActionResponded',
    options?: ConversationCustomerActionRespondedOptions,
  ): StepsBuilder {
    const eventNode = NodeObjectBuilder.create().type(
      'Conversation/Customer Action Responded',
    );
    putOptionalStepMetadata(eventNode, options);
    putOptionalNode(eventNode, 'inResponseTo', options?.inResponseTo);
    putOptionalString(eventNode, 'actionLabel', options?.actionLabel);
    putOptionalNode(eventNode, 'input', options?.input);
    putOptionalString(eventNode, 'respondedAt', options?.respondedAt);
    return this.parent.triggerEvent(stepName, eventNode.build());
  }
}

export class AISteps {
  constructor(
    private readonly parent: StepsBuilder,
    private readonly integration: AIIntegrationConfig,
  ) {}

  requestPermission(stepName = 'RequestPermission'): StepsBuilder {
    return this.parent.myOs().requestSingleDocPermission(
      this.integration.permissionFromChannel,
      this.integration.requestId,
      this.integration.sessionId.clone(),
      {
        type: 'MyOS/Single Document Permission Set',
        read: true,
        singleOps: ['provideInstructions'],
      },
      {
        stepName,
      },
    );
  }

  subscribe(stepName = 'Subscribe'): StepsBuilder {
    return this.parent
      .myOs()
      .subscribeToSessionRequested(
        this.integration.sessionId.clone(),
        this.integration.subscriptionId,
        {
          stepName,
        },
      );
  }
}

export class AccessSteps {
  constructor(
    private readonly parent: StepsBuilder,
    private readonly config: AccessConfig,
  ) {}

  call(operation: string, request: BlueValueInput | null): StepsBuilder {
    return this.parent
      .myOs()
      .callOperationRequested(
        this.config.onBehalfOfChannel,
        this.config.targetSessionId.clone(),
        operation,
        request ?? undefined,
      );
  }

  callExpr(operation: string, requestExpression: string): StepsBuilder {
    return this.call(operation, wrapExpression(requestExpression));
  }

  requestPermission(stepName = 'RequestPermission'): StepsBuilder {
    return this.parent
      .myOs()
      .requestSingleDocPermission(
        this.config.onBehalfOfChannel,
        this.config.requestId,
        this.config.targetSessionId.clone(),
        this.config.permissions.clone(),
        {
          stepName,
        },
      );
  }

  subscribe(
    ...args: [stepName?: string, ...events: EventPatternInput[]]
  ): StepsBuilder {
    const { stepName, events } = resolveSubscribeArgs(
      args,
      this.config.subscriptionEvents,
    );

    return this.parent
      .myOs()
      .subscribeToSessionRequested(
        this.config.targetSessionId.clone(),
        this.config.subscriptionId,
        {
          stepName,
          events,
        },
      );
  }

  revokePermission(stepName = 'RevokePermission'): StepsBuilder {
    return this.parent.myOs().revokeSingleDocPermission(this.config.requestId, {
      stepName,
    });
  }
}

export class LinkedAccessSteps {
  constructor(
    private readonly parent: StepsBuilder,
    private readonly config: LinkedAccessConfig,
  ) {}

  call(operation: string, request: BlueValueInput | null): StepsBuilder {
    return this.parent
      .myOs()
      .callOperationRequested(
        this.config.onBehalfOfChannel,
        this.config.targetSessionId.clone(),
        operation,
        request ?? undefined,
      );
  }

  callExpr(operation: string, requestExpression: string): StepsBuilder {
    return this.call(operation, wrapExpression(requestExpression));
  }

  requestPermission(stepName = 'RequestPermission'): StepsBuilder {
    return this.parent
      .myOs()
      .requestLinkedDocsPermission(
        this.config.onBehalfOfChannel,
        this.config.requestId,
        this.config.targetSessionId.clone(),
        createLinkedDocumentsPermissionSet(this.config.links),
        {
          stepName,
        },
      );
  }

  subscribe(
    ...args: [stepName?: string, ...events: EventPatternInput[]]
  ): StepsBuilder {
    const { stepName, events } = resolveSubscribeArgs(args);

    return this.parent
      .myOs()
      .subscribeToSessionRequested(
        this.config.targetSessionId.clone(),
        this.config.subscriptionId,
        {
          stepName,
          events,
        },
      );
  }

  revokePermission(stepName = 'RevokePermission'): StepsBuilder {
    return this.parent
      .myOs()
      .revokeLinkedDocsPermission(this.config.requestId, {
        stepName,
      });
  }
}

export class AgencySteps {
  constructor(
    private readonly parent: StepsBuilder,
    private readonly config: AgencyConfig,
  ) {}

  requestPermission(stepName = 'RequestAgencyPermission'): StepsBuilder {
    return this.parent
      .myOs()
      .grantWorkerAgencyPermission(
        this.config.onBehalfOfChannel,
        this.config.requestId,
        new BlueNode().setItems(
          this.config.allowedWorkerAgencyPermissions.map((permission) =>
            permission.clone(),
          ),
        ),
        {
          stepName,
        },
      );
  }

  call(operation: string, request: BlueValueInput | null): StepsBuilder {
    return this.parent
      .myOs()
      .callOperationRequested(
        this.config.onBehalfOfChannel,
        this.requireTargetSessionId(),
        operation,
        request ?? undefined,
      );
  }

  callExpr(operation: string, requestExpression: string): StepsBuilder {
    return this.call(operation, wrapExpression(requestExpression));
  }

  subscribe(
    ...args: [stepName?: string, ...events: EventPatternInput[]]
  ): StepsBuilder {
    const { stepName, events } = resolveSubscribeArgs(args);

    return this.parent
      .myOs()
      .subscribeToSessionRequested(
        this.requireTargetSessionId(),
        this.config.subscriptionId,
        {
          stepName,
          events,
        },
      );
  }

  revokePermission(stepName = 'RevokeAgencyPermission'): StepsBuilder {
    return this.parent
      .myOs()
      .revokeWorkerAgencyPermission(this.config.requestId, {
        stepName,
      });
  }

  startSession(
    stepName: string,
    document: BlueValueInput,
    bindingsCustomizer?: (bindings: AgencyBindingsBuilder) => void,
    optionsCustomizer?: (options: AgencySessionOptionsBuilder) => void,
  ): StepsBuilder {
    const bindings = new AgencyBindingsBuilder();
    bindingsCustomizer?.(bindings);

    return this.parent
      .myOs()
      .startWorkerSession(
        this.config.onBehalfOfChannel,
        document,
        bindings.build(),
        optionsCustomizer,
        stepName,
      );
  }

  private requireTargetSessionId(): BlueNode {
    if (this.config.targetSessionId) {
      return this.config.targetSessionId.clone();
    }

    throw new Error(
      `agency('${this.config.name}'): targetSessionId is required for this step helper`,
    );
  }
}

export class AgencyBindingsBuilder {
  private readonly bindings = new Map<string, BlueNode>();

  bind(channelKey: string, email: string): this {
    return this.putBinding(channelKey, {
      email: requireNonEmpty(email, 'email'),
    });
  }

  bindAccount(channelKey: string, accountId: string): this {
    return this.putBinding(channelKey, {
      accountId: requireNonEmpty(accountId, 'accountId'),
    });
  }

  bindNode(channelKey: string, binding: BlueValueInput): this {
    return this.putBinding(channelKey, binding);
  }

  bindExpr(channelKey: string, expression: string): this {
    if (isBlank(expression)) {
      throw new Error('expression is required');
    }
    return this.putBinding(channelKey, wrapExpression(expression));
  }

  bindFromCurrentDoc(targetKey: string, sourceKey?: string): this {
    const resolvedSource = requireNonEmpty(
      sourceKey ?? targetKey,
      'source channel key',
    );
    return this.bindExpr(
      requireNonEmpty(targetKey, 'channel key'),
      `document('/contracts/${resolvedSource}')`,
    );
  }

  build(): Record<string, BlueNode> {
    return Object.fromEntries(
      [...this.bindings.entries()].map(([key, value]) => [key, value.clone()]),
    );
  }

  private putBinding(channelKey: string, binding: BlueValueInput): this {
    this.bindings.set(
      requireNonEmpty(channelKey, 'channel key'),
      toBlueNode(binding),
    );
    return this;
  }
}

export class AgencySessionOptionsBuilder {
  private defaultMessageText: string | null = null;
  private readonly channelMessages = new Map<string, string>();
  private readonly capabilityValues = new Map<string, boolean>();
  private requestIdValue: string | null = null;
  private eventNameValue: string | null = null;
  private eventDescriptionValue: string | null = null;

  requestId(requestId: string | null | undefined): this {
    this.requestIdValue = normalizeOptional(requestId);
    return this;
  }

  name(name: string | null | undefined): this {
    this.eventNameValue = normalizeOptional(name);
    return this;
  }

  description(description: string | null | undefined): this {
    this.eventDescriptionValue = normalizeOptional(description);
    return this;
  }

  defaultMessage(text: string | null | undefined): this {
    this.defaultMessageText = normalizeOptional(text);
    return this;
  }

  channelMessage(
    channelKey: string | null | undefined,
    text: string | null | undefined,
  ): this {
    const normalizedKey = normalizeOptional(channelKey);
    const normalizedText = normalizeOptional(text);
    if (normalizedKey && normalizedText) {
      this.channelMessages.set(normalizedKey, normalizedText);
    }
    return this;
  }

  capabilities(
    customizer: (capabilities: AgencySessionCapabilitiesBuilder) => void,
  ): this {
    if (typeof customizer !== 'function') {
      throw new Error('capabilities customizer is required');
    }

    const builder = new AgencySessionCapabilitiesBuilder();
    customizer(builder);
    for (const [key, value] of builder.build().entries()) {
      this.capabilityValues.set(key, value);
    }
    return this;
  }

  applyTo(payload: NodeObjectBuilder): void {
    if (this.requestIdValue) {
      payload.put('requestId', this.requestIdValue);
    }

    if (this.eventNameValue) {
      payload.setName(this.eventNameValue);
    }

    if (this.eventDescriptionValue) {
      payload.setDescription(this.eventDescriptionValue);
    }

    if (this.defaultMessageText || this.channelMessages.size > 0) {
      const initialMessages = NodeObjectBuilder.create();
      if (this.defaultMessageText) {
        initialMessages.put('defaultMessage', this.defaultMessageText);
      }
      if (this.channelMessages.size > 0) {
        initialMessages.putNode(
          'perChannel',
          buildStringRecordNode(this.channelMessages),
        );
      }
      payload.putNode('initialMessages', initialMessages.build());
    }

    if (this.capabilityValues.size > 0) {
      payload.putNode(
        'capabilities',
        buildBooleanRecordNode(this.capabilityValues),
      );
    }
  }
}

export class AgencySessionCapabilitiesBuilder {
  private readonly capabilities = new Map<string, boolean>();

  set(name: string, enabled: boolean): this {
    this.capabilities.set(requireNonEmpty(name, 'capability name'), enabled);
    return this;
  }

  participantsOrchestration(enabled: boolean): this {
    return this.set('participantsOrchestration', enabled);
  }

  build(): ReadonlyMap<string, boolean> {
    return new Map(this.capabilities);
  }
}

export class AskAIBuilder {
  private readonly prompt = new PromptExpressionBuilder();
  private readonly inlineExpectedResponses: BlueNode[] = [];
  private readonly inlineNamedExpectedResponses: AINamedEventExpectation[] = [];
  private taskName: string | null = null;

  constructor(
    private readonly parent: StepsBuilder,
    private readonly integration: AIIntegrationConfig,
    private readonly stepName: string,
  ) {}

  task(taskName: string): this {
    this.taskName = requireNonEmpty(taskName, 'taskName');
    return this;
  }

  instruction(text: string | null | undefined): this {
    this.prompt.text(text);
    return this;
  }

  expects(typeInput: TypeInput): this {
    this.inlineExpectedResponses.push(resolveTypeInput(typeInput).clone());
    return this;
  }

  expectsNamed(eventName: string): this;
  expectsNamed(
    eventName: string,
    fieldsCustomizer: (fields: AINamedEventFieldsBuilder) => void,
  ): this;
  expectsNamed(eventName: string, ...fieldNames: string[]): this;
  expectsNamed(
    eventName: string,
    ...rest:
      | []
      | [fieldsCustomizer: (fields: AINamedEventFieldsBuilder) => void]
      | string[]
  ): this {
    const builder = new AINamedEventFieldsBuilder(eventName);
    const first = rest[0];
    if (typeof first === 'function') {
      first(builder);
    } else {
      for (const fieldName of rest.filter(
        (value): value is string => typeof value === 'string',
      )) {
        builder.field(fieldName);
      }
    }

    this.inlineNamedExpectedResponses.push(builder.build());
    return this;
  }

  build(): StepsBuilder {
    const mergedPrompt = new PromptExpressionBuilder();
    const mergedExpectedResponses: BlueNode[] = [];
    const mergedNamedExpectedResponses: AINamedEventExpectation[] = [];

    if (this.taskName) {
      const task = this.integration.tasks.get(this.taskName);
      if (!task) {
        throw new Error(
          `Unknown task '${this.taskName}' for AI integration '${this.integration.name}'`,
        );
      }

      for (const instruction of task.instructions) {
        mergedPrompt.text(instruction);
      }

      mergedExpectedResponses.push(
        ...task.expectedResponses.map((response) => response.clone()),
      );
      mergedNamedExpectedResponses.push(...task.expectedNamedEvents);
    }

    mergedPrompt.append(this.prompt);
    mergedExpectedResponses.push(
      ...this.inlineExpectedResponses.map((response) => response.clone()),
    );
    mergedNamedExpectedResponses.push(...this.inlineNamedExpectedResponses);

    if (mergedPrompt.isEmpty()) {
      throw new Error(
        `askAI('${this.integration.name}', '${this.stepName}'): at least one instruction is required`,
      );
    }

    const request = NodeObjectBuilder.create()
      .put('requester', this.integration.requesterId)
      .put('instructions', mergedPrompt.toWrappedExpression())
      .putExpression(
        'context',
        `document('${escapeSingleQuoted(this.integration.contextPath)}')`,
      );

    if (this.taskName) {
      request.put('taskName', this.taskName);
    }

    const expectedResponsesNode = buildAiExpectedResponsesNode(
      mergedExpectedResponses,
      mergedNamedExpectedResponses,
    );
    if (expectedResponsesNode) {
      request.putNode('expectedResponses', expectedResponsesNode);
    }

    return this.parent
      .myOs()
      .callOperationRequested(
        this.integration.permissionFromChannel,
        this.integration.sessionId.clone(),
        'provideInstructions',
        request.build(),
        {
          stepName: this.stepName,
        },
      );
  }
}

export class AINamedEventFieldsBuilder {
  private readonly fields: {
    name: string;
    description: string | null;
  }[] = [];

  constructor(private readonly eventName: string) {}

  field(
    fieldName: string,
    description?: string | null | undefined,
  ): AINamedEventFieldsBuilder {
    this.fields.push({
      name: requireNonEmpty(fieldName, 'field name'),
      description: normalizeOptional(description),
    });
    return this;
  }

  build(): AINamedEventExpectation {
    return {
      name: requireNonEmpty(this.eventName, 'eventName'),
      fields: this.fields.map((field) => ({
        name: field.name,
        description: field.description,
      })),
    };
  }
}

class PromptExpressionBuilder {
  private readonly segments: PromptSegment[] = [];

  append(other: PromptExpressionBuilder): void {
    if (other.segments.length === 0) {
      return;
    }

    if (this.segments.length > 0) {
      this.segments.push(PromptSegment.literal('\n'));
    }

    this.segments.push(...other.segments.map((segment) => segment.clone()));
  }

  text(value: string | null | undefined): void {
    if (value == null) {
      return;
    }

    const normalized = value.trim();
    if (normalized.length === 0) {
      return;
    }

    if (this.segments.length > 0) {
      this.segments.push(PromptSegment.literal('\n'));
    }

    this.parseInterpolatedText(normalized);
  }

  isEmpty(): boolean {
    return this.segments.length === 0;
  }

  toWrappedExpression(): string {
    if (this.segments.length === 0) {
      return wrapExpression("''");
    }

    return wrapExpression(
      this.segments
        .map((segment) =>
          segment.expression
            ? `(${segment.value})`
            : `'${escapePromptLiteral(segment.value)}'`,
        )
        .join(' + '),
    );
  }

  private parseInterpolatedText(rawText: string): void {
    let index = 0;
    while (index < rawText.length) {
      const start = rawText.indexOf('${', index);
      if (start < 0) {
        const literal = rawText.slice(index);
        if (literal.length > 0) {
          this.segments.push(PromptSegment.literal(literal));
        }
        return;
      }

      if (start > index) {
        this.segments.push(PromptSegment.literal(rawText.slice(index, start)));
      }

      const end = rawText.indexOf('}', start + 2);
      if (end < 0) {
        this.segments.push(PromptSegment.literal(rawText.slice(start)));
        return;
      }

      const expression = rawText.slice(start + 2, end).trim();
      if (expression.length > 0) {
        this.segments.push(PromptSegment.expression(expression));
      }
      index = end + 1;
    }
  }
}

class PromptSegment {
  private constructor(
    readonly expression: boolean,
    readonly value: string,
  ) {}

  static literal(value: string): PromptSegment {
    return new PromptSegment(false, value);
  }

  static expression(value: string): PromptSegment {
    return new PromptSegment(true, value);
  }

  clone(): PromptSegment {
    return new PromptSegment(this.expression, this.value);
  }
}

function buildAiExpectedResponsesNode(
  expectedResponses: readonly BlueNode[],
  expectedNamedEvents: readonly AINamedEventExpectation[],
): BlueNode | null {
  if (expectedResponses.length === 0 && expectedNamedEvents.length === 0) {
    return null;
  }

  const items: BlueNode[] = [
    ...expectedResponses.map((response) => response.clone()),
    ...expectedNamedEvents.map((expectation) =>
      buildNamedEventExpectationNode(expectation),
    ),
  ];

  return items.length === 0 ? null : new BlueNode().setItems(items);
}

function buildNamedEventExpectationNode(
  expectation: AINamedEventExpectation,
): BlueNode {
  const event = NodeObjectBuilder.create()
    .type('Common/Named Event')
    .put('name', expectation.name);

  if (expectation.fields.length > 0) {
    const payload = NodeObjectBuilder.create();
    for (const field of expectation.fields) {
      const descriptor = NodeObjectBuilder.create();
      if (field.description) {
        descriptor.setDescription(field.description);
      }
      payload.putNode(field.name, descriptor.build());
    }
    event.putNode('payload', payload.build());
  }

  return event.build();
}

function applyBootstrapOptions(
  payload: NodeObjectBuilder,
  optionsCustomizer?: (options: BootstrapOptionsBuilderLike) => void,
): void {
  if (!optionsCustomizer) {
    return;
  }

  const options = new BootstrapOptionsBuilder();
  optionsCustomizer(options);
  options.applyTo(payload);
}

function buildBlueValueMapNode(
  input: WorkerSessionBindingInput | undefined,
): BlueNode | null {
  if (!input) {
    return null;
  }

  const dictionary = new BlueNode();
  const properties: Record<string, BlueNode> = {};
  for (const [rawKey, value] of iterateBlueValueMap(input)) {
    const normalizedKey = rawKey.trim();
    if (normalizedKey.length === 0 || value == null) {
      continue;
    }
    properties[normalizedKey] = toBlueNode(value);
  }

  if (Object.keys(properties).length === 0) {
    return null;
  }

  dictionary.setProperties(properties);
  return dictionary;
}

function buildStringRecordNode(values: ReadonlyMap<string, string>): BlueNode {
  const dictionary = new BlueNode();
  const properties: Record<string, BlueNode> = {};
  for (const [key, value] of values.entries()) {
    properties[key] = toBlueNode(value);
  }
  dictionary.setProperties(properties);
  return dictionary;
}

function buildBooleanRecordNode(
  values: ReadonlyMap<string, boolean>,
): BlueNode {
  const dictionary = new BlueNode();
  const properties: Record<string, BlueNode> = {};
  for (const [key, value] of values.entries()) {
    properties[key] = toBlueNode(value);
  }
  dictionary.setProperties(properties);
  return dictionary;
}

function hasMeaningfulContent(node: BlueNode): boolean {
  return (
    node.getValue() !== undefined ||
    node.getBlueId() !== undefined ||
    node.getType() != null ||
    node.getName() != null ||
    node.getDescription() != null ||
    (node.getItems()?.length ?? 0) > 0 ||
    Object.keys(node.getProperties() ?? {}).length > 0
  );
}

function resolveSubscribeArgs(
  args: readonly [string?, ...EventPatternInput[]],
  fallbackEvents: readonly EventPatternInput[] = [],
): {
  stepName: string;
  events: readonly EventPatternInput[] | undefined;
} {
  if (args.length === 0) {
    return {
      stepName: 'Subscribe',
      events: fallbackEvents.length > 0 ? fallbackEvents : undefined,
    };
  }

  const [first, ...rest] = args;
  if (
    first != null &&
    (typeof first !== 'string' || looksLikeEventPatternString(first))
  ) {
    return {
      stepName: 'Subscribe',
      events: [first, ...rest],
    };
  }

  return {
    stepName: requireNonEmpty(first ?? 'Subscribe', 'step name'),
    events:
      rest.length > 0
        ? rest
        : fallbackEvents.length > 0
          ? fallbackEvents
          : undefined,
  };
}

function looksLikeEventPatternString(value: string): boolean {
  return value.includes('/');
}

function putOptionalStepMetadata(
  node: NodeObjectBuilder,
  options: SimpleStepOptions | undefined,
): void {
  const name = normalizeOptional(options?.name);
  if (name) {
    node.setName(name);
  }

  const description = normalizeOptional(options?.description);
  if (description) {
    node.setDescription(description);
  }
}

function putOptionalNode(
  node: NodeObjectBuilder,
  key: string,
  value: BlueValueInput | null | undefined,
): void {
  if (value != null) {
    node.putNode(key, value);
  }
}

function putOptionalNumber(
  node: NodeObjectBuilder,
  key: string,
  value: number | null | undefined,
): void {
  if (typeof value === 'number' && Number.isFinite(value)) {
    node.put(key, value);
  }
}

function putOptionalString(
  node: NodeObjectBuilder,
  key: string,
  value: string | null | undefined,
): void {
  const normalized = normalizeOptional(value);
  if (normalized) {
    node.put(key, normalized);
  }
}

function putInitialMessages(
  node: NodeObjectBuilder,
  options: ConversationDocumentBootstrapRequestOptions | undefined,
): void {
  const defaultMessage = normalizeOptional(options?.defaultMessage);
  const channelMessages = options?.channelMessages;
  const channelEntries = channelMessages
    ? channelMessages instanceof Map
      ? [...channelMessages.entries()]
      : Object.entries(channelMessages)
    : [];

  if (!defaultMessage && channelEntries.length === 0) {
    return;
  }

  const initialMessages = NodeObjectBuilder.create();
  if (defaultMessage) {
    initialMessages.put('defaultMessage', defaultMessage);
  }

  if (channelEntries.length > 0) {
    const perChannel = new Map<string, string>();
    for (const [key, value] of channelEntries) {
      const normalizedKey = normalizeOptional(key);
      const normalizedValue = normalizeOptional(value);
      if (normalizedKey && normalizedValue) {
        perChannel.set(normalizedKey, normalizedValue);
      }
    }

    if (perChannel.size > 0) {
      initialMessages.putNode('perChannel', buildStringRecordNode(perChannel));
    }
  }

  node.putNode('initialMessages', initialMessages.build());
}

function buildCustomerActionNode(
  action: ConversationCustomerActionDefinition,
): BlueNode {
  const node = NodeObjectBuilder.create();
  putOptionalString(node, 'label', action.label);
  putOptionalString(node, 'variant', action.variant);
  putOptionalString(node, 'inputTitle', action.inputTitle);
  putOptionalString(node, 'inputPlaceholder', action.inputPlaceholder);
  if (typeof action.inputRequired === 'boolean') {
    node.put('inputRequired', action.inputRequired);
  }
  putOptionalNode(node, 'inputSchema', action.inputSchema);
  return node.build();
}

function toEventPatternNode(eventPattern: EventPatternInput): BlueNode {
  if (eventPattern == null) {
    throw new Error('eventPattern cannot be null');
  }

  if (typeof eventPattern === 'string') {
    return new BlueNode().setType(resolveTypeInput(eventPattern));
  }

  if (eventPattern instanceof BlueNode) {
    return eventPattern.clone();
  }

  if (isBlueIdObject(eventPattern) || isLikelyZodSchema(eventPattern)) {
    return new BlueNode().setType(resolveTypeInput(eventPattern));
  }

  return toBlueNode(eventPattern as BlueValueInput);
}

function iterateBlueValueMap(
  map: WorkerSessionBindingInput,
): Iterable<[string, BlueValueInput]> {
  return map instanceof Map ? map.entries() : Object.entries(map);
}

function resolveStepName(
  provided: string | null | undefined,
  fallback: string,
): string {
  return normalizeOptional(provided) ?? fallback;
}

function normalizeOptional(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function escapeSingleQuoted(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function escapePromptLiteral(value: string): string {
  return escapeSingleQuoted(value).replace(/\n/g, '\\n');
}

function requireValueInput(value: BlueValueInput, label: string): void {
  if (value == null) {
    throw new Error(`${label} is required`);
  }

  if (typeof value === 'string' && isBlank(value)) {
    throw new Error(`${label} is required`);
  }
}

function isBlueIdObject(value: unknown): value is { blueId: string } {
  return (
    value != null &&
    typeof value === 'object' &&
    'blueId' in value &&
    typeof (value as { blueId?: unknown }).blueId === 'string'
  );
}

function isLikelyZodSchema(value: unknown): value is ZodTypeAny {
  return (
    value != null &&
    typeof value === 'object' &&
    typeof (value as { safeParse?: unknown }).safeParse === 'function' &&
    '_def' in value
  );
}

function requireNonEmpty(
  value: string | null | undefined,
  label: string,
): string {
  const trimmed = value?.trim() ?? '';
  if (trimmed.length === 0) {
    throw new Error(`${label} is required`);
  }
  return trimmed;
}
