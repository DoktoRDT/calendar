export function isDevEnvironment(): boolean {
    const proc = (globalThis as {process?: {env?: {NODE_ENV?: string}}}).process;
    return proc?.env?.NODE_ENV !== 'production';
}

export function warn(message: string): void {
    if (isDevEnvironment()) {
        console.warn(`[@nelmad/calendar] ${message}`);
    }
}
