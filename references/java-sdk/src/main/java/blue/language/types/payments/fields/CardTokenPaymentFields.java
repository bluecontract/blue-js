package blue.language.types.payments.fields;

public class CardTokenPaymentFields {
    public String networkToken;
    public String tokenProvider;
    public String cryptogram;

    public CardTokenPaymentFields networkToken(String networkToken) {
        this.networkToken = networkToken;
        return this;
    }

    public CardTokenPaymentFields tokenProvider(String tokenProvider) {
        this.tokenProvider = tokenProvider;
        return this;
    }

    public CardTokenPaymentFields cryptogram(String cryptogram) {
        this.cryptogram = cryptogram;
        return this;
    }
}
