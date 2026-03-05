# Mapping Differences vs Java SDK DSL Audit Reference

This document records intentional or currently unresolved differences between this TypeScript port and the Java mapping audit.

## PayNote default participant channels

- **Java audit reference**:
  ```yaml
  contracts:
    payerChannel:
      type: Core/Channel
    payeeChannel:
      type: Core/Channel
    guarantorChannel:
      type: Core/Channel
  ```
- **TypeScript port**:
  ```yaml
  contracts:
    payerChannel:
      type: Conversation/Timeline Channel
      timelineId: payer-timeline
    payeeChannel:
      type: Conversation/Timeline Channel
      timelineId: payee-timeline
    guarantorChannel:
      type: Conversation/Timeline Channel
      timelineId: guarantor-timeline
  ```
- **Reason**:
  - Runtime execution tests against `@blue-labs/document-processor` failed with `Core/Channel`.
  - Timeline channel variants are executable with current registry support.

## Named-event helper emitted type

- **Java audit reference**:
  - `type: Common/Named Event`
- **TypeScript port**:
  - `type: Conversation/Event` + `name` + optional `payload`.
- **Reason**:
  - `Common/Named Event` alias is not present in the currently installed repository package.

