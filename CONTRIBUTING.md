# Contributing to VCONN

We're thrilled to have you here! 🎉 If you need any help or guidance while contributing to VCONN, don't hesitate to reach out on [Discord](https://discord.gg/nitlix) or [GitHub Discussions](https://github.com/nitlix/vconn/discussions).

## Development Workflow

We use [pnpm](https://pnpm.io) as our package manager. Make sure to [install](https://pnpm.io/installation) it first!

```bash
git clone git@github.com:nitlix/vconn.git
cd vconn
pnpm install
pnpm build
```

### Get it Running

**Terminal 1:**

```bash
# In project root directory
pnpm dev
```

This starts a watcher that rebuilds the project on any file change.

**Terminal 2:**
You can run the example app (coming soon!) to test your changes in real-time.

### Testing

We use Vitest for our testing framework. To run tests:

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run specific test file
pnpm test:watch server.test.ts

# Run tests with coverage
pnpm test:coverage
```

### Linting & Formatting

```bash
# Fix linting issues
pnpm lint:fix

# Format code
pnpm format
```

### Troubleshooting

If you encounter any cryptic errors, try:

```bash
pnpm clean && pnpm install
```

If that doesn't work, feel free to open an issue or ask on Discord!

## Project Overview

VCONN is designed to be a lightweight, end-to-end type-safe communication library. Here's how it's structured:

### Core Package (`vconn`)

This is where the magic happens! The core package contains both server and client functionality, making it easy to set up type-safe communication between your frontend and backend.

#### Server Implementation

The server implementation is where VCONN shines. It's built around the concept of "actions" - type-safe functions that can be called from the client. The main components are:

-   `VCONNServer`: The main server class that handles requests and manages actions
-   Action Definitions: Type-safe function definitions with Zod schemas for validation
-   Request Handler: Processes incoming requests and validates input/output

Key files:

-   `server.ts`: Core server implementation
-   `types.ts`: Type definitions and interfaces
-   `vconnLog.ts`: Logging utilities

#### Client Implementation

The client side is where the developer experience really comes together. It provides:

-   Type-safe action calls
-   Automatic input validation
-   Error handling
-   Request/response transformation

Key files:

-   `client.ts`: Client implementation
-   `types.ts`: Shared type definitions

### How It Works

1. **Action Definition**: Define your server actions with Zod schemas
2. **Server Setup**: Create a VCONN server instance with your actions
3. **Client Generation**: Generate a type-safe client from your server
4. **Type Safety**: Enjoy full type safety and autocompletion!

Example:

```typescript
// Server
const server = new VCONNServer({
    actions: {
        greet: {
            schema: z.object({ name: z.string() }),
            handler: async ({ name }) => `Hello, ${name}!`,
        },
    },
});

// Client
const client = new VCONNClientConstructor({
    actions: server.getActionTypes(),
    baseUrl: "/api/vconn",
}).getClient();

// Usage (fully type-safe!)
const greeting = await client.greet({ name: "World" });
```

## Contributing Guidelines

### Code Style

-   We use TypeScript with strict mode enabled
-   Follow the existing code style
-   Write meaningful comments for complex logic
-   Keep functions small and focused
-   Use meaningful variable and function names

### TypeScript Best Practices

-   Avoid `any` type when possible
-   Use proper type definitions
-   Document complex types
-   Use interfaces for object shapes
-   Use type aliases for unions and intersections

### Testing Requirements

-   Write tests for all new features
-   Include both unit and integration tests
-   Test edge cases and error conditions
-   Ensure all tests pass before submitting a PR

### Documentation

-   Update documentation for new features
-   Include code examples
-   Document breaking changes
-   Keep the README up to date

### Commit Messages

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

Types:

-   `feat`: New feature
-   `fix`: Bug fix
-   `docs`: Documentation changes
-   `style`: Code style changes
-   `refactor`: Code changes that neither fix bugs nor add features
-   `perf`: Performance improvements
-   `test`: Adding or fixing tests
-   `chore`: Changes to the build process or auxiliary tools

## Getting Help

Need help? We're here for you! You can:

-   Open an issue on GitHub
-   Join our [Discord server](https://discord.gg/nitlix)
-   Start a discussion on [GitHub Discussions](https://github.com/nitlix/vconn/discussions)
-   Email us at [support@nitlix.dev](mailto:support@nitlix.dev)

## License

By contributing to VCONN, you agree that your contributions will be licensed under the project's MIT License.

---

<div align="center">
  <sub>Built with 💝 by <a href="https://nitlix.dev">Nitlix</a></sub>
</div>
