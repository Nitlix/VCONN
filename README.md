
<div align="center">
  <h1>VCONN</h1>
  <h3>Lightweight, end-to-end type safe communications library.<br />Perfect for replacing Next.JS' Server Actions and tRPC.</h3>
  <a href="https://www.npmjs.com/package/vconn">
    <img alt="npm version" src="https://img.shields.io/npm/v/vconn.svg">
  </a>
  <a href="https://www.npmjs.com/package/vconn">
    <img alt="weekly downloads" src="https://img.shields.io/npm/dm/vconn.svg">
  </a>

  <br />
  <br />

  <figure>
    <img src="https://static.nitlix.pro/github/VCONN_GITHUB.jpg" alt="Logo" />
  </figure>
  
</div>

<br />

## Intro

VCONN is a lightweight, end-to-end type safety ensuring communication library that makes it easy to build and consume fully typesafe APIs without schemas or code generation. It's designed to be a modern alternative to Next.JS' Server Actions, providing better type safety and developer experience.

### Features

-   ✅&nbsp; Production ready and well-tested
-   🧙‍♂️&nbsp; Full static typesafety & autocompletion on the client
-   🐎&nbsp; Snappy DX - No code generation or build pipeline
-   🍃&nbsp; Lightweight - Zero dependencies and minimal client-side footprint
-   🐻&nbsp; Easy to integrate into existing projects
-   🔋&nbsp; Built with TypeScript and Zod for robust type safety
-   🛡️&nbsp; Input validation out of the box
-   🎯&nbsp; Perfect for Next.JS applications

## Quickstart

First, install VCONN:

```sh
pnpm add vconn
```

### Server Setup

```typescript
// @/lib/vconn.ts
import { VCONNServer } from "vconn";
import { z } from "zod";

// Define your actions
const actions = {
    greet: {
        schema: z.object({
            name: z.string(),
        }),
        handler: async ({ name }: { name: string }) => {
            return `Hello, ${name}!`;
        },
    },
};

// Create the server
const server = new VCONNServer({
    actions,
    debugLog: true, // Optional: Enable debug logging
});

// Handle requests (e.g., in Next.js API route)
export async function POST(req: Request) {
    return server.handleRequest(req);
}
```

### Setup the Server Handler

```typescript
// @/app/api/vconn/route.ts
import { server } from "@/lib/vconn";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
    return await server.handleRequest(req);
}
```

### Client Setup

```typescript
// @/lib/vconnClient.ts
import { VCONNClientConstructor } from "vconn";

// Create the client
const client = new VCONNClientConstructor({
    actions: server.getActionTypes(),
    baseUrl: "/api/vconn", // Your API endpoint
}).getClient();

// Use the client
// Fully type-safe functions, without importing function data directly.
const greeting = await client.greet({ name: "World" });
console.log(greeting); // "Hello, World!"
```

## Contributing

We welcome contributions! Please read our [Contributing Guidelines](CONTRIBUTING.md) before submitting a pull request.

## License

VCONN is licensed under the [MIT License](LICENSE).

## About

VCONN is developed and maintained with 💝 by [Nitlix](https://nitlix.dev).
