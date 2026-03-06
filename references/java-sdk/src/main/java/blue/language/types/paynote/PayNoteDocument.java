package blue.language.types.paynote;

import blue.language.model.TypeBlueId;
import blue.language.types.TypeAlias;

@TypeAlias("PayNote/PayNote")
@TypeBlueId("CDMVLRyodD2WhScu2PPRgGquEArMNGXxvZCYiJXg2YjT")
public class PayNoteDocument {
    public String status;
    public String currency;
    public Amount amount;
    public PayNoteInitialStateDescription payNoteInitialStateDescription;

    public PayNoteDocument status(String status) {
        this.status = status;
        return this;
    }

    public PayNoteDocument currency(String currency) {
        this.currency = currency;
        return this;
    }

    public PayNoteDocument amount(Amount amount) {
        this.amount = amount;
        return this;
    }

    public PayNoteDocument payNoteInitialStateDescription(PayNoteInitialStateDescription description) {
        this.payNoteInitialStateDescription = description;
        return this;
    }

    public static final class Amount {
        public Integer total;
        public Integer reserved;
        public Integer captured;

        public Amount total(Integer total) {
            this.total = total;
            return this;
        }

        public Amount reserved(Integer reserved) {
            this.reserved = reserved;
            return this;
        }

        public Amount captured(Integer captured) {
            this.captured = captured;
            return this;
        }
    }

    public static final class PayNoteInitialStateDescription {
        public String summary;
        public String details;

        public PayNoteInitialStateDescription summary(String summary) {
            this.summary = summary;
            return this;
        }

        public PayNoteInitialStateDescription details(String details) {
            this.details = details;
            return this;
        }
    }
}
