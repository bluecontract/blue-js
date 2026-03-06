package blue.language.snapshot;

import blue.language.blueid.BlueIdIndex;

import java.util.Objects;

public final class ResolvedSnapshot {

    private final FrozenNode canonicalRoot;
    private final FrozenNode resolvedRoot;
    private final String rootBlueId;
    private final BlueIdIndex blueIdsByPointer;

    public ResolvedSnapshot(FrozenNode canonicalRoot,
                            FrozenNode resolvedRoot,
                            String rootBlueId,
                            BlueIdIndex blueIdsByPointer) {
        this.canonicalRoot = Objects.requireNonNull(canonicalRoot, "canonicalRoot");
        this.resolvedRoot = Objects.requireNonNull(resolvedRoot, "resolvedRoot");
        this.rootBlueId = Objects.requireNonNull(rootBlueId, "rootBlueId");
        this.blueIdsByPointer = Objects.requireNonNull(blueIdsByPointer, "blueIdsByPointer");
    }

    public FrozenNode canonicalRoot() {
        return canonicalRoot;
    }

    public FrozenNode resolvedRoot() {
        return resolvedRoot;
    }

    public String rootBlueId() {
        return rootBlueId;
    }

    public BlueIdIndex blueIdsByPointer() {
        return blueIdsByPointer;
    }
}
