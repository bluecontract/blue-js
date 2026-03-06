package blue.language.types.payments;

import blue.language.model.Node;
import blue.language.model.TypeBlueId;
import blue.language.types.TypeAlias;

public final class PaymentRequests {

    private PaymentRequests() {
    }

    @TypeAlias("Payments/Payment Requested")
    @TypeBlueId("Payments-Base-Payment-Requested-BlueId")
    public static class PaymentRequested {
        public String processor;
        public Node payer;
        public Node payee;
        public String currency;
        public Long amountMinor;
        public Node attachedPayNote;

        public PaymentRequested processor(String processor) {
            this.processor = processor;
            return this;
        }

        public PaymentRequested payer(Node payer) {
            this.payer = payer;
            return this;
        }

        public PaymentRequested payee(Node payee) {
            this.payee = payee;
            return this;
        }

        public PaymentRequested currency(String currency) {
            this.currency = currency;
            return this;
        }

        public PaymentRequested amountMinor(Long amountMinor) {
            this.amountMinor = amountMinor;
            return this;
        }

        public PaymentRequested attachedPayNote(Node attachedPayNote) {
            this.attachedPayNote = attachedPayNote;
            return this;
        }
    }

    @TypeAlias("Payments/Ach Transfer Requested")
    @TypeBlueId("Payments-Ach-Transfer-Requested-BlueId")
    public static class AchTransferRequested extends PaymentRequested {
        public String routingNumber;
        public String accountNumber;
        public String accountType;
        public String network;
        public String companyEntryDescription;

        public AchTransferRequested routingNumber(String routingNumber) {
            this.routingNumber = routingNumber;
            return this;
        }

        public AchTransferRequested accountNumber(String accountNumber) {
            this.accountNumber = accountNumber;
            return this;
        }

        public AchTransferRequested accountType(String accountType) {
            this.accountType = accountType;
            return this;
        }

        public AchTransferRequested network(String network) {
            this.network = network;
            return this;
        }

        public AchTransferRequested companyEntryDescription(String companyEntryDescription) {
            this.companyEntryDescription = companyEntryDescription;
            return this;
        }
    }

    @TypeAlias("Payments/Sepa Transfer Requested")
    @TypeBlueId("Payments-Sepa-Transfer-Requested-BlueId")
    public static class SepaTransferRequested extends PaymentRequested {
        public String ibanFrom;
        public String ibanTo;
        public String bicTo;
        public String remittanceInformation;

        public SepaTransferRequested ibanFrom(String ibanFrom) {
            this.ibanFrom = ibanFrom;
            return this;
        }

        public SepaTransferRequested ibanTo(String ibanTo) {
            this.ibanTo = ibanTo;
            return this;
        }

        public SepaTransferRequested bicTo(String bicTo) {
            this.bicTo = bicTo;
            return this;
        }

        public SepaTransferRequested remittanceInformation(String remittanceInformation) {
            this.remittanceInformation = remittanceInformation;
            return this;
        }
    }

    @TypeAlias("Payments/Wire Transfer Requested")
    @TypeBlueId("Payments-Wire-Transfer-Requested-BlueId")
    public static class WireTransferRequested extends PaymentRequested {
        public String bankSwift;
        public String bankName;
        public String accountNumber;
        public String beneficiaryName;
        public String beneficiaryAddress;

        public WireTransferRequested bankSwift(String bankSwift) {
            this.bankSwift = bankSwift;
            return this;
        }

        public WireTransferRequested bankName(String bankName) {
            this.bankName = bankName;
            return this;
        }

        public WireTransferRequested accountNumber(String accountNumber) {
            this.accountNumber = accountNumber;
            return this;
        }

        public WireTransferRequested beneficiaryName(String beneficiaryName) {
            this.beneficiaryName = beneficiaryName;
            return this;
        }

        public WireTransferRequested beneficiaryAddress(String beneficiaryAddress) {
            this.beneficiaryAddress = beneficiaryAddress;
            return this;
        }
    }

    @TypeAlias("Payments/Card Payment Requested")
    @TypeBlueId("Payments-Card-Payment-Requested-BlueId")
    public static class CardPaymentRequested extends PaymentRequested {
        public String cardOnFileRef;
        public String merchantDescriptor;

        public CardPaymentRequested cardOnFileRef(String cardOnFileRef) {
            this.cardOnFileRef = cardOnFileRef;
            return this;
        }

        public CardPaymentRequested merchantDescriptor(String merchantDescriptor) {
            this.merchantDescriptor = merchantDescriptor;
            return this;
        }
    }

    @TypeAlias("Payments/Card Token Payment Requested")
    @TypeBlueId("Payments-Card-Token-Payment-Requested-BlueId")
    public static class CardTokenPaymentRequested extends PaymentRequested {
        public String networkToken;
        public String tokenProvider;
        public String cryptogram;

        public CardTokenPaymentRequested networkToken(String networkToken) {
            this.networkToken = networkToken;
            return this;
        }

        public CardTokenPaymentRequested tokenProvider(String tokenProvider) {
            this.tokenProvider = tokenProvider;
            return this;
        }

        public CardTokenPaymentRequested cryptogram(String cryptogram) {
            this.cryptogram = cryptogram;
            return this;
        }
    }

    @TypeAlias("Payments/Credit Line Merchant To Cardholder Payment Requested")
    @TypeBlueId("Payments-Credit-Line-Merchant-To-Cardholder-Payment-Requested-BlueId")
    public static class CreditLineMerchantToCardholderPaymentRequested extends PaymentRequested {
        public String creditLineId;
        public String merchantAccountId;
        public String cardholderAccountId;

        public CreditLineMerchantToCardholderPaymentRequested creditLineId(String creditLineId) {
            this.creditLineId = creditLineId;
            return this;
        }

        public CreditLineMerchantToCardholderPaymentRequested merchantAccountId(String merchantAccountId) {
            this.merchantAccountId = merchantAccountId;
            return this;
        }

        public CreditLineMerchantToCardholderPaymentRequested cardholderAccountId(String cardholderAccountId) {
            this.cardholderAccountId = cardholderAccountId;
            return this;
        }
    }

    @TypeAlias("Payments/Internal Ledger Transfer Requested")
    @TypeBlueId("Payments-Internal-Ledger-Transfer-Requested-BlueId")
    public static class InternalLedgerTransferRequested extends PaymentRequested {
        public String ledgerAccountFrom;
        public String ledgerAccountTo;
        public String memo;

        public InternalLedgerTransferRequested ledgerAccountFrom(String ledgerAccountFrom) {
            this.ledgerAccountFrom = ledgerAccountFrom;
            return this;
        }

        public InternalLedgerTransferRequested ledgerAccountTo(String ledgerAccountTo) {
            this.ledgerAccountTo = ledgerAccountTo;
            return this;
        }

        public InternalLedgerTransferRequested memo(String memo) {
            this.memo = memo;
            return this;
        }
    }

    @TypeAlias("Payments/Crypto Transfer Requested")
    @TypeBlueId("Payments-Crypto-Transfer-Requested-BlueId")
    public static class CryptoTransferRequested extends PaymentRequested {
        public String asset;
        public String chain;
        public String fromWalletRef;
        public String toAddress;
        public String txPolicy;

        public CryptoTransferRequested asset(String asset) {
            this.asset = asset;
            return this;
        }

        public CryptoTransferRequested chain(String chain) {
            this.chain = chain;
            return this;
        }

        public CryptoTransferRequested fromWalletRef(String fromWalletRef) {
            this.fromWalletRef = fromWalletRef;
            return this;
        }

        public CryptoTransferRequested toAddress(String toAddress) {
            this.toAddress = toAddress;
            return this;
        }

        public CryptoTransferRequested txPolicy(String txPolicy) {
            this.txPolicy = txPolicy;
            return this;
        }
    }

    @TypeAlias("PayNote/Backward Payment Requested")
    @TypeBlueId("PayNote-Backward-Payment-Requested-BlueId")
    public static class BackwardPaymentRequested extends PaymentRequested {
        public Node from;
        public Node to;
        public String reason;

        public BackwardPaymentRequested from(Node from) {
            this.from = from;
            return this;
        }

        public BackwardPaymentRequested to(Node to) {
            this.to = to;
            return this;
        }

        public BackwardPaymentRequested reason(String reason) {
            this.reason = reason;
            return this;
        }
    }
}
