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
