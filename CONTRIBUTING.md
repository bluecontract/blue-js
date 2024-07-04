# Contributing to Blue JS

We deeply appreciate your interest in contributing to our repository! Your contributions are highly valued and will help improve the project for everyone.

## How to Contribute

### Reporting Issues

If you find a bug or have a feature request, please create an issue on our [GitHub issue tracker](https://github.com/bluecontract/blue-js/issues). Be sure to include detailed information about the issue or request.

### Fork the Repository

1. Fork the repository by clicking the "Fork" button on the top right of the repository page.
2. Clone your forked repository to your local machine:
   ```bash
   git clone https://github.com/YOUR-USERNAME/blue-js.git
   ```
3. Navigate to the project directory:
   ```bash
   cd blue-js
   ```

### Setting Up Your Development Environment

1. Install the dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

### Making Changes

1. Create a new branch for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Make your changes in the new branch.
3. Ensure your code follows our coding standards and passes all tests.

### Running Tests

To run the tests, use the following command:

```bash
npx nx run-many -t test
```

### Commit Your Changes

1. Commit your changes with a meaningful commit message:
   ```bash
   git add .
   git commit -m "Add meaningful commit message"
   ```

### Push Changes to Your Fork

1. Push your changes to your forked repository:
   ```bash
   git push origin feature/your-feature-name
   ```

### Create a Pull Request

1. Go to the original repository and click on the "New Pull Request" button.
2. Select your forked repository and branch as the source, and the original repository's main branch as the destination.
3. Provide a clear and concise description of your changes and submit the pull request.

## Style Guide

Please ensure your code adheres to our style guide. We use Prettier for code formatting, integrated with our linting process. You can check the format of code by running:

```bash
npx nx run-many -t lint
```

## License

By contributing to Blue JS, you agree that your contributions will be licensed under the MIT License.

Thank you for contributing!
