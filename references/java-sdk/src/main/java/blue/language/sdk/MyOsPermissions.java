package blue.language.sdk;

import blue.language.Blue;
import blue.language.model.Node;

import java.util.ArrayList;
import java.util.List;

public final class MyOsPermissions {

    private static final Blue BLUE = new Blue();

    public Boolean read;
    public Boolean write;
    public Boolean allOps;
    public List<String> singleOps;

    private MyOsPermissions() {
        this.singleOps = new ArrayList<String>();
    }

    public static MyOsPermissions create() {
        return new MyOsPermissions();
    }

    public MyOsPermissions read(boolean value) {
        this.read = value;
        return this;
    }

    public MyOsPermissions write(boolean value) {
        this.write = value;
        return this;
    }

    public MyOsPermissions allOps(boolean value) {
        this.allOps = value;
        return this;
    }

    public MyOsPermissions singleOps(String... operations) {
        this.singleOps = new ArrayList<String>();
        if (operations != null) {
            for (String operation : operations) {
                if (operation == null || operation.trim().isEmpty()) {
                    continue;
                }
                this.singleOps.add(operation.trim());
            }
        }
        return this;
    }

    public Node build() {
        return BLUE.objectToNode(this);
    }
}
