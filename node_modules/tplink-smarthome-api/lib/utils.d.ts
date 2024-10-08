export declare function isObjectLike(candidate: unknown): candidate is Record<string, unknown>;
export declare function objectHasKey<T>(obj: T, key: PropertyKey): key is keyof T;
/**
 * Represents an error result received from a TP-Link device.
 *
 * Where response err_code != 0.
 */
export declare class ResponseError extends Error {
    readonly response: string;
    readonly command: string;
    readonly modules: string[];
    readonly methods: string[];
    /**
     * Set by `Error.captureStackTrace`
     */
    readonly stack = "";
    /**
     *
     * @param message -
     * @param response -
     * @param command - command sent to device
     * @param modules - array of module names that returned with errors.
     * @param methods - array of method names (format: `${moduleName}.${methodName}`) that returned with errors.
     */
    constructor(message: string, response: string, command: string, modules?: string[], methods?: string[]);
}
export declare function isDefinedAndNotNull<T>(candidate: T): candidate is Exclude<T, null | undefined>;
export type HasErrCode = {
    err_code: number;
    err_msg?: string;
};
export declare function hasErrCode(candidate: unknown): candidate is HasErrCode;
export declare function normalizeMac(mac?: string): string;
export declare function compareMac(mac: string | undefined, macPattern: string | string[]): boolean;
export declare function replaceControlCharacters(input: string, replace?: string): string;
/**
 *
 * @param module
 * @param method
 * @param response
 */
export declare function processSingleCommandResponse(module: string, method: string, command: string, response: string): HasErrCode;
/**
 *
 * @param command
 * @param response
 * @returns
 * @throws {@link ResponseError}
 */
export declare function processResponse(command: Record<string, unknown>, response: unknown): Record<string, unknown>;
/**
 * Extract `path` from `response` (from `Client#sendCommand`) and run `typeGuardFn`
 *
 * @param response
 * @param path passed to `lodash.get`
 * @param typeGuardFn
 * @returns value of `path` in `response`
 * @throws Error
 * @throws {@link TypeError}
 */
export declare function extractResponse<T>(response: unknown, path: string | string[], typeGuardFn: (arg0: unknown) => boolean): T;
//# sourceMappingURL=utils.d.ts.map