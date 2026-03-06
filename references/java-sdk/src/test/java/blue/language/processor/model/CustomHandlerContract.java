package blue.language.processor.model;

import blue.language.model.TypeBlueId;

@TypeBlueId("Custom.Handler")
public class CustomHandlerContract extends HandlerContract {

    private String config;

    public String getConfig() {
        return config;
    }

    public void setConfig(String config) {
        this.config = config;
    }
}
