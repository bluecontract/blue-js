# Document Processor parity target

This document pins the Java parity target to a specific `blue-js` revision to avoid a moving target.

## Target

- Repository: `https://github.com/bluecontract/blue-js`
- Package path: `libs/document-processor`
- Commit SHA: `bf9e1cfd200d35801d8237f7080895372c1572c6`
- Package version at target: `@blue-labs/document-processor@3.4.3`
- Pinned on: 2026-02-22

## Why pinned

`blue-js/main` evolves quickly. Parity is only measurable against a fixed commit.  
All Java parity checks and test mappings in this repository refer to this target revision.

## Running JS tests for the target

Environment requirements:

- Node.js >= 20
- pnpm

Commands:

```bash
git clone https://github.com/bluecontract/blue-js.git
cd blue-js
git checkout bf9e1cfd200d35801d8237f7080895372c1572c6
pnpm install
pnpm nx test document-processor
```

## Running Java tests for parity work

```bash
./gradlew test
```
