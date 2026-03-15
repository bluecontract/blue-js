import {
  allJavaSandboxSampleDocs,
  BlueChangeCompiler,
  DocPatch,
  DocStructure,
} from '../index.js';
import { assertCanonicalNodeEquals } from '../test-support/editing-support.js';

describe('canonical blueprints', () => {
  it('keep exported sample documents structurally stable and editable', () => {
    const samples = allJavaSandboxSampleDocs();

    expect(Object.keys(samples).length).toBeGreaterThan(5);

    for (const [sampleKey, document] of Object.entries(samples)) {
      const structure = DocStructure.from(document);
      const summary = structure.toSummaryJson();
      const rebuilt = DocStructure.from(summary);
      const plan = BlueChangeCompiler.compile(document, document.clone());

      expect(rebuilt.toSummaryJson()).toEqual(summary);
      expect(plan.rootChanges).toEqual([]);
      expect(plan.contractChanges).toEqual([]);
      assertCanonicalNodeEquals(DocPatch.from(document).apply(), document);
      expect(structure.toPromptText()).toContain('Document:');
      expect(summary.contracts.length).toBeGreaterThan(0);
      expect(sampleKey.length).toBeGreaterThan(0);
    }
  });
});
