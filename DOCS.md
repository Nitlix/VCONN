# 💝 VCONN Docs 🚀

## Table of Contents

-   [Server Documentation](#server-documentation)
    -   [VCONNServer Class](#vconnserver-class)
        -   [VCONNServer Initialization](#vconnserver-initialization)
        -   [VCONNServer Parameters](#vconnserver-parameters)
            -   [debugLog](#vconnserver-parameters-debuglog)
            -   [logger](#vconnserver-parameters-logger)
            -   [jsonResponseMaker](#vconnserver-parameters-jsonresponsemaker)
            -   [actions](#vconnserver-parameters-actions)
    -   [Request Handling](#request-handling)
    -   [Type Definitions](#type-definitions)
-   [Client Documentation](#client-documentation)
    -   [VCONNClientConstructor Class](#vconnclientconstructor-class)
        -   [VCONNClientConstructor Initialization](#vconnclientconstructor-initialization)
        -   [VCONNClientConstructor Parameters](#vconnclientconstructor-parameters)
            -   [actions](#vconnclientconstructor-parameters-actions)
            -   [baseUrl](#vconnclientconstructor-parameters-baseurl)
    -   [Client Usage](#client-usage)
    -   [Type Definitions](#client-type-definitions)

## Server Documentation

### VCONNServer Class

The `VCONNServer` class is the core server implementation that handles action-based requests and responses.

### VCONNServer Initialization

The server is initialized using the `VCONNServerInit` interface with the following parameters:

```typescript
interface VCONNServerInit<TActions extends ActionCollection> {
    debugLog?: boolean; // Optional: Enable/disable debug logging
    logger?: DebugLogger; // Optional: Custom logger implementation
    jsonResponseMaker?: (data: any, init?: ResponseInit) => Response; // Optional: Custom JSON response maker
    actions: TActions; // Required: Collection of actions
}
```

#### `VCONNServer` Parameters

-   <span id="vconnserver-parameters-debuglog">`debugLog`:</span> When set to `true`, enables detailed logging of server operations
-   <span id="vconnserver-parameters-logger">`logger`:</span> Custom logger implementation that follows the `DebugLogger` type

    ```typescript
    type DebugLogger = ({
        error?: boolean;
        message: string;
    }) => void;
    ```

    Example:

    ```typescript
    const logger: DebugLogger = ({ message }) => {
        console.log(message);
    };
    ```

-   <span id="vconnserver-parameters-jsonresponsemaker">`jsonResponseMaker`:</span> Custom function for creating JSON responses (defaults to `Response.json`)

    Example:

    ```typescript
    // data: any, init: ResponseInit
    // types provided upon input automatically
    const jsonResponseMaker: JsonResponseMaker = (data, init) => {
        return new Response(JSON.stringify(data), {
            headers: {
                "X-Custommessage": "Hello, world!",
            },
            ...init,
        });
    };
    ```

-   <span id="vconnserver-parameters-actions">`actions`:</span> A collection of actions that the server can handle, where each action must follow the `Action` type:

    ```typescript
    type Action<TInput = any, TOutput = any> = {
        // This therefore means that your input MUST be a dictionary.
        // A request object will be injected into the handler upon execution.
        handler: (input: TInput & { request: Request }) => Promise<TOutput>;
        // If a schema is provided, the input will be validated
        // against it before the handler is called.
        schema: z.ZodSchema<TInput>;
    };
    ```

    The `request` object is automatically injected into the handler input.

    Example action input upon initialization:

    ```typescript
    const server = new VCONNServer({
        actions: {
            greet: {
                // {name, id} as the input.
                // The request is automatically injected into the handler.
                handler: ({name, id, request}: {name: string, id: number, request: Request}) => {
                    return `Hello, ${name}!`;
                },
                schema: z.object({
                    name: z.string(),
                    id: z.number(),
                }),
            }
        }
    }
    ```

    The `greet` action can therefore be used like so (after client setup):

    ```typescript
    const greeting = await client.greet({ name: "World", id: 1 });
    ```

### Request Handling

The server handles requests through the `handleRequest` method, which processes incoming requests in the following way:

1. Parses the JSON body of the request
2. Validates the presence of an action
3. Checks if the requested action exists in the action collection
4. Validates the input using the action's schema
5. Executes the action handler
6. Returns a JSON response

#### Implementation

VCONN can be implemented in any environment that supports HTTP requests. Here's how to implement it in different scenarios:

##### Basic Implementation

```typescript
// server.ts
import VCONNServer from "vconn";
import { z } from "zod";

const actions = {
    greet: {
        handler: async ({ name }: { name: string }) => {
            return `Hello, ${name}!`;
        },
        schema: z.object({
            name: z.string(),
        }),
    },
} as const;

const server = new VCONNServer({
    actions,
    debugLog: process.env.NODE_ENV === "development",
});

// Export for use in your HTTP server
export const handler = server.handleRequest.bind(server);
export const actionTypes = server.getActionTypes();
```

The client will call the handler via a POST request to your given endpoint (e.g. `/api/vconn`).

##### Next.js Implementation Example

```typescript
// src/app/api/vconn/route.ts
import { NextRequest } from "next/server";
import { handler } from "@/lib/server";

export async function POST(request: NextRequest) {
    return handler(request);
}
```

##### Express Implementation Example

```typescript
// server.ts
import express from "express";
import { handler } from "./vconn";

const app = express();
app.use(express.json());

app.post("/api/vconn", handler);

app.listen(3000, () => {
    console.log("Server running on port 3000");
});
```

##### Client Implementation (Works with any server implementation)

```typescript
// client.ts
import { VCONNClientConstructor } from "vconn";
import { actionTypes } from "./server"; // Import from your server implementation

const clientConstructor = new VCONNClientConstructor({
    actions: actionTypes,
    baseUrl: "/api/vconn", // Adjust based on your server's endpoint
});

export const client = clientConstructor.getClient();
```

Usage in your application:

```typescript
// Any component or page
import { client } from "./client";

async function MyComponent() {
    const greeting = await client.greet({ name: "World" });
    return <div>{greeting}</div>;
}
```

The key points to remember when implementing VCONN:

1. The server needs to expose a single endpoint that accepts POST requests
2. The endpoint should pass the request directly to `server.handleRequest()`
3. Action types should be exported from the server for client usage
4. The client should be configured with the correct base URL

---

Below you will find the default autogenerated VCONN request and response formats for debugging or to understand the inner workings.

#### Request Format

```json
{
    "action": "actionName",
    "input": {
        // Action-specific input data
    }
}
```

#### Response Format

Success Response:

```json
{
    "data": {
        // Action-specific output data
    }
}
```

Error Response:

```json
{
    "error": "Error message",
    "details": [] // Optional: Validation error details
}
```

#### Class Properties

-   `actionCollection`: Private property that stores all registered actions
-   `logger`: Private property for debug logging (defaults to vconnLog)
-   `debugLog`: Private boolean flag for enabling/disabling debug logging
-   `jsonResponseMaker`: Private function for creating JSON responses

### Type Definitions

#### Action Types

-   `Action<TInput, TOutput>`: Defines the structure of a server action

    -   `handler`: Async function that processes the action
    -   `schema`: Zod schema for input validation

-   `ActionType<TInput, TOutput>`: Type information for an action

    -   `input`: Type of the input data
    -   `output`: Type of the output data

-   `ActionCollection`: Record of action names to Action implementations

-   `ToActionTypes<TActions>`: Utility type that converts an ActionCollection to its corresponding ActionTypeCollection

#### Server Types

-   `VCONNServerInit<TActions>`: Configuration interface for server initialization
-   `DebugLogger`: Type definition for logging functions
-   `CallableAction<TInput, TOutput>`: Type for client-side action calls

### Error Handling

The server implements comprehensive error handling for:

-   Invalid JSON in request body
-   Missing action in request
-   Non-existent actions
-   Input validation errors (using Zod)
-   Runtime errors during action execution

Each error case returns an appropriate HTTP status code and error message in the response.

## Client Documentation

### VCONNClientConstructor Class

The `VCONNClientConstructor` class is responsible for creating type-safe client instances that can communicate with a VCONN server.

### VCONNClientConstructor Initialization

The client is initialized using the following parameters:

```typescript
interface VCONNClientInit<TActions extends ActionCollection> {
    actions: TActions; // Required: Collection of actions (from server's getActionTypes())
    baseUrl: string; // Required: Base URL of the VCONN server
}
```

#### VCONNClientConstructor Parameters

-   <span id="vconnclientconstructor-parameters-actions">`actions`:</span> A collection of action types that matches the server's action collection. This is typically obtained from the server's `getActionTypes()` method.

    Example:

    ```typescript
    // vconnServer.ts
    const server = new VCONNServer({
        actions: {
            greet: {
                handler: ({ name }: { name: string }) => `Hello, ${name}!`,
                schema: z.object({ name: z.string() }),
            },
        },
    });

    // Get action types
    export const actionTypes = server.getActionTypes();
    ```

    On the client:

    ```typescript
    // vconnClient.ts

    import { actionTypes } from "./vconnServer";

    const clientConstructor = new VCONNClientConstructor({
        actions: actionTypes,
        baseUrl: "/api/vconn",
    });

    const client = clientConstructor.getClient();

    // Now you can call actions with full type safety
    const greeting = await client.greet({ name: "World" });
    ```

    This works due to the fact that when the project is built, the client will only be importing `actionTypes` with empty functions and type definitions. This prevents sensitive server data as well as server libraries from being exposed to the client.

-   <span id="vconnclientconstructor-parameters-baseurl">`baseUrl`:</span> The base URL of the VCONN server. This should point to the endpoint where the server is listening for requests.

    Example:

    ```typescript
    const clientConstructor = new VCONNClientConstructor({
        actions: actionTypes,
        baseUrl: "https://api.example.com/vconn", // Your server's VCONN endpoint
    });
    ```

### Client Usage

After initializing the client constructor, you can get a type-safe client instance using the `getClient()` method:

```typescript
const client = clientConstructor.getClient();

// Now you can call actions with full type safety
const greeting = await client.greet({ name: "World" });
// TypeScript will ensure:
// 1. Only valid actions can be called
// 2. Input parameters match the server's schema
// 3. Return type matches the server's handler return type
```

#### Error Handling

The client automatically handles:

-   Network errors
-   Server errors (non-200 responses)
-   JSON parsing errors
-   Server-reported errors (when the response contains an `error` field)

In case of an error, the client will:

1. Log the error to the console
2. Return `null`
3. Preserve the original error for debugging

### Client Type Definitions

#### Client Types

-   `VCONNClientInit<TActions>`: Configuration interface for client initialization
-   `CallableAction<TInput, TOutput>`: Type for client-side action calls
    ```typescript
    type CallableAction<TInput = any, TOutput = any> = (
        input: TInput
    ) => Promise<TOutput>;
    ```

#### Type Safety Features

The client provides several type safety features:

1. Action names are strictly typed based on the server's action collection
2. Input parameters are validated against the server's schema types
3. Return types are inferred from the server's handler return types
4. The `request` parameter is automatically omitted from client-side calls

Example of type safety in action:

```typescript
// This will cause a TypeScript error if:
// 1. 'greet' is not a valid action name
// 2. The input doesn't match the schema
// 3. The return type doesn't match the handler
const greeting: string = await client.greet({
    name: "World", // TypeScript ensures this matches the schema
});
```
