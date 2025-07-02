import { z } from "zod";
import vconnLog from "./(util)/vconnLog";

// Generate a simple UUID-like string
function generateTransitId(): string {
    return "V-" + Math.random().toString(36).substring(2, 15);
}

// Types for method registration
export type Method<TInput = any, TOutput = any> = {
    handler: (input: TInput, socket: any) => Promise<TOutput>;
    schema?: z.ZodSchema<TInput>;
};

// Type for method handler with socket included
export type MethodHandler<TInput = any, TOutput = any, TSocket = any> = (
    input: TInput,
    socket: TSocket
) => Promise<TOutput>;

export type MethodCollection = {
    [key: string]: Method<any, any>;
};

export type MethodType<TInput = any, TOutput = any> = {
    input: () => TInput; // Dummy function for input type (socket not included in exported types)
    output: () => TOutput; // Dummy function for output type
};

export type MethodTypeCollection = {
    [key: string]: MethodType<any, any>;
};

export type ToMethodTypes<TMethods extends MethodCollection> = {
    [K in keyof TMethods]: TMethods[K] extends Method<
        infer TInput,
        infer TOutput
    >
        ? MethodType<TInput, TOutput>
        : never;
};

export type CallableMethod<TInput = any, TOutput = any> = (
    input: TInput
) => Promise<TOutput>;

export type PeerMethods<TMethods extends MethodCollection> = {
    [K in keyof TMethods]: TMethods[K] extends Method<
        infer TInput,
        infer TOutput
    >
        ? CallableMethod<TInput, TOutput>
        : never;
};

// Type for callable methods based on method types
export type CallableMethodsFromTypes<
    TMethodTypes extends MethodTypeCollection
> = {
    [K in keyof TMethodTypes]: TMethodTypes[K] extends MethodType<
        infer TInput,
        infer TOutput
    >
        ? CallableMethod<TInput, TOutput>
        : never;
};

// Transit storage type
type TransitData = {
    method: string;
    chunks: { [chunkIndex: number]: string };
};

// Call handler class with proper typing
export class CallHandler<
    TMethodTypes extends MethodTypeCollection,
    TSocket = WebSocket
> {
    private methodTypes: TMethodTypes;
    private maxMessageLength: number = -1;
    private safeCeiling: number = 10;

    constructor(
        methodTypes: TMethodTypes,
        maxMessageLength: number = -1,
        safeCeiling: number = 10
    ) {
        this.methodTypes = methodTypes;
        this.maxMessageLength = maxMessageLength;
        this.safeCeiling = safeCeiling;
    }

    // Set safe ceiling for chunking
    public setSafeCeiling(ceiling: number): void {
        this.safeCeiling = ceiling;
    }

    // Get current safe ceiling
    public getSafeCeiling(): number {
        return this.safeCeiling;
    }

    // Helper method to calculate chunk limits for raw data
    private calculateChunkLimits(
        transitId: string,
        inputString: string
    ): number[] {
        if (this.maxMessageLength === -1) return [inputString.length];

        const chunkLimits: number[] = [];
        let remainingString = inputString;
        let chunkIndex = 0;

        while (remainingString.length > 0) {
            // Calculate overhead for this specific chunk: <TRANSIT_ID>.<CHUNK_INDEX>.
            const chunkIndexStr = chunkIndex.toString();
            const baseOverhead = `${transitId}.${chunkIndexStr}.`.length;
            const maxChunkSize =
                this.maxMessageLength - baseOverhead - this.safeCeiling;

            if (remainingString.length <= maxChunkSize) {
                // Last chunk
                chunkLimits.push(remainingString.length);
                break;
            } else {
                // Regular chunk
                chunkLimits.push(maxChunkSize);
                remainingString = remainingString.slice(maxChunkSize);
            }
            chunkIndex++;
        }

        return chunkLimits;
    }

    // Helper method to send chunked message using transit system
    private async sendChunkedMessage(
        socket: TSocket,
        method: string,
        input: any
    ): Promise<void> {
        const inputString = JSON.stringify(input);

        if (
            this.maxMessageLength === -1 ||
            inputString.length <= this.maxMessageLength
        ) {
            // No chunking needed
            (socket as any).send(JSON.stringify({ method, input }));
            return;
        }

        // Generate transit ID
        const transitId = generateTransitId();

        // Send transit initiation message
        (socket as any).send(
            JSON.stringify({
                method,
                transit: transitId,
            })
        );

        // Calculate chunk limits
        const chunkLimits = this.calculateChunkLimits(transitId, inputString);

        // Send chunks in raw format
        let currentIndex = 0;
        for (let i = 0; i < chunkLimits.length; i++) {
            const chunk = inputString.slice(
                currentIndex,
                currentIndex + chunkLimits[i]
            );
            const isLastChunk = i === chunkLimits.length - 1;
            const chunkIndex = isLastChunk ? -1 : i;

            // Send raw data: <TRANSIT_ID>.<CHUNK_INDEX>.<RAW_DATA>
            (socket as any).send(`${transitId}.${chunkIndex}.${chunk}`);

            currentIndex += chunkLimits[i];
        }
    }

    public getCaller(socket: TSocket): CallableMethodsFromTypes<TMethodTypes> {
        const methods = {} as CallableMethodsFromTypes<TMethodTypes>;

        Object.keys(this.methodTypes).forEach((key) => {
            (methods as any)[key] = async (input: any) => {
                return new Promise((resolve, reject) => {
                    const messageHandler = (event: any) => {
                        try {
                            const response = JSON.parse(event.data);
                            if (response.error) {
                                reject(new Error(response.error));
                            } else {
                                resolve(response.data);
                            }
                        } catch (error) {
                            reject(error);
                        }
                        (socket as any).removeEventListener(
                            "message",
                            messageHandler
                        );
                    };

                    (socket as any).addEventListener("message", messageHandler);

                    // Use chunked sending if message length is limited
                    this.sendChunkedMessage(socket, key, input);
                });
            };
        });

        return methods;
    }
}

export type DebugLogger = (params: {
    error?: boolean;
    message: string;
}) => void;

export type PeerInit<TMethods extends MethodCollection, TSocket = WebSocket> = {
    debugLog?: boolean;
    logger?: DebugLogger;
    methods: TMethods;
    socketType?: new (url: string) => TSocket;
};

export default class VCONNPeer<
    TMethods extends MethodCollection,
    TSocket = WebSocket
> {
    private methodCollection: TMethods;
    private logger: DebugLogger;
    private debugLog: boolean = false;
    private socketType: new (url: string) => TSocket;
    protected socket: TSocket | null = null;
    private maxMessageLength: number = -1; // -1 means no limit
    private safeCeiling: number = 10; // Default safe ceiling
    private transitStorage: Map<string, TransitData> = new Map();

    public constructor(init: PeerInit<TMethods, TSocket>) {
        this.debugLog = init.debugLog ?? false;
        this.logger = init.logger ?? vconnLog;
        this.socketType = init.socketType ?? (WebSocket as any);
        this.methodCollection = init.methods;
    }

    // Set maximum message length for chunking
    public setMaxMessageLength(length: number): void {
        this.maxMessageLength = length;
    }

    // Get current maximum message length
    public getMaxMessageLength(): number {
        return this.maxMessageLength;
    }

    // Set safe ceiling for chunking
    public setSafeCeiling(ceiling: number): void {
        this.safeCeiling = ceiling;
    }

    // Get current safe ceiling
    public getSafeCeiling(): number {
        return this.safeCeiling;
    }

    // Helper method to calculate chunk limits for raw data
    private calculateChunkLimits(
        transitId: string,
        inputString: string
    ): number[] {
        if (this.maxMessageLength === -1) return [inputString.length];

        const chunkLimits: number[] = [];
        let remainingString = inputString;
        let chunkIndex = 0;

        while (remainingString.length > 0) {
            // Calculate overhead for this specific chunk: <TRANSIT_ID>.<CHUNK_INDEX>.
            const chunkIndexStr = chunkIndex.toString();
            const baseOverhead = `${transitId}.${chunkIndexStr}.`.length;
            const maxChunkSize =
                this.maxMessageLength - baseOverhead - this.safeCeiling;

            if (remainingString.length <= maxChunkSize) {
                // Last chunk
                chunkLimits.push(remainingString.length);
                break;
            } else {
                // Regular chunk
                chunkLimits.push(maxChunkSize);
                remainingString = remainingString.slice(maxChunkSize);
            }
            chunkIndex++;
        }

        return chunkLimits;
    }

    // Helper method to send chunked message using transit system
    private async sendChunkedMessage(
        socket: TSocket,
        method: string,
        input: any
    ): Promise<void> {
        const inputString = JSON.stringify(input);

        if (
            this.maxMessageLength === -1 ||
            inputString.length <= this.maxMessageLength
        ) {
            // No chunking needed
            (socket as any).send(JSON.stringify({ method, input }));
            return;
        }

        // Generate transit ID
        const transitId = generateTransitId();

        // Send transit initiation message
        (socket as any).send(
            JSON.stringify({
                method,
                transit: transitId,
            })
        );

        // Calculate chunk limits
        const chunkLimits = this.calculateChunkLimits(transitId, inputString);

        // Send chunks in raw format
        let currentIndex = 0;
        for (let i = 0; i < chunkLimits.length; i++) {
            const chunk = inputString.slice(
                currentIndex,
                currentIndex + chunkLimits[i]
            );
            const isLastChunk = i === chunkLimits.length - 1;
            const chunkIndex = isLastChunk ? -1 : i;

            // Send raw data: <TRANSIT_ID>.<CHUNK_INDEX>.<RAW_DATA>
            (socket as any).send(`${transitId}.${chunkIndex}.${chunk}`);

            currentIndex += chunkLimits[i];
        }
    }

    // Create a manager with server methods (client mode)
    public createManager<TMethodTypes extends MethodTypeCollection>(params: {
        serverMethods: TMethodTypes;
    }): CallableMethodsFromTypes<TMethodTypes> {
        const { serverMethods } = params;

        // Create a caller that will work once connected
        const methods = {} as CallableMethodsFromTypes<TMethodTypes>;

        Object.keys(serverMethods).forEach((key) => {
            (methods as any)[key] = async (input: any) => {
                if (!this.socket) {
                    throw new Error("Not connected. Call connect() first.");
                }

                return new Promise((resolve, reject) => {
                    const messageHandler = (event: any) => {
                        try {
                            const response = JSON.parse(event.data);
                            if (response.error) {
                                reject(new Error(response.error));
                            } else {
                                resolve(response.data);
                            }
                        } catch (error) {
                            reject(error);
                        }
                        (this.socket as any).removeEventListener(
                            "message",
                            messageHandler
                        );
                    };

                    (this.socket as any).addEventListener(
                        "message",
                        messageHandler
                    );

                    // Use chunked sending if message length is limited
                    this.sendChunkedMessage(this.socket!, key, input);
                });
            };
        });

        return methods;
    }

    // Connect to a WebSocket server
    public async connect(
        url: string,
        useNativeWebSocket: boolean = false,
        options?: {
            reconnect?: boolean;
            maxReconnectAttempts?: number;
            reconnectDelay?: number;
        }
    ): Promise<void> {
        const {
            reconnect = false,
            maxReconnectAttempts = 5,
            reconnectDelay = 1000,
        } = options || {};

        const attemptConnection = async (
            attempt: number = 1
        ): Promise<void> => {
            // Close existing socket if it exists
            if (this.socket) {
                (this.socket as any).close();
                this.socket = null;
            }

            if (useNativeWebSocket) {
                this.socket = new this.socketType(url);
            } else {
                // TODO: Implement faster WebSocket client if needed
                this.socket = new this.socketType(url);
            }

            return new Promise<void>((resolve, reject) => {
                if (!this.socket)
                    return reject(new Error("Socket not initialized"));

                (this.socket as any).onopen = () => {
                    this.setupSocketHandlers(this.socket!);

                    // Execute default "open" function if it exists
                    const openHandler = this.methodCollection["open"];
                    if (openHandler) {
                        openHandler.handler({}, this.socket!).catch((error) => {
                            if (this.debugLog) {
                                this.logger({
                                    error: true,
                                    message: `Default 'open' handler error: ${error}`,
                                });
                            }
                        });
                    }

                    resolve();
                };

                (this.socket as any).onerror = (error: any) => {
                    if (this.debugLog) {
                        this.logger({
                            error: true,
                            message: `WebSocket connection error: ${error}`,
                        });
                    }
                    reject(error);
                };

                (this.socket as any).onclose = () => {
                    if (this.debugLog) {
                        this.logger({
                            message: "WebSocket connection closed",
                        });
                    }

                    // Execute default "close" function if it exists
                    const closeHandler = this.methodCollection["close"];
                    if (closeHandler) {
                        closeHandler
                            .handler({}, this.socket!)
                            .catch((error) => {
                                if (this.debugLog) {
                                    this.logger({
                                        error: true,
                                        message: `Default 'close' handler error: ${error}`,
                                    });
                                }
                            });
                    }

                    this.socket = null;

                    // Attempt reconnection if enabled and attempts remaining
                    if (reconnect && attempt < maxReconnectAttempts) {
                        setTimeout(() => {
                            if (this.debugLog) {
                                this.logger({
                                    message: `Attempting reconnection ${
                                        attempt + 1
                                    }/${maxReconnectAttempts}`,
                                });
                            }
                            attemptConnection(attempt + 1).catch((error) => {
                                if (this.debugLog) {
                                    this.logger({
                                        error: true,
                                        message: `Reconnection attempt ${
                                            attempt + 1
                                        } failed: ${error}`,
                                    });
                                }
                            });
                        }, reconnectDelay);
                    }
                };
            });
        };

        await attemptConnection();
    }

    // Edit a method's handler function (types remain the same)
    public editFunction<K extends keyof TMethods>(
        methodName: K,
        newHandler: TMethods[K]["handler"]
    ) {
        if (this.methodCollection[methodName]) {
            this.methodCollection[methodName].handler = newHandler;
        } else {
            throw new Error(`Method ${String(methodName)} not found`);
        }
    }

    // Handle incoming messages with explicit data and socket
    public handle(params: { data: any; socket: TSocket }) {
        let jsonData;
        try {
            jsonData = JSON.parse(params.data);
        } catch (error) {
            // Check if this is a raw transit chunk
            if (typeof params.data === "string" && params.data.includes(".")) {
                this.handleTransitChunk(params.data, params.socket);
                return;
            }

            if (this.debugLog) {
                this.logger({
                    error: true,
                    message: "Invalid JSON received",
                });
            }
            return;
        }

        if (!jsonData.method) {
            if (this.debugLog) {
                this.logger({
                    error: true,
                    message: "Method not found in request",
                });
            }
            return;
        }

        // Handle transit initiation messages
        if (jsonData.transit) {
            this.handleTransitInitiation(jsonData, params.socket);
            return;
        }

        if (!jsonData.input) {
            if (this.debugLog) {
                this.logger({
                    error: true,
                    message: "Input not found in request",
                });
            }
            return;
        }

        const method = this.methodCollection[jsonData.method];
        if (!method) {
            if (this.debugLog) {
                this.logger({
                    message: `Ignoring unfound method: ${jsonData.method}`,
                });
            }
            return;
        }

        try {
            const validatedInput = method.schema
                ? method.schema.parse(jsonData.input)
                : jsonData.input;

            // Execute the method handler without sending automatic response
            method.handler(validatedInput, params.socket).catch((error) => {
                if (this.debugLog) {
                    this.logger({
                        error: true,
                        message: `Method execution error: ${error}`,
                    });
                }

                // Execute default "error" function if it exists
                const errorHandler = this.methodCollection["error"];
                if (errorHandler) {
                    errorHandler
                        .handler({ error: error.message }, params.socket)
                        .catch((handlerError) => {
                            if (this.debugLog) {
                                this.logger({
                                    error: true,
                                    message: `Default 'error' handler error: ${handlerError}`,
                                });
                            }
                        });
                }
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                if (this.debugLog) {
                    this.logger({
                        error: true,
                        message: `Input validation failed for method ${jsonData.method}: ${error.errors}`,
                    });
                }
            } else {
                if (this.debugLog) {
                    this.logger({
                        error: true,
                        message: `Method execution error: ${error}`,
                    });
                }
            }
        }
    }

    // Handle transit initiation messages
    private handleTransitInitiation(jsonData: any, socket: TSocket) {
        const transitId = jsonData.transit;
        const methodName = jsonData.method;

        // Initialize transit storage
        this.transitStorage.set(transitId, {
            method: methodName,
            chunks: {},
        });

        if (this.debugLog) {
            this.logger({
                message: `Transit initiated: ${transitId} for method: ${methodName}`,
            });
        }
    }

    // Handle raw transit chunks
    private handleTransitChunk(rawData: string, socket: TSocket) {
        // Parse raw data: <TRANSIT_ID>.<CHUNK_INDEX>.<RAW_DATA>
        const parts = rawData.split(".");
        if (parts.length < 3) {
            if (this.debugLog) {
                this.logger({
                    error: true,
                    message: "Invalid transit chunk format",
                });
            }
            return;
        }

        const transitId = parts[0];
        const chunkIndex = parseInt(parts[1]);
        const chunkData = parts.slice(2).join("."); // Rejoin in case data contains dots

        // Get transit data
        const transitData = this.transitStorage.get(transitId);
        if (!transitData) {
            if (this.debugLog) {
                this.logger({
                    error: true,
                    message: `Transit ID not found: ${transitId}`,
                });
            }
            return;
        }

        // Store the chunk
        transitData.chunks[chunkIndex] = chunkData;

        // If this is the final chunk (chunk: -1), reassemble and process
        if (chunkIndex === -1) {
            try {
                // Get all chunk indices and sort them
                const chunkIndices = Object.keys(transitData.chunks)
                    .map(Number)
                    .filter((index) => index !== -1) // Exclude the final chunk
                    .sort((a, b) => a - b);

                // Reassemble the complete input string
                let completeInputString = "";
                for (const index of chunkIndices) {
                    completeInputString += transitData.chunks[index];
                }
                completeInputString += transitData.chunks[-1]; // Add the final chunk

                // Parse the reassembled JSON
                const completeInput = JSON.parse(completeInputString);

                // Clean up transit storage
                this.transitStorage.delete(transitId);

                // Process the complete message
                this.processCompleteMessage(
                    transitData.method,
                    completeInput,
                    socket
                );
            } catch (error) {
                if (this.debugLog) {
                    this.logger({
                        error: true,
                        message: `Error reassembling transit message: ${error}`,
                    });
                }
                // Clean up transit storage on error
                this.transitStorage.delete(transitId);
            }
        }
    }

    // Process complete message after chunk reassembly
    private processCompleteMessage(
        methodName: string,
        input: any,
        socket: TSocket
    ) {
        const method = this.methodCollection[methodName];
        if (!method) {
            if (this.debugLog) {
                this.logger({
                    message: `Ignoring unfound method: ${methodName}`,
                });
            }
            return;
        }

        try {
            const validatedInput = method.schema
                ? method.schema.parse(input)
                : input;

            // Execute the method handler without sending automatic response
            method.handler(validatedInput, socket).catch((error) => {
                if (this.debugLog) {
                    this.logger({
                        error: true,
                        message: `Method execution error: ${error}`,
                    });
                }

                // Execute default "error" function if it exists
                const errorHandler = this.methodCollection["error"];
                if (errorHandler) {
                    errorHandler
                        .handler({ error: error.message }, socket)
                        .catch((handlerError) => {
                            if (this.debugLog) {
                                this.logger({
                                    error: true,
                                    message: `Default 'error' handler error: ${handlerError}`,
                                });
                            }
                        });
                }
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                if (this.debugLog) {
                    this.logger({
                        error: true,
                        message: `Input validation failed for method ${methodName}: ${error.errors}`,
                    });
                }
            } else {
                if (this.debugLog) {
                    this.logger({
                        error: true,
                        message: `Method execution error: ${error}`,
                    });
                }
            }
        }
    }

    private setupSocketHandlers(socket: TSocket) {
        (socket as any).onmessage = (event: any) => {
            this.handle({
                data: event.data,
                socket: event.target,
            });
        };

        // Note: onclose and onerror are now handled in the connect method
        // to support default functions and reconnection logic
    }

    // Returns dummy functions that match the type signatures
    public getMethodTypes(): ToMethodTypes<TMethods> {
        const methodTypes = {} as ToMethodTypes<TMethods>;

        Object.entries(this.methodCollection).forEach(([key, method]) => {
            (methodTypes as any)[key] = {
                input: () => ({} as any),
                output: () => ({} as any),
            };
        });

        return methodTypes;
    }

    // Keep this for internal use only
    public getMethodCollection(): TMethods {
        return this.methodCollection;
    }

    // Public getter for socket access
    public getSocket(): TSocket | null {
        return this.socket;
    }

    // Create properly typed call methods
    public createCaller<TMethodTypes extends MethodTypeCollection>(params: {
        socket: TSocket;
        methods: TMethodTypes;
    }): CallableMethodsFromTypes<TMethodTypes> {
        const callHandler = new CallHandler<TMethodTypes, TSocket>(
            params.methods,
            this.maxMessageLength,
            this.safeCeiling
        );
        return callHandler.getCaller(params.socket);
    }

    // Public method to send responses manually
    public sendResponse(socket: TSocket, data: any) {
        (socket as any).send(JSON.stringify({ data }));
    }

    // Public method to send errors manually
    public sendError(socket: TSocket, message: string, details?: any) {
        (socket as any).send(
            JSON.stringify({
                error: message,
                details,
            })
        );
    }
}
