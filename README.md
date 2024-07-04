# Blue

Blue is a simple YAML-based language that supports inheritance.
This repository contains all the public packages that make up the Blue project.

## Table of Contents

- [Directory Structure](#directory-structure)
- [Available Libraries](#available-libraries)
- [Building and Testing](#building-and-testing)
- [Contributing](#contributing)
- [License](#license)

## Directory Structure

The directory structure of this monorepo is organized as follows

```
blue-js/
├── libs/                # Shared libraries
├── nx.json              # NX configuration
├── package.json         # Root package configuration
└── README.md            # This file
```

## Available Libraries

Currently, the following libraries are available in this monorepo:

1. **@blue-company/language** : This library, located in `libs/language`, provides tools for working with the Blue language, a YAML-based language with inheritance support. It includes services for calculating unique identifiers, schemas for validating Blue objects, various utility functions, and helpers for parsing and normalizing JSON and YAML data.

For detailed information on each library, please refer to their respective README files located in the libs/ directory.

## Building and Testing

### Building

To build a specific library or application, run:

```bash
nx build <library-name>
```

### Testing

To test a specific library or application, run:

```bash
nx test <library-name>
```

## Contributing

Please read our [Contributing Guide](CONTRIBUTING.md) before submitting a Pull Request to the project.

## License

This project is licensed under the MIT License.
