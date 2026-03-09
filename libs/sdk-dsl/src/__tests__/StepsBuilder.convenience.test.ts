/*
Java references:
- references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderStepsDslParityTest.java
*/

import { blueIds as payNoteBlueIds } from '@blue-repository/types/packages/paynote/blue-ids';

import { DocBuilder, type PaymentRequestPayloadBuilder } from '../lib';

class DemoBankPaymentFields {
  constructor(private readonly payload: PaymentRequestPayloadBuilder) {}

  creditFacilityId(value: string): this {
    this.payload.putCustom('creditFacilityId', value);
    return this;
  }

  riskTier(value: string): this {
    this.payload.putCustom('riskTier', value);
    return this;
  }
}

describe('StepsBuilder payment conveniences', () => {
  it('builds triggerPayment payloads with core, rail-specific, and extension fields', () => {
    const built = DocBuilder.doc()
      .name('Payment payload parity')
      .field('/calc', 3)
      .onInit('bootstrap', (steps) =>
        steps.triggerPayment(
          'RequestPayment',
          'PayNote/Linked Card Charge Requested',
          (payload) =>
            payload
              .processor('processorChannel')
              .payer('payerRef')
              .payer({ channel: 'payerChannel' })
              .payee('payeeRef')
              .payee({ channel: 'payeeChannel' })
              .currency('USD')
              .amountMinor(1500)
              .amountMinorExpression("document('/amount/total')")
              .attachPayNote({
                name: 'Attached PayNote',
                type: 'PayNote/PayNote',
              })
              .viaAch()
              .routingNumber('111000025')
              .accountNumber('123456')
              .accountType('checking')
              .network('ACH')
              .companyEntryDescription('PAYROLL')
              .done()
              .viaSepa()
              .ibanFrom('DE123')
              .ibanTo('DE456')
              .bicTo('BICCODE')
              .remittanceInformation('Invoice #123')
              .done()
              .viaWire()
              .bankSwift('SWIFT-1')
              .bankName('Blue Bank')
              .beneficiaryName('Jane Doe')
              .beneficiaryAddress('Main Street 1')
              .done()
              .viaCard()
              .cardOnFileRef('cof-1')
              .merchantDescriptor('Blue Shop')
              .done()
              .viaTokenizedCard()
              .networkToken('token-1')
              .tokenProvider('provider-1')
              .cryptogram('crypt-1')
              .done()
              .viaCreditLine()
              .creditLineId('credit-1')
              .merchantAccountId('merchant-1')
              .cardholderAccountId('holder-1')
              .done()
              .viaLedger()
              .ledgerAccountFrom('ledger-from')
              .ledgerAccountTo('ledger-to')
              .memo('memo-1')
              .done()
              .viaCrypto()
              .asset('BTC')
              .chain('bitcoin')
              .fromWalletRef('wallet-1')
              .toAddress('bc1address')
              .txPolicy('fast')
              .done()
              .putCustom('customField', 'custom-value')
              .putCustomExpression('customExpr', "document('/calc')")
              .ext((builder) =>
                new DemoBankPaymentFields(builder)
                  .creditFacilityId('facility-42')
                  .riskTier('tier-a'),
              ),
        ),
      )
      .buildDocument();

    const event = built
      .getContracts()
      ?.bootstrap?.getProperties()
      ?.steps?.getItems()?.[0]
      ?.getProperties()?.event;

    expect(event?.getType()?.getBlueId()).toBe(
      payNoteBlueIds['PayNote/Linked Card Charge Requested'],
    );
    expect(event?.getProperties()?.processor?.getValue()).toBe(
      'processorChannel',
    );
    expect(
      event?.getProperties()?.payer?.getProperties()?.channel?.getValue(),
    ).toBe('payerChannel');
    expect(
      event?.getProperties()?.payee?.getProperties()?.channel?.getValue(),
    ).toBe('payeeChannel');
    expect(event?.getProperties()?.currency?.getValue()).toBe('USD');
    expect(event?.getProperties()?.amountMinor?.getValue()).toBe(
      "${document('/amount/total')}",
    );
    expect(event?.getProperties()?.attachedPayNote?.getName()).toBe(
      'Attached PayNote',
    );
    expect(event?.getProperties()?.routingNumber?.getValue()).toBe('111000025');
    expect(event?.getProperties()?.accountNumber?.getValue()).toBe('123456');
    expect(event?.getProperties()?.accountType?.getValue()).toBe('checking');
    expect(event?.getProperties()?.network?.getValue()).toBe('ACH');
    expect(event?.getProperties()?.companyEntryDescription?.getValue()).toBe(
      'PAYROLL',
    );
    expect(event?.getProperties()?.ibanFrom?.getValue()).toBe('DE123');
    expect(event?.getProperties()?.ibanTo?.getValue()).toBe('DE456');
    expect(event?.getProperties()?.bicTo?.getValue()).toBe('BICCODE');
    expect(event?.getProperties()?.remittanceInformation?.getValue()).toBe(
      'Invoice #123',
    );
    expect(event?.getProperties()?.bankSwift?.getValue()).toBe('SWIFT-1');
    expect(event?.getProperties()?.bankName?.getValue()).toBe('Blue Bank');
    expect(event?.getProperties()?.beneficiaryName?.getValue()).toBe(
      'Jane Doe',
    );
    expect(event?.getProperties()?.beneficiaryAddress?.getValue()).toBe(
      'Main Street 1',
    );
    expect(event?.getProperties()?.cardOnFileRef?.getValue()).toBe('cof-1');
    expect(event?.getProperties()?.merchantDescriptor?.getValue()).toBe(
      'Blue Shop',
    );
    expect(event?.getProperties()?.networkToken?.getValue()).toBe('token-1');
    expect(event?.getProperties()?.tokenProvider?.getValue()).toBe(
      'provider-1',
    );
    expect(event?.getProperties()?.cryptogram?.getValue()).toBe('crypt-1');
    expect(event?.getProperties()?.creditLineId?.getValue()).toBe('credit-1');
    expect(event?.getProperties()?.merchantAccountId?.getValue()).toBe(
      'merchant-1',
    );
    expect(event?.getProperties()?.cardholderAccountId?.getValue()).toBe(
      'holder-1',
    );
    expect(event?.getProperties()?.ledgerAccountFrom?.getValue()).toBe(
      'ledger-from',
    );
    expect(event?.getProperties()?.ledgerAccountTo?.getValue()).toBe(
      'ledger-to',
    );
    expect(event?.getProperties()?.memo?.getValue()).toBe('memo-1');
    expect(event?.getProperties()?.asset?.getValue()).toBe('BTC');
    expect(event?.getProperties()?.chain?.getValue()).toBe('bitcoin');
    expect(event?.getProperties()?.fromWalletRef?.getValue()).toBe('wallet-1');
    expect(event?.getProperties()?.toAddress?.getValue()).toBe('bc1address');
    expect(event?.getProperties()?.txPolicy?.getValue()).toBe('fast');
    expect(event?.getProperties()?.customField?.getValue()).toBe(
      'custom-value',
    );
    expect(event?.getProperties()?.customExpr?.getValue()).toBe(
      "${document('/calc')}",
    );
    expect(event?.getProperties()?.creditFacilityId?.getValue()).toBe(
      'facility-42',
    );
    expect(event?.getProperties()?.riskTier?.getValue()).toBe('tier-a');
  });

  it('uses the default triggerPayment step name for the two-argument overload', () => {
    const built = DocBuilder.doc()
      .onInit('bootstrap', (steps) =>
        steps.triggerPayment('PayNote/Reserve Funds Requested', (payload) =>
          payload
            .processor('processorChannel')
            .currency('USD')
            .amountMinor(100),
        ),
      )
      .buildDocument();

    const step = built
      .getContracts()
      ?.bootstrap?.getProperties()
      ?.steps?.getItems()?.[0];

    expect(step?.getName()).toBe('TriggerPayment');
    expect(step?.getProperties()?.event?.getType()?.getBlueId()).toBe(
      payNoteBlueIds['PayNote/Reserve Funds Requested'],
    );
  });

  it('requires a processor field for triggerPayment', () => {
    expect(() =>
      DocBuilder.doc()
        .onInit('bootstrap', (steps) =>
          steps.triggerPayment('PayNote/Reserve Funds Requested', (payload) =>
            payload.currency('USD'),
          ),
        )
        .buildDocument(),
    ).toThrow('triggerPayment requires non-empty processor field');
  });

  it('rejects using putCustom to set processor', () => {
    expect(() =>
      DocBuilder.doc()
        .onInit('bootstrap', (steps) =>
          steps.triggerPayment('PayNote/Reserve Funds Requested', (payload) =>
            payload.processor('processorChannel').putCustom('processor', 'bad'),
          ),
        )
        .buildDocument(),
    ).toThrow('Use processor(...) to set processor');
  });

  it('supports custom payment payload extensions and rejects null ext values', () => {
    const built = DocBuilder.doc()
      .onInit('bootstrap', (steps) =>
        steps.triggerPayment('PayNote/Reserve Funds Requested', (payload) =>
          payload
            .processor('processorChannel')
            .currency('USD')
            .amountMinor(100)
            .ext((builder) =>
              new DemoBankPaymentFields(builder)
                .creditFacilityId('facility-1')
                .riskTier('tier-b'),
            ),
        ),
      )
      .buildDocument();

    const event = built
      .getContracts()
      ?.bootstrap?.getProperties()
      ?.steps?.getItems()?.[0]
      ?.getProperties()?.event;

    expect(event?.getProperties()?.creditFacilityId?.getValue()).toBe(
      'facility-1',
    );
    expect(event?.getProperties()?.riskTier?.getValue()).toBe('tier-b');

    expect(() =>
      DocBuilder.doc()
        .onInit('bootstrap', (steps) =>
          steps.triggerPayment('PayNote/Reserve Funds Requested', (payload) => {
            payload.processor('processorChannel').ext(null as never);
          }),
        )
        .buildDocument(),
    ).toThrow('extensionFactory cannot be null');

    expect(() =>
      DocBuilder.doc()
        .onInit('bootstrap', (steps) =>
          steps.triggerPayment('PayNote/Reserve Funds Requested', (payload) => {
            payload.processor('processorChannel').ext(() => null as never);
          }),
        )
        .buildDocument(),
    ).toThrow('extensionFactory cannot return null');
  });

  it('guards requestBackwardPayment when the runtime alias is unavailable', () => {
    expect(() =>
      DocBuilder.doc()
        .onInit('bootstrap', (steps) =>
          steps.requestBackwardPayment((payload) =>
            payload
              .processor('guarantorChannel')
              .from('payeeChannel')
              .to('payerChannel')
              .currency('USD')
              .amountMinor(10000)
              .reason('voucher-activation'),
          ),
        )
        .buildDocument(),
    ).toThrow(
      "requestBackwardPayment requires repository type alias 'PayNote/Backward Payment Requested'",
    );
  });
});
