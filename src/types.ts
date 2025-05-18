import { z } from "zod";

export type DebugLogger = ({
    error,
    message,
}: {
    error?: boolean;
    message: string;
}) => void;

export type Action<TInput = any, TOutput = any> = {
    handler: (input: TInput) => Promise<TOutput>;
    schema: z.ZodSchema<TInput>;
};

export type ActionType<TInput = any, TOutput = any> = {
    input: TInput;
    output: TOutput;
};

export type ActionCollection = Record<string, Action>;
export type ActionTypeCollection = Record<string, ActionType>;

export type VCONNServerInit<TActions extends ActionCollection> = {
    debugLog?: boolean;
    logger?: DebugLogger;
    jsonResponseMaker?: (data: any, init?: ResponseInit) => Response;
    actions: TActions;
};

export type VCONNClientInit<TActionTypes extends ActionTypeCollection> = {
    actionTypes: TActionTypes;
    baseUrl: string;
};

export type CallableAction<TInput = any, TOutput = any> = (
    input: TInput
) => Promise<TOutput>;

export type ToActionTypes<TActions extends ActionCollection> = {
    [K in keyof TActions]: TActions[K] extends Action<
        infer TInput,
        infer TOutput
    >
        ? ActionType<TInput, TOutput>
        : never;
};

export type ClientActions<TActionTypes extends ActionTypeCollection> = {
    [K in keyof TActionTypes]: TActionTypes[K] extends ActionType<
        infer TInput,
        infer TOutput
    >
        ? CallableAction<TInput, TOutput>
        : never;
};
