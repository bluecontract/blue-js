# @blue-company/language

@blue-company/language is a comprehensive library for working with the Blue language, a simple YAML-based language that supports inheritance. This library has been rewritten from the original Java version, which can be found [here](https://github.com/bluecontract/blue-language-java). The rewritten parts are located in the `src/lib` directory, while the rest of the code includes additional helper functions designed for TypeScript, enabling better manipulation and management of Blue objects.

## Installation

To install the library, use npm or yarn:

```bash
npm install @blue-company/language
# or
yarn add @blue-company/language
```

## Usage

Here are the key features and services provided by the @blue-company/language library:

### Services

- **Base58Sha256Provider**
  - A hash provider used in `BlueIdCalculator` for calculating blueId.
- **BlueIdCalculator**
  - Service for calculating blueId.
- **BlueIdToCid**
  - Service to calculate CIDv1 used as id in IPFS from the provided blueId.
- **JsonCanonicalizer**
  - Service for calculating the canonical form of a given value.

### Schemas

- **blueIdSchema**
  - A schema defined in Zod, describing blueId.
- **blueObjectSchema**
  - A schema defined in Zod, describing a BlueObject.

### Functions

- **calculateBlueId**
  - Calculates blueId for a given JSON like value.
- **enrichWithBlueId**
  - Enriches a given BlueObject with calculated blueId.
- **getBlueObjectProperties**
  - Returns properties of a BlueObject that are not specific to this object.
- **getBlueObjectTypeLabel**
  - Retrieves the type label of a BlueObject based on its type, value, or items.
- **isBlueObjectResolved**
  - Checks if a BlueObject is fully resolved or if there is something apart from blueId.

### Predicates

- **hasBlueObjectBlueIdDefined**
  - Predicate to check if blueId is defined.
- **hasBlueObjectItemsDefined**
  - Predicate to check if items are defined.
- **hasBlueObjectNameDefined**
  - Predicate to check if name is defined.
- **hasBlueObjectTypeDefined**
  - Predicate to check if type is defined.
- **hasBlueObjectValueDefined**
  - Predicate to check if value is defined.
- **isBlueObject**
  - Predicate to check if a value is of type BlueObject.

### Normalization

- **normalizeToBlueObject**
  - Normalizes a given JSON value to a BlueObject.

### Helpers

- **resolveBlueObjectItems**
  - Resolves BlueObject items in order from last to first.
- **yamlBlueDump**
  - Loads YAML.
- **yamlBlueParse**
  - Parses YAML.

## Blue Language Overview

Blue language is a simple YAML-based language that supports inheritance. Below are some key aspects:

### Base Type

Every node in Blue is of this type. If any node does not specify a `type`, it is considered to be of this base type by default.

### Known Blue Types

- **Text**: A basic text type.
- **Integer**: A basic integer type.
- **Number**: A basic number type.
- **Boolean**: A basic boolean type. If value is not specified, it means false.
- **Type**: A type that can reference other types. To be used only for `type` attribute definition.

### Example

```yaml
name:
  value: Pet
  description: Name of the pet. Every pet must have a name.
description: A base type for all pets.
abstract: true
age:
  description: The age of the pet in years.
  type: Integer

---
name:
  value: Dog
  description: If we want to put more fields for Text, Integer, Number, Boolean, or Type elements, we can use `value` instead of inline approach like everywhere else here.
abstract: true
type: Pet
breed:
  description: The breed of the dog.
  type: Text
isTrained:
  description: Indicates if the dog is trained.
  type: Boolean
```

For more detailed information, refer to the [Blue Language documentation](https://github.com/bluecontract/blue-language-java).

## Changelog

The [Changelog](https://github.com/bluecontract/blue-js/blob/main/CHANGELOG.md) is regularly updated to reflect what's changed in each new release.

## Contributing

We welcome contributions! Please read our [Contributing Guide](https://github.com/bluecontract/blue-js/blob/main/CONTRIBUTING.md) to learn about how you can contribute.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more details.
