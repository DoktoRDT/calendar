import type {PolicyResult} from '../reference.js';

/** Same shape as ControllerDiagnostic; defined in core because core must not import src/v02/calendar. */
export type PolicyDiagnostic = Readonly<{path: string; reason: string}>;
export type PolicyOutcome = Readonly<{allowed: true}> | Readonly<{allowed: false; reason: string | undefined; diagnostic?: PolicyDiagnostic}>;

const allowed: PolicyOutcome = Object.freeze({allowed: true});
/**
 * One `interactionPolicy` result, failing closed (#9 decision Q7, #11 decision Q6): only exactly `true` allows, and
 * `{allowed: false, reason}` with a string reason that is non-empty after `trim()` denies with that reason as returned.
 * Anything else denies with `reason: undefined` (shown as `genericBlockedReason`) and, in development, one diagnostic per
 * evaluation that the controller's `warn` deduplicates. Only `allowed` and `reason` are read; the result is never spread
 * or cloned. A throwing callback is not caught by the caller either.
 */
export function normalizePolicyResult(result: PolicyResult, path: string): PolicyOutcome {
    if (result === true) return allowed;
    if (typeof result === 'object' && result !== null && result.allowed === false) {
        const reason: unknown = result.reason;
        if (typeof reason === 'string' && reason.trim()) return {allowed: false, reason};
    }
    if (process.env.NODE_ENV === 'production') return {allowed: false, reason: undefined};
    return {allowed: false, reason: undefined, diagnostic: {path, reason: 'Expected true or {allowed: false, reason: non-empty string}; treating the result as a denial'}};
}
