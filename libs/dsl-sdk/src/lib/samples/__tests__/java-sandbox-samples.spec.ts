import { describe, expect, it } from 'vitest';
import { toOfficialJson, toOfficialYaml } from '../../core/serialization.js';
import {
  allJavaSandboxSampleDocs,
  linkedAccessMonitor,
  milestoneReservePartialCapture,
  orchestratorWithAccessAndAgency,
  reserveOnApprovalThenCaptureOnConfirmation,
  reserveLockedUntilKycThenCaptureOnSettlement,
  shipmentEscrowSimple,
} from '../java-sandbox-samples.js';

function contractsOf(
  document: ReturnType<typeof toOfficialJson>,
): Record<string, { request?: unknown }> {
  return document.contracts as Record<string, { request?: unknown }>;
}

describe('java sandbox sample representations', () => {
  it('builds all non-IPFS sample document representations', () => {
    const docs = allJavaSandboxSampleDocs();
    const keys = Object.keys(docs);
    expect(keys.length).toBe(26);
    expect(keys).toContain('simpleAgentWithPermissions');
    expect(keys).toContain('bootstrapVoucherOnCapture');
    expect(keys).toContain('balancedBowlVoucherPayNoteTemplate');
  });

  it('captures orchestrator interaction DSL parity constructs', () => {
    const yaml = toOfficialYaml(orchestratorWithAccessAndAgency());
    expect(yaml).toContain('catalogSessionId');
    expect(yaml).toContain(
      'type: MyOS/Single Document Permission Grant Requested',
    );
    expect(yaml).toContain(
      'type: MyOS/Worker Agency Permission Grant Requested',
    );
    expect(yaml).toContain('operation: provideInstructions');
  });

  it('captures linked access link configuration constructs', () => {
    const yaml = toOfficialYaml(linkedAccessMonitor());
    expect(yaml).toContain('requestId: REQ_LINKED_PROJECTDATA');
    expect(yaml).toContain('invoices');
    expect(yaml).toContain('shipments');
  });

  it('captures paynote escrow and release cookbook flows', () => {
    const shipmentYaml = toOfficialYaml(shipmentEscrowSimple());
    const kycYaml = toOfficialYaml(
      reserveLockedUntilKycThenCaptureOnSettlement(),
    );
    expect(shipmentYaml).toContain(
      'PayNote/Card Transaction Capture Lock Requested',
    );
    expect(shipmentYaml).toContain(
      'PayNote/Card Transaction Capture Unlock Requested',
    );
    expect(kycYaml).toContain('PayNote/Reserve Funds Requested');
    expect(kycYaml).toContain('PayNote/Capture Funds Requested');
  });

  it('keeps operation-triggered paynote sample branches requestless at contract level', () => {
    const approvalJson = toOfficialJson(
      reserveOnApprovalThenCaptureOnConfirmation(),
    );
    const milestoneJson = toOfficialJson(milestoneReservePartialCapture());
    const approvalContracts = contractsOf(approvalJson);
    const milestoneContracts = contractsOf(milestoneJson);

    expect(approvalContracts.confirmDelivery?.request).toBeUndefined();
    expect(approvalContracts.requestCapture?.request).toBeUndefined();
    expect(milestoneContracts.approveMilestone1?.request).toBeUndefined();
    expect(milestoneContracts.releaseUnfinishedWork?.request).toBeUndefined();
  });
});
