import { z } from "zod";
import vconnLog from "./(util)/vconnLog";
import {
    DebugLogger,
    Action,
    ActionCollection,
    ActionType,
    ToActionTypes,
    VCONNServerInit,
} from "./types";

export default class VCONNServer<TActions extends ActionCollection> {
    private actionCollection: TActions;
    private logger: DebugLogger = vconnLog;
    private debugLog: boolean = false;
    private jsonResponseMaker: (data: any, init?: ResponseInit) => Response;

    public constructor({
        debugLog = false,
        logger,
        jsonResponseMaker = Response.json,
        actions,
    }: VCONNServerInit<TActions>) {
        this.debugLog = debugLog;
        logger ? (this.logger = logger) : "";
        this.jsonResponseMaker = jsonResponseMaker;
        this.actionCollection = actions;
    }

    public async handleRequest(request: Request) {
        let jsonData: any;
        try {
            jsonData = await request.json();
        } catch (error) {
            this.debugLog
                ? this.logger({
                      error: true,
                      message: "Invalid JSON",
                  })
                : "";
            return this.jsonResponseMaker(
                {
                    error: "Invalid JSON",
                },
                { status: 400 }
            );
        }

        const action = this.actionCollection[jsonData.action];
        if (!action) {
            return Response.json(
                {
                    error: "Action not found",
                },
                { status: 404 }
            );
        }

        try {
            const validatedInput = action.schema.parse(jsonData.input);
            const result = await action.handler({ ...validatedInput, request });
            return this.jsonResponseMaker({ data: result });
        } catch (error) {
            if (error instanceof z.ZodError) {
                return this.jsonResponseMaker(
                    { error: "Invalid input", details: error.errors },
                    { status: 400 }
                );
            }
            throw error;
        }
    }

    // Returns dummy functions that match the type signatures
    public getActionTypes(): ToActionTypes<TActions> {
        const actionTypes = {} as ToActionTypes<TActions>;

        Object.entries(this.actionCollection).forEach(([key, action]) => {
            // Create a dummy function that matches the type signature
            (actionTypes as any)[key] = {
                input: (() => {}) as any, // Dummy function for input type
                output: (() => {}) as any, // Dummy function for output type
            };
        });

        return actionTypes;
    }

    // Keep this for internal use only
    private getActionCollection(): TActions {
        return this.actionCollection;
    }
}
