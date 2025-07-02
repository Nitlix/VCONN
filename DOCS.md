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
-   [Peer Documentation](#peer-documentation)
    -   [VCONNPeer Class](#vconnpeer-class)
        -   [VCONNPeer Initialization](#vconnpeer-initialization)
        -   [VCONNPeer Parameters](#vconnpeer-parameters)
            -   [debugLog](#vconnpeer-parameters-debuglog)
            -   [logger](#vconnpeer-parameters-logger)
            -   [methods](#vconnpeer-parameters-methods)
            -   [socketType](#vconnpeer-parameters-sockettype)
    -   [Peer Connection](#peer-connection)
    -   [Method Handling](#method-handling)
    -   [Default Methods](#default-methods)
    -   [Type Definitions](#peer-type-definitions)

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

---

## Peer Documentation

### VCONNPeer Class

The `VCONNPeer` class provides WebSocket-based peer-to-peer communication with full type safety. It enables real-time bidirectional communication between clients and servers, or between multiple peers, with automatic input validation and error handling.

### VCONNPeer Initialization

The peer is initialized using the `PeerInit` interface with the following parameters:

```typescript
interface PeerInit<TMethods extends MethodCollection, TSocket = WebSocket> {
    debugLog?: boolean; // Optional: Enable/disable debug logging
    logger?: DebugLogger; // Optional: Custom logger implementation
    methods: TMethods; // Required: Collection of methods
    socketType?: new (url: string) => TSocket; // Optional: Custom socket type
}
```

#### VCONNPeer Parameters

-   <span id="vconnpeer-parameters-debuglog">`debugLog`:</span> When set to `true`, enables detailed logging of peer operations including connection events, method calls, and errors

-   <span id="vconnpeer-parameters-logger">`logger`:</span> Custom logger implementation that follows the `DebugLogger` type

    ```typescript
    type DebugLogger = ({
        error?: boolean;
        message: string;
    }) => void;
    ```

    Example:

    ```typescript
    const logger: DebugLogger = ({ error, message }) => {
        if (error) {
            console.error(`[VCONNPeer] ${message}`);
        } else {
            console.log(`[VCONNPeer] ${message}`);
        }
    };
    ```

-   <span id="vconnpeer-parameters-methods">`methods`:</span> A collection of methods that the peer can handle, where each method must follow the `Method` type:

    ```typescript
    type Method<TInput = any, TOutput = any> = {
        handler: (input: TInput, socket: any) => Promise<TOutput>;
        schema?: z.ZodSchema<TInput>;
    };
    ```

    The `socket` object is automatically injected into the handler, allowing direct access to the WebSocket connection.

    Example method definition:

    ```typescript
    const peer = new VCONNPeer({
        methods: {
            sendMessage: {
                handler: async ({ message, userId }, socket) => {
                    // Broadcast message to all connected clients
                    return { success: true, timestamp: Date.now() };
                },
                schema: z.object({
                    message: z.string(),
                    userId: z.string(),
                }),
            },
            getUserInfo: {
                handler: async ({ userId }, socket) => {
                    return { name: "John Doe", id: userId };
                },
                schema: z.object({
                    userId: z.string(),
                }),
            },
        },
        debugLog: true,
    });
    ```

-   <span id="vconnpeer-parameters-sockettype">`socketType`:</span> Custom WebSocket implementation. Defaults to the native `WebSocket` class. Useful for custom WebSocket implementations or testing.

    Example:

    ```typescript
    class CustomWebSocket extends WebSocket {
        // Custom implementation
    }

    const peer = new VCONNPeer({
        methods: {
            /* ... */
        },
        socketType: CustomWebSocket,
    });
    ```

### Peer Connection

The peer can connect to a WebSocket server using the `connect` method, which returns a type-safe caller for remote method invocation:

```typescript
const caller = await peer.connect("ws://localhost:8080", false, {
    reconnect: true,
    maxReconnectAttempts: 5,
    reconnectDelay: 1000,
});

// Now you can call remote methods with full type safety
const result = await caller.sendMessage({
    message: "Hello, World!",
    userId: "user123",
});
```

#### Connection Options

The `connect` method accepts the following options:

-   `useNativeWebSocket`: Boolean flag to use native WebSocket (default: `false`)
-   `reconnect`: Enable automatic reconnection on connection loss (default: `false`)
-   `maxReconnectAttempts`: Maximum number of reconnection attempts (default: `5`)
-   `reconnectDelay`: Delay between reconnection attempts in milliseconds (default: `1000`)

#### Connection Lifecycle

The peer handles the complete WebSocket connection lifecycle:

1. **Connection Establishment**: Attempts to connect to the specified WebSocket URL
2. **Automatic Reconnection**: If enabled, automatically attempts to reconnect on connection loss
3. **Default Method Execution**: Executes default `open` and `close` methods if defined
4. **Error Handling**: Comprehensive error handling for connection failures and network issues

### Method Handling

The peer automatically handles incoming method calls through the `handle` method:

```typescript
// This is called automatically when messages are received
peer.handle({ data: messageData, socket: websocketConnection });
```

#### Message Format

Incoming messages must follow this JSON format:

```json
{
    "method": "methodName",
    "input": {
        // Method-specific input data
    }
}
```

#### Response Format

Success Response:

```json
{
    "data": {
        // Method-specific output data
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

### Default Methods

The peer supports special default methods that are automatically executed during connection lifecycle events:

#### `open` Method

Executed when a WebSocket connection is established:

```typescript
const peer = new VCONNPeer({
    methods: {
        open: {
            handler: async (input, socket) => {
                console.log("New connection established");
                return { status: "connected" };
            },
        },
        // ... other methods
    },
});
```

#### `close` Method

Executed when a WebSocket connection is closed:

```typescript
const peer = new VCONNPeer({
    methods: {
        close: {
            handler: async (input, socket) => {
                console.log("Connection closed");
                return { status: "disconnected" };
            },
        },
        // ... other methods
    },
});
```

#### `error` Method

Executed when a method execution fails:

```typescript
const peer = new VCONNPeer({
    methods: {
        error: {
            handler: async ({ error }, socket) => {
                console.error("Method execution failed:", error);
                return { status: "error", message: error };
            },
        },
        // ... other methods
    },
});
```

### Implementation Examples

#### Basic Peer Implementation

```typescript
// peer.ts
import VCONNPeer from "vconn";
import { z } from "zod";

const methods = {
    sendMessage: {
        handler: async ({ message, userId }, socket) => {
            return { success: true, timestamp: Date.now() };
        },
        schema: z.object({
            message: z.string(),
            userId: z.string(),
        }),
    },
} as const;

const peer = new VCONNPeer({
    methods,
    debugLog: process.env.NODE_ENV === "development",
});

export { peer };
export const methodTypes = peer.getMethodTypes();
```

#### Server-Side WebSocket Implementation

```typescript
// server.ts
import { WebSocketServer } from "ws";
import { peer } from "./peer";

const wss = new WebSocketServer({ port: 8080 });

wss.on("connection", (ws) => {
    ws.on("message", (data) => {
        peer.handle({ data: data.toString(), socket: ws });
    });
});
```

#### Client-Side Peer Usage

```typescript
// client.ts
import VCONNPeer from "vconn";
import { methodTypes } from "./peer";

const clientPeer = new VCONNPeer({
    methods: methodTypes,
    debugLog: true,
});

// Create a manager with server methods
const manager = clientPeer.createManager({
    serverMethods: {
        sendMessage: {
            input: () => ({ message: "", userId: "" }),
            output: () => ({ success: true, timestamp: 0 }),
        },
    },
});

// Connect to server
await clientPeer.connect("ws://localhost:8080");

// Call remote methods
const result = await manager.sendMessage({
    message: "Hello from client!",
    userId: "client123",
});
```

### createManager() and connect() Methods

The peer system now separates connection management from caller creation, providing more flexibility and control over the connection lifecycle.

#### createManager() Method

The `createManager()` method creates a type-safe caller for server methods without establishing a connection. This allows you to set up your method interface before connecting.

```typescript
// Create a manager with server methods
const manager = peer.createManager({
    serverMethods: {
        sendMessage: {
            input: () => ({ message: "", userId: "" }),
            output: () => ({ success: true, timestamp: 0 }),
        },
        getUser: {
            input: () => ({ id: "" }),
            output: () => ({ name: "", email: "" }),
        },
    },
});

// At this point, calling manager methods will throw "Not connected" error
// You must call connect() first
```

#### connect() Method

The `connect()` method establishes the WebSocket connection. It's a simple connection method that doesn't return a caller.

```typescript
// Connect to server
await peer.connect("ws://localhost:8080", false, {
    reconnect: true,
    maxReconnectAttempts: 5,
    reconnectDelay: 1000,
});

// Now manager methods will work
const result = await manager.sendMessage({
    message: "Hello!",
    userId: "user123",
});
```

### createCaller() Method

The `createCaller()` method (renamed from `getCaller()`) creates type-safe method callers for any WebSocket connection. This is particularly useful when you have a native WebSocket connection and want to create a type-safe interface for calling remote methods.

#### CallHandler Class

The `createCaller()` method uses the `CallHandler` class internally, which also supports chunking for large messages:

```typescript
import { CallHandler } from "vconn";

// Create a call handler with chunking support
const callHandler = new CallHandler(
    methodTypes,
    16384, // maxMessageLength: 16KB chunks
    50 // safeCeiling: 50 character buffer
);

// Configure chunking settings
callHandler.setSafeCeiling(100);
const currentCeiling = callHandler.getSafeCeiling();

// Get a caller with chunking support
const caller = callHandler.getCaller(websocketConnection);
```

The `CallHandler` class provides the same chunking capabilities as the main `VCONNPeer` class, making it useful for custom WebSocket implementations.

#### Basic Usage

```typescript
// Get a caller for a specific socket connection
const caller = peer.createCaller({
    socket: websocketConnection,
    methods: peer.getMethodTypes(),
});

// Now you can call remote methods with full type safety
const result = await caller.sendMessage({
    message: "Hello from caller!",
    userId: "user123",
});
```

#### Native WebSocket Integration

When working with native WebSocket connections (like in browser environments), you can create callers directly:

```typescript
// Browser environment example
const ws = new WebSocket("ws://localhost:8080");

ws.onopen = () => {
    // Create a type-safe caller once connection is established
    const caller = peer.createCaller({
        socket: ws,
        methods: peer.getMethodTypes(),
    });

    // Now you can use the caller throughout your application
    caller
        .sendMessage({
            message: "Connected and ready!",
            userId: "browser-user",
        })
        .then((result) => {
            console.log("Message sent:", result);
        });
};
```

#### Multiple Socket Support

The `getCaller()` method allows you to create multiple callers for different socket connections:

```typescript
// Server handling multiple clients
const connectedClients = new Map();

wss.on("connection", (ws) => {
    const clientId = generateClientId();
    connectedClients.set(clientId, ws);

    // Create a caller for this specific client
    const caller = peer.createCaller({
        socket: ws,
        methods: peer.getMethodTypes(),
    });

    // Store the caller for later use
    connectedClients.set(`${clientId}-caller`, caller);

    ws.on("message", (data) => {
        peer.handle({ data: data.toString(), socket: ws });
    });

    ws.on("close", () => {
        connectedClients.delete(clientId);
        connectedClients.delete(`${clientId}-caller`);
    });
});

// Later, you can use the caller to send messages to specific clients
function sendToClient(clientId: string, message: string) {
    const caller = connectedClients.get(`${clientId}-caller`);
    if (caller) {
        caller.sendMessage({
            message,
            userId: "server",
        });
    }
}
```

#### Manual Response Handling

The peer system now requires manual response handling. When a method is called, the handler must manually send responses using the provided socket.

```typescript
const methods = {
    sendMessage: {
        handler: async ({ message, userId }, socket) => {
            // Process the message
            const result = { success: true, timestamp: Date.now() };

            // Manually send the response
            peer.sendResponse(socket, result);
        },
        schema: z.object({
            message: z.string(),
            userId: z.string(),
        }),
    },
    getUser: {
        handler: async ({ id }, socket) => {
            try {
                const user = await fetchUserFromDatabase(id);
                peer.sendResponse(socket, user);
            } catch (error) {
                peer.sendError(socket, "User not found", { id });
            }
        },
        schema: z.object({
            id: z.string(),
        }),
    },
};
```

#### Available Response Methods

-   `sendResponse(socket, data)`: Send a successful response with data
-   `sendError(socket, message, details?)`: Send an error response with optional details

#### Caller vs Connect Method

The `connect()` method now only establishes the connection. You must use `createManager()` to get a caller:

```typescript
// New approach:
const manager = peer.createManager({ serverMethods });
await peer.connect("ws://localhost:8080");
const result = await manager.sendMessage({ message: "Hello" });

// Old approach (deprecated):
// const caller = await peer.connect("ws://localhost:8080");
```

#### Type Safety with createCaller()

The caller returned by `createCaller()` provides the same type safety as the `createManager()` method:

```typescript
const caller = peer.createCaller({
    socket: websocketConnection,
    methods: peer.getMethodTypes(),
});

// TypeScript ensures:
// 1. Only valid method names can be called
// 2. Input parameters match the schema
// 3. Return types are correctly inferred
const result: { success: boolean; timestamp: number } =
    await caller.sendMessage({
        message: "Type-safe message", // ✅ Validated against schema
        userId: "user123", // ✅ Required field
    });
```

### Peer Type Definitions

#### Method Types

-   `Method<TInput, TOutput>`: Defines the structure of a peer method

    -   `handler`: Async function that processes the method call
    -   `schema`: Optional Zod schema for input validation

-   `MethodType<TInput, TOutput>`: Type information for a method

    -   `input`: Type of the input data
    -   `output`: Type of the output data

-   `MethodCollection`: Record of method names to Method implementations

-   `ToMethodTypes<TMethods>`: Utility type that converts a MethodCollection to its corresponding MethodTypeCollection

#### Peer Types

-   `PeerInit<TMethods, TSocket>`: Configuration interface for peer initialization
-   `CallableMethod<TInput, TOutput>`: Type for client-side method calls
-   `CallableMethodsFromTypes<TMethodTypes>`: Type for callable methods based on method types

#### Type Safety Features

The peer provides comprehensive type safety:

1. Method names are strictly typed based on the method collection
2. Input parameters are validated against the method's schema types
3. Return types are inferred from the method's handler return types
4. The `socket` parameter is automatically injected into handlers

Example of type safety in action:

```typescript
// This will cause a TypeScript error if:
// 1. 'sendMessage' is not a valid method name
// 2. The input doesn't match the schema
// 3. The return type doesn't match the handler
const result: { success: boolean; timestamp: number } =
    await caller.sendMessage({
        message: "Hello, World!", // TypeScript ensures this matches the schema
        userId: "user123",
    });
```

### Error Handling

The peer implements comprehensive error handling for:

-   Invalid JSON in incoming messages (logged but no response sent)
-   Missing method in message (logged but no response sent)
-   Non-existent methods (logged but no response sent)
-   Input validation errors (using Zod, logged but no response sent)
-   Runtime errors during method execution (logged, triggers default `error` method if defined)
-   WebSocket connection errors
-   Network errors during reconnection attempts

**Important**: The peer no longer automatically sends error responses. You must manually handle responses in your method handlers using `sendResponse()` and `sendError()` methods.

#### Transit System Error Handling

The chunking system includes robust error handling:

-   **Invalid chunk format**: Logged and ignored
-   **Missing transit ID**: Logged and ignored
-   **Reassembly errors**: Logged and transit storage cleaned up
-   **JSON parsing errors**: Handled gracefully with cleanup

```typescript
// The system automatically handles these error cases:
// 1. Malformed chunks: "V-abc123.invalid.chunk"
// 2. Missing transit data: Chunk for unknown transit ID
// 3. JSON parsing failures: Invalid JSON in reassembled data
// 4. Memory cleanup: Automatic cleanup of transit storage
```

### Advanced Features

#### Message Chunking for Large Data

VCONN now supports automatic message chunking to handle large data that exceeds WebSocket message size limits. This is particularly useful for:

-   **File transfers**: Sending large files or binary data
-   **Bulk operations**: Processing large datasets
-   **Media streaming**: Handling audio/video data
-   **Database operations**: Large query results

##### Setting Message Size Limits

```typescript
const peer = new VCONNPeer({
    methods: yourMethods,
    debugLog: true,
});

// Set maximum message length (in characters)
peer.setMaxMessageLength(16384); // 16KB limit

// Set safe ceiling for overhead calculations
peer.setSafeCeiling(50); // 50 characters buffer
```

##### How Chunking Works

When a message exceeds the set limit, VCONN automatically:

1. **Generates a transit ID** for tracking the chunked message
2. **Sends a transit initiation message** with the method name and transit ID
3. **Splits the data into chunks** based on the message size limit
4. **Sends each chunk** with format: `<TRANSIT_ID>.<CHUNK_INDEX>.<RAW_DATA>`
5. **Reassembles chunks** on the receiving end
6. **Processes the complete message** once all chunks are received

##### Example: Large File Transfer

```typescript
// Server-side method for handling large files
const methods = {
    uploadFile: {
        handler: async ({ fileName, fileData }, socket) => {
            // fileData can be very large (e.g., 100MB)
            const result = await processLargeFile(fileName, fileData);
            peer.sendResponse(socket, { success: true, fileId: result.id });
        },
        schema: z.object({
            fileName: z.string(),
            fileData: z.string(), // Base64 encoded file data
        }),
    },
};

// Client-side usage
const manager = peer.createManager({
    serverMethods: {
        uploadFile: {
            input: () => ({ fileName: "", fileData: "" }),
            output: () => ({ success: true, fileId: "" }),
        },
    },
});

// Set chunking limits
peer.setMaxMessageLength(16384); // 16KB chunks

// Upload large file
const largeFileData = await readLargeFileAsBase64();
await manager.uploadFile({
    fileName: "large-video.mp4",
    fileData: largeFileData, // Will be automatically chunked
});
```

##### Chunking Configuration

```typescript
// Get current settings
const maxLength = peer.getMaxMessageLength(); // Current limit
const safeCeiling = peer.getSafeCeiling(); // Current buffer

// Disable chunking (default)
peer.setMaxMessageLength(-1);

// Enable chunking with custom limits
peer.setMaxMessageLength(8192); // 8KB chunks
peer.setSafeCeiling(100); // 100 character buffer
```

##### Transit System Details

The chunking system uses a "transit" protocol:

1. **Transit Initiation**: `{ "method": "uploadFile", "transit": "V-abc123" }`
2. **Chunk Format**: `V-abc123.0.chunk_data_here`
3. **Final Chunk**: `V-abc123.-1.final_chunk_data`
4. **Automatic Reassembly**: Chunks are automatically reassembled and processed

##### Benefits of Chunking

-   **Bypass WebSocket Limits**: Handle messages larger than typical WebSocket limits (64KB-1MB)
-   **Memory Efficient**: Process data in manageable chunks
-   **Automatic**: No manual chunking required in your code
-   **Reliable**: Built-in error handling and cleanup
-   **Transparent**: Works seamlessly with existing method handlers

##### Real-World Example: Bypassing WebSocket Limits

```typescript
// Without chunking - this would fail with large datasets
const peer = new VCONNPeer({ methods: serverMethods });

// This might fail if the dataset is > 1MB
await manager.bulkUpdateUsers({
    users: largeUserDataset, // Could be 10MB+ of data
});

// With chunking - this works with any size data
const peer = new VCONNPeer({ methods: serverMethods });
peer.setMaxMessageLength(16384); // 16KB chunks

// Now this works regardless of dataset size
await manager.bulkUpdateUsers({
    users: largeUserDataset, // Automatically chunked into 16KB pieces
});
```

##### WebSocket Size Limit Solutions

| Scenario                  | Without Chunking | With VCONN Chunking    |
| ------------------------- | ---------------- | ---------------------- |
| Large file upload (100MB) | ❌ Fails         | ✅ Works automatically |
| Database export (50MB)    | ❌ Fails         | ✅ Works automatically |
| Bulk operations (10MB)    | ❌ Fails         | ✅ Works automatically |
| Media streaming           | ❌ Limited       | ✅ Unlimited size      |
| Real-time analytics       | ❌ Limited       | ✅ Unlimited size      |

#### Dynamic Method Editing

You can dynamically edit method handlers at runtime:

```typescript
peer.editFunction("sendMessage", async ({ message, userId }, socket) => {
    // New implementation
    return { success: true, newImplementation: true };
});
```

#### Socket Access

You can access the current WebSocket connection:

```typescript
const socket = peer.getSocket();
if (socket) {
    // Direct WebSocket operations
    socket.send(JSON.stringify({ custom: "message" }));
}
```

#### Method Collection Access

You can access the current method collection:

```typescript
const methods = peer.getMethodCollection();
// Access to all registered methods
```
