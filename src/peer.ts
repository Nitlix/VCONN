import { z } from "zod";
import vconnLog from "./(util)/vconnLog";

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

// Call handler class with proper typing
export class CallHandler<
    TMethodTypes extends MethodTypeCollection,
    TSocket = WebSocket
> {
    private methodTypes: TMethodTypes;

    constructor(methodTypes: TMethodTypes) {
        this.methodTypes = methodTypes;
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
                    (socket as any).send(
                        JSON.stringify({
                            method: key,
                            input,
                        })
                    );
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

    public constructor(init: PeerInit<TMethods, TSocket>) {
        this.debugLog = init.debugLog ?? false;
        this.logger = init.logger ?? vconnLog;
        this.socketType = init.socketType ?? (WebSocket as any);
        this.methodCollection = init.methods;
    }

    // Static method to import method types from another peer
    public static importMethodTypes<TMethodTypes extends MethodTypeCollection>(
        sourcePeer: VCONNPeer<any, any>
    ): TMethodTypes {
        return sourcePeer.getMethodTypes() as TMethodTypes;
    }

    // Connect to a WebSocket server (client mode)
    public async connect(url: string, useNativeWebSocket: boolean = false) {
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
        });
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

    // Get callable methods for client usage
    public getCallableMethods(): PeerMethods<TMethods> {
        const methods = {} as PeerMethods<TMethods>;

        Object.keys(this.methodCollection).forEach((key) => {
            (methods as any)[key] = async (input: any) => {
                if (!this.socket) {
                    throw new Error(
                        "Socket not set. Use setSocket() or connect() first."
                    );
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
                    (this.socket as any).send(
                        JSON.stringify({
                            method: key,
                            input,
                        })
                    );
                });
            };
        });

        return methods;
    }

    // Handle incoming messages with explicit data and socket
    public handle(params: { data: any; socket: TSocket }) {
        let jsonData;
        try {
            jsonData = JSON.parse(params.data);
        } catch (error) {
            if (this.debugLog) {
                this.logger({
                    error: true,
                    message: "Invalid JSON received",
                });
            }
            this.sendError(params.socket, "Invalid JSON");
            return;
        }

        if (!jsonData.method) {
            this.sendError(params.socket, "Method not found");
            return;
        }

        if (!jsonData.input) {
            this.sendError(params.socket, "Input not found");
            return;
        }

        const method = this.methodCollection[jsonData.method];
        if (!method) {
            this.sendError(params.socket, "Method not found");
            return;
        }

        try {
            const validatedInput = method.schema
                ? method.schema.parse(jsonData.input)
                : jsonData.input;

            method
                .handler(validatedInput, params.socket)
                .then((result) => {
                    this.sendResponse(params.socket, result);
                })
                .catch((error) => {
                    if (this.debugLog) {
                        this.logger({
                            error: true,
                            message: `Method execution error: ${error}`,
                        });
                    }
                    this.sendError(params.socket, "Method execution failed");
                });
        } catch (error) {
            if (error instanceof z.ZodError) {
                this.sendError(params.socket, "Invalid input", error.errors);
            } else {
                if (this.debugLog) {
                    this.logger({
                        error: true,
                        message: `Method execution error: ${error}`,
                    });
                }
                this.sendError(params.socket, "Method execution failed");
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

        (socket as any).onclose = () => {
            if (this.debugLog) {
                this.logger({
                    message: "WebSocket connection closed",
                });
            }
            this.socket = null;
        };

        (socket as any).onerror = (error: any) => {
            if (this.debugLog) {
                this.logger({
                    error: true,
                    message: `WebSocket error: ${error}`,
                });
            }
        };
    }

    private sendResponse(socket: TSocket, data: any) {
        (socket as any).send(JSON.stringify({ data }));
    }

    private sendError(socket: TSocket, message: string, details?: any) {
        (socket as any).send(
            JSON.stringify({
                error: message,
                details,
            })
        );
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

    // Get properly typed call methods
    public getCaller<TMethodTypes extends MethodTypeCollection>(params: {
        socket: TSocket;
        methods: TMethodTypes;
    }): CallableMethodsFromTypes<TMethodTypes> {
        const callHandler = new CallHandler<TMethodTypes, TSocket>(
            params.methods
        );
        return callHandler.getCaller(params.socket);
    }
}
