package blue.language.types.payments.fields;

public class CryptoPaymentFields {
    public String asset;
    public String chain;
    public String fromWalletRef;
    public String toAddress;
    public String txPolicy;

    public CryptoPaymentFields asset(String asset) {
        this.asset = asset;
        return this;
    }

    public CryptoPaymentFields chain(String chain) {
        this.chain = chain;
        return this;
    }

    public CryptoPaymentFields fromWalletRef(String fromWalletRef) {
        this.fromWalletRef = fromWalletRef;
        return this;
    }

    public CryptoPaymentFields toAddress(String toAddress) {
        this.toAddress = toAddress;
        return this;
    }

    public CryptoPaymentFields txPolicy(String txPolicy) {
        this.txPolicy = txPolicy;
        return this;
    }
}
