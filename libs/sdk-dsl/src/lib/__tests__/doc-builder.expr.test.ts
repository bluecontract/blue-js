/**
 * Java reference:
 * - references/java-sdk/src/main/java/blue/language/sdk/DocBuilder.java
 */
import { DocBuilder } from '../../index.js';

describe('DocBuilder.expr', () => {
  it('wraps raw expressions once', () => {
    expect(DocBuilder.expr("document('/x')")).toBe("${document('/x')}");
  });

  it('does not double-wrap already wrapped expressions', () => {
    expect(DocBuilder.expr("${document('/x')}")).toBe("${document('/x')}");
  });
});
