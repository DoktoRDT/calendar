/** A policy callback's answer as data. A malformed result is a denial: `reason` undefined (genericBlockedReason) plus a diagnostic. */
export type NormalizedPolicyResult<P extends string = string> =
    | Readonly<{allowed: true}>
    | Readonly<{allowed: false; reason: string | undefined; diagnostic?: Readonly<{path: P; reason: string}>}>;

const allowed: NormalizedPolicyResult<never> = Object.freeze({allowed: true});

/**
 * Fails closed, the same in production and development (#9 Q7, shared with selection in #11): only the exact `true`
 * allows; `{allowed: false, reason}` with a non-empty reason after `trim()` denies with that reason as returned.
 * Reads `allowed` and `reason` only, never spreads or clones the result. The diagnostic text exists only in development.
 */
export function normalizePolicyResult<P extends string>(result: unknown, path: P): NormalizedPolicyResult<P> {
    if (result === true) return allowed;
    if (result !== null && typeof result === 'object' && !Array.isArray(result)) {
        const {allowed: value, reason} = result as {allowed?: unknown; reason?: unknown};
        if (value === false && typeof reason === 'string' && reason.trim()) return {allowed: false, reason};
    }
    if (process.env.NODE_ENV === 'production') return {allowed: false, reason: undefined};
    return {allowed: false, reason: undefined,
        diagnostic: {path, reason: 'Expected true or {allowed: false, reason: non-empty string}; treating the result as a denial'}};
}
