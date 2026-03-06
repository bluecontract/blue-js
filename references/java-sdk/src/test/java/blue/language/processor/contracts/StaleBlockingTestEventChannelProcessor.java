package blue.language.processor.contracts;

import blue.language.model.Node;
import blue.language.processor.ChannelEvaluationContext;
import blue.language.processor.model.TestEventChannel;

/**
 * Test channel processor that marks every subsequent event as stale.
 */
public class StaleBlockingTestEventChannelProcessor extends TestEventChannelProcessor {

    @Override
    public boolean isNewerEvent(TestEventChannel contract, ChannelEvaluationContext context, Node lastEvent) {
        return false;
    }
}
