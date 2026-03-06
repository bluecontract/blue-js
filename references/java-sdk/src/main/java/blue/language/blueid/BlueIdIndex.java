package blue.language.blueid;

import java.util.Map;

public interface BlueIdIndex {

    String blueIdAt(String jsonPointer);

    Map<String, String> asMap();
}
