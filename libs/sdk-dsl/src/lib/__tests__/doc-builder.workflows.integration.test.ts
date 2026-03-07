/**
 * Java reference:
 * - references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderGeneralDslParityTest.java
 * - references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderStepsDslParityTest.java
 */
import { BlueNode } from '@blue-labs/language';

import { DocBuilder } from '../../index.js';
import { createProcessorHarness } from '../../__tests__/support/processor-harness.js';

describe('DocBuilder workflow runtime integration', () => {
  it('onInit lifecycle workflow updates document state', async () => {
    const { processor } = createProcessorHarness();
    const document = DocBuilder.doc()
      .name('On init runtime')
      .onInit('initialize', (steps) =>
        steps.replaceValue('SetReady', '/status', 'ready'),
      )
      .buildDocument();

    const result = await processor.initializeDocument(document.clone());

    expect(result.capabilityFailure).toBe(false);
    expect(String(result.document.getProperties()?.status?.getValue())).toBe(
      'ready',
    );
  });

  it('onEvent reacts to a typed event and updates document state', async () => {
    const { processor } = createProcessorHarness();
    const document = DocBuilder.doc()
      .name('On event runtime')
      .onInit('emitNumber', (steps) =>
        steps.emitType('EmitTypedNumber', 'Integer', (event) =>
          event.addProperty('value', new BlueNode().setValue(7)),
        ),
      )
      .onEvent('whenNumber', 'Integer', (steps) =>
        steps.replaceValue('SetSeen', '/seen', true),
      )
      .buildDocument();

    const result = await processor.initializeDocument(document.clone());

    expect(result.capabilityFailure).toBe(false);
    expect(String(result.document.getProperties()?.seen?.getValue())).toBe(
      'true',
    );
  });

  it('onNamedEvent reacts to a named event and updates document state', async () => {
    const { processor } = createProcessorHarness();
    const document = DocBuilder.doc()
      .name('On named runtime')
      .onInit('emitNamed', (steps) => steps.namedEvent('EmitReady', 'READY'))
      .onNamedEvent('whenNamed', 'READY', (steps) =>
        steps.replaceValue('SetNamed', '/named', 'matched'),
      )
      .buildDocument();

    const result = await processor.initializeDocument(document.clone());

    expect(result.capabilityFailure).toBe(false);
    expect(String(result.document.getProperties()?.named?.getValue())).toBe(
      'matched',
    );
  });

  it('onDocChange reacts to a watched path update', async () => {
    const { processor } = createProcessorHarness();
    const document = DocBuilder.doc()
      .name('On doc change runtime')
      .onInit('initialize', (steps) =>
        steps.updateDocument('WriteWatched', (changeset) =>
          changeset.replaceValue('/watched', 1),
        ),
      )
      .onDocChange('whenWatchedChanges', '/watched', (steps) =>
        steps.replaceValue('SetObserved', '/observed', 'yes'),
      )
      .buildDocument();

    const result = await processor.initializeDocument(document.clone());

    expect(result.capabilityFailure).toBe(false);
    expect(String(result.document.getProperties()?.watched?.getValue())).toBe(
      '1',
    );
    expect(String(result.document.getProperties()?.observed?.getValue())).toBe(
      'yes',
    );
  });

  it('updateDocumentFromExpression applies a dynamic changeset', async () => {
    const { processor } = createProcessorHarness();
    const document = DocBuilder.doc()
      .name('Dynamic changeset runtime')
      .onInit('initialize', (steps) =>
        steps
          .jsRaw(
            'Compute',
            "return { nextChangeset: [{ op: 'replace', path: '/value', val: 9 }] };",
          )
          .updateDocumentFromExpression(
            'ApplyDynamic',
            'steps.Compute.nextChangeset',
          ),
      )
      .buildDocument();

    const result = await processor.initializeDocument(document.clone());

    expect(result.capabilityFailure).toBe(false);
    expect(String(result.document.getProperties()?.value?.getValue())).toBe(
      '9',
    );
  });

  it('bootstrapDocument emits the expected bootstrap request event', async () => {
    const { processor, blue } = createProcessorHarness();
    const child = new BlueNode().setName('Child').setType('Demo/Child');
    const document = DocBuilder.doc()
      .name('Bootstrap runtime')
      .onInit('bootstrap', (steps) =>
        steps.bootstrapDocument(
          'BootstrapChild',
          child,
          { participantA: 'aliceChannel' },
          (options) =>
            options.assignee('orchestratorChannel').defaultMessage('Welcome'),
        ),
      )
      .buildDocument();

    const result = await processor.initializeDocument(document.clone());

    expect(result.capabilityFailure).toBe(false);
    expect(result.triggeredEvents).toHaveLength(2);

    const bootstrapEvent =
      result.triggeredEvents.find(
        (event) =>
          event.getType()?.getBlueId() ===
          blue
            .yamlToNode('type: Conversation/Document Bootstrap Requested')
            .getType()
            ?.getBlueId(),
      ) ?? result.triggeredEvents[1];

    expect(String(bootstrapEvent.getProperties()?.document?.getName())).toBe(
      'Child',
    );
    expect(
      String(
        bootstrapEvent
          .getProperties()
          ?.channelBindings?.getProperties()
          ?.participantA?.getValue(),
      ),
    ).toBe('aliceChannel');
  });
});
