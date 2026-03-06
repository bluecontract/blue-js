package blue.language.types.payments.fields;

public class LedgerPaymentFields {
    public String ledgerAccountFrom;
    public String ledgerAccountTo;
    public String memo;

    public LedgerPaymentFields ledgerAccountFrom(String ledgerAccountFrom) {
        this.ledgerAccountFrom = ledgerAccountFrom;
        return this;
    }

    public LedgerPaymentFields ledgerAccountTo(String ledgerAccountTo) {
        this.ledgerAccountTo = ledgerAccountTo;
        return this;
    }

    public LedgerPaymentFields memo(String memo) {
        this.memo = memo;
        return this;
    }
}
