package blue.language.types.myos;

import blue.language.model.TypeBlueId;
import blue.language.types.TypeAlias;

@TypeAlias("MyOS/MyOS Session Link")
@TypeBlueId("d1vQ8ZTPcQc5KeuU6tzWaVukWRVtKjQL4hbvbpC22rB")
public class MyOsSessionLink {
    public String anchor;
    public String sessionId;

    public MyOsSessionLink anchor(String anchor) {
        this.anchor = anchor;
        return this;
    }

    public MyOsSessionLink sessionId(String sessionId) {
        this.sessionId = sessionId;
        return this;
    }
}
