package blue.language.processor.types;

import java.util.Objects;
import java.util.function.Function;

/**
 * Immutable functional result type mirroring JS Result helpers.
 */
public final class Result<T, E> {
    private final boolean ok;
    private final T value;
    private final E error;

    private Result(boolean ok, T value, E error) {
        this.ok = ok;
        this.value = value;
        this.error = error;
    }

    public static <T, E> Result<T, E> ok(T value) {
        return new Result<T, E>(true, value, null);
    }

    public static <T, E> Result<T, E> err(E error) {
        return new Result<T, E>(false, null, error);
    }

    public boolean isOk() {
        return ok;
    }

    public boolean isErr() {
        return !ok;
    }

    public T value() {
        if (!ok) {
            throw new IllegalStateException("Result is Err");
        }
        return value;
    }

    public E error() {
        if (ok) {
            throw new IllegalStateException("Result is Ok");
        }
        return error;
    }

    public <U> Result<U, E> map(Function<? super T, ? extends U> mapper) {
        Objects.requireNonNull(mapper, "mapper");
        if (ok) {
            return Result.ok(mapper.apply(value));
        }
        @SuppressWarnings("unchecked")
        Result<U, E> same = (Result<U, E>) this;
        return same;
    }

    public <F> Result<T, F> mapErr(Function<? super E, ? extends F> mapper) {
        Objects.requireNonNull(mapper, "mapper");
        if (ok) {
            @SuppressWarnings("unchecked")
            Result<T, F> same = (Result<T, F>) this;
            return same;
        }
        return Result.err(mapper.apply(error));
    }

    public <U> Result<U, E> andThen(Function<? super T, Result<U, E>> mapper) {
        Objects.requireNonNull(mapper, "mapper");
        if (ok) {
            return mapper.apply(value);
        }
        @SuppressWarnings("unchecked")
        Result<U, E> same = (Result<U, E>) this;
        return same;
    }

    public T unwrapOr(T fallback) {
        return ok ? value : fallback;
    }

    public T unwrapOrElse(Function<? super E, ? extends T> getFallback) {
        Objects.requireNonNull(getFallback, "getFallback");
        return ok ? value : getFallback.apply(error);
    }

    public <U> U match(Function<? super T, ? extends U> okHandler,
                       Function<? super E, ? extends U> errHandler) {
        Objects.requireNonNull(okHandler, "okHandler");
        Objects.requireNonNull(errHandler, "errHandler");
        return ok ? okHandler.apply(value) : errHandler.apply(error);
    }
}
