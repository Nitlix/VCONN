import { ActionTypeCollection, ClientActions, VCONNClientInit } from "./types";

export default class VCONNClientConstructor<
    TActionTypes extends ActionTypeCollection
> {
    private baseUrl: string;
    private actionTypes: TActionTypes;

    public constructor({
        actionTypes,
        baseUrl,
    }: VCONNClientInit<TActionTypes>) {
        this.baseUrl = baseUrl;
        this.actionTypes = actionTypes;
    }

    public getClient(): ClientActions<TActionTypes> {
        const client = {} as ClientActions<TActionTypes>;

        Object.keys(this.actionTypes).forEach((key) => {
            (client as any)[key] = async (input: any) => {
                const response = await fetch(this.baseUrl, {
                    method: "POST",
                    body: JSON.stringify({ action: key, input }),
                });
                try {
                    const json = (await response.json()) as any;
                    if (!json.data) {
                        throw new Error("No data returned");
                    }
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
