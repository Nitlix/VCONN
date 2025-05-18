import { ActionCollection, CallableAction } from "./types";

export default class VCONNClientConstructor<TActions extends ActionCollection> {
    private baseUrl: string;
    private actions: TActions;

    public constructor({
        actions,
        baseUrl,
    }: {
        actions: TActions;
        baseUrl: string;
    }) {
        this.baseUrl = baseUrl;
        this.actions = actions;
    }

    public getClient(): {
        [K in keyof TActions]: TActions[K] extends {
            handler: (input: infer TInput) => Promise<infer TOutput>;
        }
            ? CallableAction<Omit<TInput, "request">, TOutput>
            : never;
    } {
        const client = {} as any;

        Object.keys(this.actions).forEach((key) => {
            client[key] = async (input: any) => {
                const response = await fetch(this.baseUrl, {
                    method: "POST",
                    body: JSON.stringify({ action: key, input }),
                });
                try {
                    const json = (await response.json()) as any;
                    if (json.error) {
                        throw new Error(json.error);
                    }
                    return json.data;
                } catch (error) {
                    console.error(error);
                    return null;
                }
            };
        });

        return client;
    }
}
