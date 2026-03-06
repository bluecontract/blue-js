package blue.language.snapshot;

import blue.language.Blue;
import blue.language.blueid.BlueIdIndex;
import blue.language.blueid.BlueIdTreeHasher;
import blue.language.model.Node;

import java.util.Objects;

public final class SnapshotFactory {

    public ResolvedSnapshot fromAuthoring(Blue blue, Node authoring) {
        Objects.requireNonNull(blue, "blue");
        Objects.requireNonNull(authoring, "authoring");

        Node preprocessed = blue.preprocess(authoring.clone());
        Node resolved = blue.resolve(preprocessed);
        Node canonical = blue.reverse(resolved.clone());
        return buildSnapshot(canonical, resolved);
    }

    public ResolvedSnapshot fromResolved(Blue blue, Node resolved, SnapshotTrust trust) {
        Objects.requireNonNull(blue, "blue");
        Objects.requireNonNull(resolved, "resolved");
        Objects.requireNonNull(trust, "trust");

        Node resolvedNode = trust == SnapshotTrust.BLIND_TRUST_RESOLVED
                ? resolved
                : blue.resolve(resolved.clone());
        Node canonical = blue.reverse(resolvedNode.clone());
        return buildSnapshot(canonical, resolvedNode);
    }

    private ResolvedSnapshot buildSnapshot(Node canonical, Node resolved) {
        BlueIdTreeHasher.BlueIdTreeHashResult hashResult = BlueIdTreeHasher.hashAndIndex(canonical);
        String rootBlueId = hashResult.rootBlueId();
        BlueIdIndex index = hashResult.index();
        return new ResolvedSnapshot(
                FrozenNode.fromNode(canonical),
                FrozenNode.fromNode(resolved),
                rootBlueId,
                index
        );
    }

}
