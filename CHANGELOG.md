## 1.26.0 (2025-07-17)

### 🚀 Features

- add node extension and repository definitions support ([632774f](https://github.com/bluecontract/blue-js/commit/632774f))
- implement repository definitions support in Blue class ([f529df1](https://github.com/bluecontract/blue-js/commit/f529df1))
- implement node merging system with comprehensive processors ([b3fb721](https://github.com/bluecontract/blue-js/commit/b3fb721))
- add preprocessing support for repository contents ([005c819](https://github.com/bluecontract/blue-js/commit/005c819))
- enhance Blue class with merging processor integration ([9a0d7e2](https://github.com/bluecontract/blue-js/commit/9a0d7e2))

### 🩹 Fixes

- sanitize events from isolated-vm using deep clone ([5bf56ec](https://github.com/bluecontract/blue-js/commit/5bf56ec))

## 1.25.0 (2025-07-15)

### 🚀 Features

- **Node:** add methods to remove properties and contracts ([4e387a5](https://github.com/bluecontract/blue-js/commit/4e387a5))
- **document-processor:** Refactor event payloads to use BlueNode ([4111099](https://github.com/bluecontract/blue-js/commit/4111099))

## 1.24.3 (2025-07-02)

### 🩹 Fixes

- update dependencies and add peer dependencies for document-processor ([cb1fdbb](https://github.com/bluecontract/blue-js/commit/cb1fdbb))

## 1.24.2 (2025-07-01)

### 🩹 Fixes

- use _def.typeName instead of constructor.name for zod schema types ([e71834b](https://github.com/bluecontract/blue-js/commit/e71834b))

## 1.24.1 (2025-06-30)

### 🩹 Fixes

- improve node crypto checks in CryptoEnvironment ([f89b3bb](https://github.com/bluecontract/blue-js/commit/f89b3bb))

## 1.24.0 (2025-06-24)

### 🚀 Features

- enhance OperationProcessor and add comprehensive tests ([9ba1698](https://github.com/bluecontract/blue-js/commit/9ba1698))
- use real "Initialized Marker" and "Lifecycle Event Channel" types ([b8cde04](https://github.com/bluecontract/blue-js/commit/b8cde04))
- throw error if document is not initialized ([e409e8c](https://github.com/bluecontract/blue-js/commit/e409e8c))

## 1.23.0 (2025-06-10)

### 🚀 Features

- add tests for BlueDocumentProcessor and enhance UpdateDocumentExecutor ([f679c69](https://github.com/bluecontract/blue-js/commit/f679c69))
- update type repositories and refactor timeline event structure ([31208dc](https://github.com/bluecontract/blue-js/commit/31208dc))
- implement document update event factory and refactor UpdateDocumentExecutor ([a3bc119](https://github.com/bluecontract/blue-js/commit/a3bc119))
- add LifecycleEventChannelProcessor and enhance document initialization ([65377b8](https://github.com/bluecontract/blue-js/commit/65377b8))
- introduce Initialized Marker functionality and enhance document processing ([36c7060](https://github.com/bluecontract/blue-js/commit/36c7060))
- add ESLint configuration for document processor and update package-lock ([eb4df9d](https://github.com/bluecontract/blue-js/commit/eb4df9d))

### 🩹 Fixes

- update import path for mockBlueIds in InitializedMarkerProcessor ([4b9d9ba](https://github.com/bluecontract/blue-js/commit/4b9d9ba))

## 1.22.0 (2025-06-09)

### 🚀 Features

- migrate to @blue-repository packages and adopt `timeline` event field ([1d8664a](https://github.com/bluecontract/blue-js/commit/1d8664a))

### 🩹 Fixes

- enhance Vite configuration to handle optional dependencies ([3e95e72](https://github.com/bluecontract/blue-js/commit/3e95e72))

## 1.21.1 (2025-06-09)

### 🩹 Fixes

- update dependencies and improve Vite configuration ([d2f2602](https://github.com/bluecontract/blue-js/commit/d2f2602))

## 1.21.0 (2025-06-09)

### 🚀 Features

- generate document-processor library ([0a0ce70](https://github.com/bluecontract/blue-js/commit/0a0ce70))
- move processor to document-processor library ([075d4d7](https://github.com/bluecontract/blue-js/commit/075d4d7))

## 1.20.0 (2025-06-06)

### 🚀 Features

- rename libraries to `@blue-labs` ([29273b6](https://github.com/bluecontract/blue-js/commit/29273b6))

## 1.19.0 (2025-06-05)

### 🚀 Features

- add operation processing capabilities with SequentialWorkflowOperationProcessor ([7e8ecb7](https://github.com/bluecontract/blue-js/commit/7e8ecb7))

## 1.18.0 (2025-06-03)

### 🚀 Features

- implement deepContains utility for nested object matching ([5f13ae3](https://github.com/bluecontract/blue-js/commit/5f13ae3))

## 1.17.0 (2025-06-03)

### 🚀 Features

- add MyOSAgentChannelProcessor and related schemas ([d52e793](https://github.com/bluecontract/blue-js/commit/d52e793))

### 🩹 Fixes

- update import paths for blueNodeField in MyOSAgent schemas ([95cfab1](https://github.com/bluecontract/blue-js/commit/95cfab1))

## 1.16.0 (2025-05-30)

### 🚀 Features

- Enhance Node and NodePathAccessor with improved type handling and comprehensive tests ([8fee10e](https://github.com/bluecontract/blue-js/commit/8fee10e))
- implement BlueIds mapping functionality in Preprocessor ([7ece792](https://github.com/bluecontract/blue-js/commit/7ece792))
- enhance JSON conversion strategy for BlueNode ([a145872](https://github.com/bluecontract/blue-js/commit/a145872))

### 🩹 Fixes

- update emitted events to use EventNodePayload ([dd1a5cd](https://github.com/bluecontract/blue-js/commit/dd1a5cd))

## 1.15.0 (2025-05-28)

### 🚀 Features

- Enhance ESLint configuration and add comprehensive tests for BlueDocumentProcessor ([50e2513](https://github.com/bluecontract/blue-js/commit/50e2513))
- Introduce CompositeTimelineChannelProcessor and enhance timeline handling ([a8a6e35](https://github.com/bluecontract/blue-js/commit/a8a6e35))

## 1.14.0 (2025-05-27)

### 🚀 Features

- Add peer dependency and new utility method in Blue class ([4764331](https://github.com/bluecontract/blue-js/commit/4764331))

## 1.13.0 (2025-05-27)

### 🚀 Features

- Add contracts management to BlueNode and related classes ([356a7a0](https://github.com/bluecontract/blue-js/commit/356a7a0))
- Implement BlueNode patching utility and enhance NodePathAccessor ([61d48c9](https://github.com/bluecontract/blue-js/commit/61d48c9))
- Enhance applyBlueNodePatch to support cloning and return modified nodes ([e3650d5](https://github.com/bluecontract/blue-js/commit/e3650d5))
- Enhance contract handling in converters and utilities ([349b8a6](https://github.com/bluecontract/blue-js/commit/349b8a6))
- Update project configurations and dependencies for improved functionality ([5f03cba](https://github.com/bluecontract/blue-js/commit/5f03cba))
- Add core schemas and blue-ids for language library ([6e0741f](https://github.com/bluecontract/blue-js/commit/6e0741f))
- Implement BlueDocumentProcessor and related utilities for document processing ([8c61060](https://github.com/bluecontract/blue-js/commit/8c61060))
- Enhance Blue processing capabilities with new document processors and schema updates ([4099509](https://github.com/bluecontract/blue-js/commit/4099509))

## 1.12.0 (2025-04-22)

### 🚀 Features

- Refactor BlueId calculation methods for improved flexibility and performance ([73bde17](https://github.com/bluecontract/blue-js/commit/73bde17))

## 1.11.0 (2025-04-22)

### 🚀 Features

- Introduce NodeProvider and enhance Blue class ([93166f7](https://github.com/bluecontract/blue-js/commit/93166f7))
- Implement preprocessing functionality in Blue class ([63068b6](https://github.com/bluecontract/blue-js/commit/63068b6))
- Introduced NodeExtender class for resolving node references and extending nodes with their properties ([b5fc472](https://github.com/bluecontract/blue-js/commit/b5fc472))
- Implement BaseContentNodeProvider and InMemoryNodeProvider for enhanced node management ([043abc5](https://github.com/bluecontract/blue-js/commit/043abc5))
- Add UrlNodeProvider for fetching nodes from URLs ([89ee46f](https://github.com/bluecontract/blue-js/commit/89ee46f))
- Refactor Blue class to use UrlContentFetcher and BlueDirectivePreprocessor ([9e91b82](https://github.com/bluecontract/blue-js/commit/9e91b82))
- Enhance URL fetching capabilities in Blue and UrlContentFetcher ([52a935a](https://github.com/bluecontract/blue-js/commit/52a935a))

## 1.10.0 (2025-02-21)

### 🚀 Features

- Add support for Zod tuple type conversion ([d248bb5](https://github.com/bluecontract/blue-js/commit/d248bb5))

## 1.9.0 (2025-02-10)

### 🚀 Features

- **language:** add node to object mapping with zod schemas ([4fa84b7](https://github.com/bluecontract/blue-js/commit/4fa84b7))

## 1.8.0 (2024-12-10)

### 🚀 Features

- init app-sdk libs ([305bd57](https://github.com/bluecontract/blue-js/commit/305bd57))
- core features ([ac9e0fc](https://github.com/bluecontract/blue-js/commit/ac9e0fc))
- implement logger ([310ee70](https://github.com/bluecontract/blue-js/commit/310ee70))
- Enhance logging and message validation in AppSDK ([083dd9a](https://github.com/bluecontract/blue-js/commit/083dd9a))
- Implement method call functionality in AppSDK ([3edb999](https://github.com/bluecontract/blue-js/commit/3edb999))
- Add initial pathname handling for route changes ([19ab4fb](https://github.com/bluecontract/blue-js/commit/19ab4fb))
- Enhance iframe resizing mechanism ([eee6c50](https://github.com/bluecontract/blue-js/commit/eee6c50))
- **app-sdk:** implement core messaging and API infrastructure ([25e90dd](https://github.com/bluecontract/blue-js/commit/25e90dd))
- **app-sdk:** Add method decorators and API client infrastructure ([a0518d0](https://github.com/bluecontract/blue-js/commit/a0518d0))
- **app-sdk:** add SDK dependency injection and improve documentation ([0246ca0](https://github.com/bluecontract/blue-js/commit/0246ca0))

### 🩹 Fixes

- **host-sdk:** send initialPathname only on first connection ([4e7b971](https://github.com/bluecontract/blue-js/commit/4e7b971))

## 1.7.0 (2024-11-08)

### 🚀 Features

- **contract:** add subscriptions field to Contract interface ([51877aa](https://github.com/bluecontract/blue-js/commit/51877aa))
- **language:** add benchmarking tools for BlueId calculation ([e4ea768](https://github.com/bluecontract/blue-js/commit/e4ea768))

### 🩹 Fixes

- **BlueIdCalculator:** improve performance of hash computation algorithm ([198fc71](https://github.com/bluecontract/blue-js/commit/198fc71))

## 1.6.2 (2024-11-05)

### 🩹 Fixes

- update package.json type declarations for better Node.js compatibility ([60c97d8](https://github.com/bluecontract/blue-js/commit/60c97d8))

## 1.6.1 (2024-11-05)

### 🩹 Fixes

- resolve build and ESLint configuration issues ([35f2ff4](https://github.com/bluecontract/blue-js/commit/35f2ff4))

## 1.6.0 (2024-10-31)


### 🚀 Features

- optimize blueId calculation and base58 handling ([a6fa814](https://github.com/bluecontract/blue-js/commit/a6fa814))

## 1.5.0 (2024-10-24)


### 🚀 Features

- **contract:** add workflow step types and JSON patch functionality ([5aab76f](https://github.com/bluecontract/blue-js/commit/5aab76f))

### 🩹 Fixes

- timeline entry schema ([1d842ab](https://github.com/bluecontract/blue-js/commit/1d842ab))

## 1.4.0 (2024-10-21)


### 🚀 Features

- **contract:** Add Timeline Blue IDs and update InitialTimelineBlueMessage ([c21f902](https://github.com/bluecontract/blue-js/commit/c21f902))

## 1.3.0 (2024-10-17)


### 🚀 Features

- **blue-id:** add synchronous Blue ID calculation ([2331871](https://github.com/bluecontract/blue-js/commit/2331871))

### 🩹 Fixes

- **language:** add js-sha256 to language dependencies ([865b480](https://github.com/bluecontract/blue-js/commit/865b480))

## 1.2.0 (2024-10-16)


### 🚀 Features

- **contract:** update Blue IDs and add new Chess-related types ([8012a5a](https://github.com/bluecontract/blue-js/commit/8012a5a))
- **contract:** update schema for contract actions and timeline entries ([c0dc5fa](https://github.com/bluecontract/blue-js/commit/c0dc5fa))
- **language:** add number value support to BlueObject ([ae930ac](https://github.com/bluecontract/blue-js/commit/ae930ac))

## 1.1.0 (2024-10-11)


### 🚀 Features

- **language,utils:** Add BaseBlueObjectWithId type and JSON type predicates ([2a9a231](https://github.com/bluecontract/blue-js/commit/2a9a231))

## 1.0.1 (2024-10-09)


### 🩹 Fixes

- lint command ([21afec4](https://github.com/bluecontract/blue-js/commit/21afec4))
- **language:** replace multiformats with @aws-crypto/sha256-universal and base32.js ([1f3b76e](https://github.com/bluecontract/blue-js/commit/1f3b76e))

# 1.0.0 (2024-10-09)


### 🚀 Features

- ⚠️  **language:** overhaul BlueId calculation and CID conversion ([0bd76bb](https://github.com/bluecontract/blue-js/commit/0bd76bb))

### 🩹 Fixes

- **language:** update external dependency handling in rollup config ([b0a1a87](https://github.com/bluecontract/blue-js/commit/b0a1a87))

#### ⚠️  Breaking Changes

- **language:** Fundamentally altered how BlueIdCalculator generates BlueIds

## 0.17.0 (2024-10-02)


### 🚀 Features

- **chess:** Add ChessMove schema and Zod validation ([dadf68c](https://github.com/bluecontract/blue-js/commit/dadf68c))
- **contract:** Add Chess blue IDs and update TimelineEntry schema ([a6005c6](https://github.com/bluecontract/blue-js/commit/a6005c6))

## 0.16.0 (2024-09-26)


### 🚀 Features

- **contract:** make id and actualTask properties optional ([d89038b](https://github.com/bluecontract/blue-js/commit/d89038b))

## 0.15.0 (2024-09-26)


### 🚀 Features

- **json:** add jsonTraverse function and update jsonTraverseAndFind ([949d99c](https://github.com/bluecontract/blue-js/commit/949d99c))

### 🩹 Fixes

- **BlueIdCalculator:** refine error message for undefined cleaned object ([fa42412](https://github.com/bluecontract/blue-js/commit/fa42412))
- **language:** update ESLint and Vite configurations ([274aa13](https://github.com/bluecontract/blue-js/commit/274aa13))

## 0.14.0 (2024-09-25)


### 🚀 Features

- **language:** changes according to the new version of language-java ([720c683](https://github.com/bluecontract/blue-js/commit/720c683))

## 0.13.0 (2024-09-25)


### 🚀 Features

- **contract:** Add Blink message types and utility functions ([a45612b](https://github.com/bluecontract/blue-js/commit/a45612b))

## 0.12.0 (2024-09-16)


### 🚀 Features

- Update timeline and contract schemas ([af80ec6](https://github.com/bluecontract/blue-js/commit/af80ec6))

## 0.11.0 (2024-09-12)


### 🚀 Features

- **contract:** Add participant utility functions ([1ac074f](https://github.com/bluecontract/blue-js/commit/1ac074f))

## 0.10.0 (2024-09-12)


### 🚀 Features

- **contract:** Add ChessContract and TaskContract schemas ([69310ae](https://github.com/bluecontract/blue-js/commit/69310ae))
- **contractInstance:** Add processingState parsing with localContractInstances ([dc0517c](https://github.com/bluecontract/blue-js/commit/dc0517c))

## 0.9.1 (2024-09-09)


### 🩹 Fixes

- **contract:** update ActionByParticipantEvent schema ([e8f0c68](https://github.com/bluecontract/blue-js/commit/e8f0c68))

## 0.9.0 (2024-08-30)


### 🚀 Features

- Add ts-to-zod dependency, generate schema based on interfaces, helpers for participant, workflow and contract instance parser ([039b284](https://github.com/bluecontract/blue-js/commit/039b284))
- ContractChess and Messaging part in contract ([7e90c00](https://github.com/bluecontract/blue-js/commit/7e90c00))
- InitialTimelineBlueMessage schema ([752d635](https://github.com/bluecontract/blue-js/commit/752d635))
- generate schema based on ts files ([3099d8d](https://github.com/bluecontract/blue-js/commit/3099d8d))

### 🩹 Fixes

- treat trigger as a unknown blue object ([bea4238](https://github.com/bluecontract/blue-js/commit/bea4238))

## 0.8.0 (2024-08-05)


### 🚀 Features

- update NodeToObject ([18afed3](https://github.com/bluecontract/blue-js/commit/18afed3))
- changes according to new version of blue-language-java ([e8091c3](https://github.com/bluecontract/blue-js/commit/e8091c3))
- handle blueId in NodePathAccessor ([81b787c](https://github.com/bluecontract/blue-js/commit/81b787c))
- use Number.MIN_SAFE_INTEGER and Number.MAX_SAFE_INTEGER ([a0514b6](https://github.com/bluecontract/blue-js/commit/a0514b6))
- handle BigDecimal and BigInteger separately ([e00b80c](https://github.com/bluecontract/blue-js/commit/e00b80c))
- changes in BlueIds class ([3992696](https://github.com/bluecontract/blue-js/commit/3992696))

## 0.7.1 (2024-07-18)


### 🩹 Fixes

- Base58 decode (issue with BlueIdToCid) ([fc59b8c](https://github.com/bluecontract/blue-js/commit/fc59b8c))

## 0.7.0 (2024-07-15)


### 🚀 Features

- enrichWithBlueId function ([b8b242e](https://github.com/bluecontract/blue-js/commit/b8b242e))

### 🩹 Fixes

- tsc command for contract ([fe9372b](https://github.com/bluecontract/blue-js/commit/fe9372b))

## 0.6.0 (2024-07-09)


### 🚀 Features

- getBlueObjectTypeName -> getBlueObjectTypeLabel ([7075350](https://github.com/bluecontract/blue-js/commit/7075350))
- json utils module ([44ef45e](https://github.com/bluecontract/blue-js/commit/44ef45e))
- move numbers utils to shared ([b4f77bf](https://github.com/bluecontract/blue-js/commit/b4f77bf))

### 🩹 Fixes

- add zod to shared-utils as a dep ([2f85e45](https://github.com/bluecontract/blue-js/commit/2f85e45))

## 0.5.1 (2024-07-09)


### 🩹 Fixes

- shared-utils dependency ([4adab1c](https://github.com/bluecontract/blue-js/commit/4adab1c))

## 0.5.0 (2024-07-09)


### 🚀 Features

- add more utils ([aea9591](https://github.com/bluecontract/blue-js/commit/aea9591))

## 0.4.0 (2024-07-08)


### 🚀 Features

- calculateBlueId take a JsonBlueValue as a param and add test case for empty document in NodeDeserializer test ([b821805](https://github.com/bluecontract/blue-js/commit/b821805))
- init shared utils ([d68daab](https://github.com/bluecontract/blue-js/commit/d68daab))
- init @blue-company/contract ([9c37cd9](https://github.com/bluecontract/blue-js/commit/9c37cd9))
- add shared-utils package - publishable ([90cfb74](https://github.com/bluecontract/blue-js/commit/90cfb74))

## 0.3.3 (2024-07-05)


### 🩹 Fixes

- blueId for wrong json like objects and unify exported utilities ([a260906](https://github.com/bluecontract/blue-js/commit/a260906))

## 0.3.2 (2024-07-05)


### 🩹 Fixes

- type of blueObject + description for yamlBlueParse ([ad5bed1](https://github.com/bluecontract/blue-js/commit/ad5bed1))
- lint cmd ([0b0bc90](https://github.com/bluecontract/blue-js/commit/0b0bc90))
- dependencies versions and eslint config ([2a8aa1a](https://github.com/bluecontract/blue-js/commit/2a8aa1a))

## 0.3.1 (2024-07-04)

### 🩹 Fixes

- yamlBlueParse types ([7107baf](https://github.com/bluecontract/blue-js/commit/7107baf))

## 0.3.0 (2024-07-04)

### 🚀 Features

- create jsonSchema and jsonBlueSchema + refactor ([451acfa](https://github.com/bluecontract/blue-js/commit/451acfa))

## 0.2.2 (2024-07-04)

### 🩹 Fixes

- vite config for license file ([5df73bf](https://github.com/bluecontract/blue-js/commit/5df73bf))
- add missing @types dependencies for typescript support ([c429743](https://github.com/bluecontract/blue-js/commit/c429743))

## 0.2.1 (2024-07-04)

### 🩹 Fixes

- documentation ([549d966](https://github.com/bluecontract/blue-js/commit/549d966))

## 0.2.0 (2024-07-04)

### 🚀 Features

- add yalc configuration ([3238af5](https://github.com/bluecontract/blue-js/commit/3238af5))

### 🩹 Fixes

- Add publish package step and fix dependency issue ([e494b0a](https://github.com/bluecontract/blue-js/commit/e494b0a))

## 0.1.0 (2024-07-02)

### 🚀 Features

- add @nx/js ([6b4f731](https://github.com/bluecontract/blue-js/commit/6b4f731))
- init language lib ([604ff99](https://github.com/bluecontract/blue-js/commit/604ff99))
- first version ([0c6da0c](https://github.com/bluecontract/blue-js/commit/0c6da0c))
