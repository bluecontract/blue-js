package blue.language.processor.model;

import blue.language.model.TypeBlueId;
import blue.language.processor.model.ChannelContract;

@TypeBlueId("RecencyTestChannel")
public class RecencyTestChannel extends ChannelContract {

    private Integer minDelta;

    public Integer getMinDelta() {
        return minDelta;
    }

    public void setMinDelta(Integer minDelta) {
        this.minDelta = minDelta;
    }
}
