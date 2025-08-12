import * as urlLib from 'url';

// Global test setup
// Force mock mode so server-side handlers use local mock data instead of hitting GitHub APIs.
process.env.NUXT_PUBLIC_IS_DATA_MOCKED = 'true';

function isGitHub(url: string): boolean {
    const host = urlLib.parse(url).host;
    return host === 'api.github.com' || host === 'api.github.com:443';
}

// Block accidental real GitHub API calls if mock mode logic fails.
const originalFetch: typeof globalThis.fetch | undefined = globalThis.fetch;
if (originalFetch) {
    globalThis.fetch = (async (...args: Parameters<typeof fetch>): Promise<Response> => {
        const url = String(args[0]);
        if (isGitHub(url)) {
            throw new Error(`Blocked external GitHub API call during tests: ${url}`);
        }
        return originalFetch(...args);
    }) as typeof fetch;
}

// Stub $fetch (ofetch) similarly if present at runtime.
if (typeof globalThis.$fetch === 'function') {
    const original$fetch = globalThis.$fetch;
    const wrapped: typeof globalThis.$fetch = ((url: unknown, opts: unknown) => {
        const str = String(url);
        if (isGitHub(str)) {
            return Promise.reject(new Error(`Blocked external GitHub API call during tests via $fetch: ${str}`));
        }
        return original$fetch(url as never, opts as never);
    }) as typeof globalThis.$fetch;
    // Preserve special properties if present
    (wrapped as unknown as { raw?: unknown }).raw = (original$fetch as unknown as { raw?: () => unknown }).raw?.bind(original$fetch);
    (wrapped as unknown as { create?: unknown }).create = (original$fetch as unknown as { create?: () => unknown }).create?.bind(original$fetch);
    globalThis.$fetch = wrapped;
}
