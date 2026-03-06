package blue.language.processor.model;

import blue.language.model.TypeBlueId;
import blue.language.processor.model.HandlerContract;

@TypeBlueId("DeriveChannelSetProperty")
public class DeriveChannelSetProperty extends HandlerContract {

    private String propertyKey;
    private int propertyValue;
    private String fallbackChannel;

    public String getPropertyKey() {
        return propertyKey;
    }

    public void setPropertyKey(String propertyKey) {
        this.propertyKey = propertyKey;
    }

    public int getPropertyValue() {
        return propertyValue;
    }

    public void setPropertyValue(int propertyValue) {
        this.propertyValue = propertyValue;
    }

    public String getFallbackChannel() {
        return fallbackChannel;
    }

    public void setFallbackChannel(String fallbackChannel) {
        this.fallbackChannel = fallbackChannel;
    }
}
