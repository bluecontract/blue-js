import { BUILTIN_RUNTIME_TYPE_CONTENT_BY_BLUE_ID } from '@blue-labs/language';

import { blueIds } from '../../repository/semantic-repository.js';
import { BLUE_CONTRACTS_1_0_FIXTURE_PACKAGE_IDENTITY } from '../../conformance/BlueContractsConformanceReport.js';
import { fixturePackageIdentityMatchesFixtureFiles } from '../../conformance/BlueContractsConformanceSuiteRunner.js';
import {
  KEY_CHECKPOINT,
  KEY_EMBEDDED,
  KEY_INITIALIZED,
  KEY_TERMINATED,
  ProcessorContractConstants,
  PROCESSOR_MANAGED_CHANNEL_BLUE_IDS,
  RESERVED_CONTRACT_KEYS,
  isProcessorManagedChannelBlueId,
  isReservedContractKey,
} from '../processor-contract-constants.js';
import {
  RELATIVE_CHECKPOINT,
  RELATIVE_CONTRACTS,
  RELATIVE_EMBEDDED,
  RELATIVE_INITIALIZED,
  RELATIVE_TERMINATED,
  relativeCheckpointLastEvent,
  relativeContractsEntry,
} from '../processor-pointer-constants.js';

describe('processor constants', () => {
  it('exposes reserved contract keys', () => {
    expect(
      [...RESERVED_CONTRACT_KEYS].sort((a, b) => a.localeCompare(b)),
    ).toEqual([KEY_CHECKPOINT, KEY_EMBEDDED, KEY_INITIALIZED, KEY_TERMINATED]);
  });

  it('checks reserved contract keys', () => {
    expect(isReservedContractKey(KEY_EMBEDDED)).toBe(true);
    expect(isReservedContractKey('custom')).toBe(false);
  });

  it('checks processor-managed channel blue ids', () => {
    expect(
      isProcessorManagedChannelBlueId(blueIds['Lifecycle Event Channel']),
    ).toBe(true);
    expect(isProcessorManagedChannelBlueId('CustomChannel')).toBe(false);
  });

  it('provides pointer constants', () => {
    expect(RELATIVE_CONTRACTS).toBe('/contracts');
    expect(RELATIVE_INITIALIZED).toBe(`/contracts/${KEY_INITIALIZED}`);
    expect(RELATIVE_TERMINATED).toBe(`/contracts/${KEY_TERMINATED}`);
    expect(RELATIVE_EMBEDDED).toBe(`/contracts/${KEY_EMBEDDED}`);
    expect(RELATIVE_CHECKPOINT).toBe(`/contracts/${KEY_CHECKPOINT}`);
  });

  it('builds pointer helpers', () => {
    expect(relativeContractsEntry('foo')).toBe('/contracts/foo');
    expect(relativeCheckpointLastEvent('checkpoint', 'channel')).toBe(
      '/contracts/checkpoint/lastEvents/channel',
    );
  });

  it('keeps legacy namespace compatibility object for ease of porting', () => {
    expect(ProcessorContractConstants.KEY_EMBEDDED).toBe(KEY_EMBEDDED);
    expect(Array.from(PROCESSOR_MANAGED_CHANNEL_BLUE_IDS)).not.toContain(
      ProcessorContractConstants.KEY_EMBEDDED,
    );
  });

  it('runtimeRegistryResourcesUsePublishedBlueIds', () => {
    for (const [publishedBlueId, content] of Object.entries(
      BUILTIN_RUNTIME_TYPE_CONTENT_BY_BLUE_ID,
    )) {
      expect(blueIds[String(content.name)]).toBe(publishedBlueId);
    }
  });

  it('runtimeRegistryManifestFixtureIdentityMatchesOfficialIdentity', () => {
    expect(BLUE_CONTRACTS_1_0_FIXTURE_PACKAGE_IDENTITY).toBe(
      'sha256:2f197ca3bbdc41b75e772777cc48e51019754347e1bee26b5f3209b71d9bd9ca',
    );
    expect(fixturePackageIdentityMatchesFixtureFiles()).toBe(true);
  });

  it('processorRuntimeRecognitionUsesRegistryBlueIdsOnly', () => {
    expect(PROCESSOR_MANAGED_CHANNEL_BLUE_IDS).toEqual(
      new Set([
        blueIds['Document Update Channel'],
        blueIds['Triggered Event Channel'],
        blueIds['Lifecycle Event Channel'],
        blueIds['Embedded Node Channel'],
      ]),
    );
  });
});
