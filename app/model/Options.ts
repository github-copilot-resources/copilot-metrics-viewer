/**
 * Strongly typed options class for GitHub Copilot Metrics Viewer
 * Handles serialization to/from query strings and provides type safety
 */
import type { QueryObject } from 'ufo';
import type { RouteLocationNormalizedLoadedGeneric } from 'vue-router';

export type Scope = 'organization' | 'enterprise';

/**
 * Returns the GitHub API base URL.
 * Reads NUXT_GITHUB_API_BASE_URL from the environment so GHE.com users can
 * point the app at their dedicated subdomain (e.g. https://api.SUBDOMAIN.ghe.com).
 * Falls back to the standard https://api.github.com.
 *
 * NOTE: NUXT_GITHUB_API_BASE_URL is a server-only variable and is never exposed to
 *       the browser bundle. The URL-building methods below are only called from
 *       server-side API handlers; client-side callers never invoke them.
 *       When this module is bundled for the client, process.env.NUXT_GITHUB_API_BASE_URL
 *       resolves to undefined and the fallback 'https://api.github.com' is used.
 */
function getGitHubApiBaseUrl(): string {
    return process.env.NUXT_GITHUB_API_BASE_URL || 'https://api.github.com';
}

/**
 * Encode a list of logins as URL-safe base64 (comma-joined, then base64url).
 */
export function encodeUsersParam(logins: string[]): string {
    const joined = logins.join(',')
    const b64 = typeof btoa !== 'undefined' ? btoa(joined) : Buffer.from(joined).toString('base64')
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

/**
 * Decode a URL-safe base64 users param back to a list of logins.
 */
export function decodeUsersParam(b64: string): string[] {
    const padded = b64.replace(/-/g, '+').replace(/_/g, '/')
    const decoded = typeof atob !== 'undefined' ? atob(padded) : Buffer.from(padded, 'base64').toString('utf-8')
    return decoded.split(',').filter(Boolean)
}

export interface OptionsData {
    since?: string;
    until?: string;
    isDataMocked?: boolean;
    githubOrg?: string;
    githubEnt?: string;
    githubTeam?: string;
    scope?: Scope;
    excludeHolidays?: boolean;
    locale?: string;
    /** Pre-resolved GitHub logins for a "reports-to" virtual team. */
    reportToLogins?: string[];
}

export interface RuntimeConfig {
    public: {
        scope?: string;
        githubOrg?: string;
        githubEnt?: string;
        githubTeam?: string;
        isDataMocked?: boolean;
    };
}

export interface RouteParams {
    ent?: string;
    org?: string;
    team?: string;
}

export interface RouteQuery {
    since?: string;
    until?: string;
    mock?: string;
}

export interface RouteInfo {
    params: RouteParams;
    query: RouteQuery;
}

export class Options {
    public since?: string;
    public until?: string;
    public isDataMocked?: boolean;
    public githubOrg?: string;
    public githubEnt?: string;
    public githubTeam?: string;
    public scope?: Scope;
    public excludeHolidays?: boolean;
    public locale?: string;
    /** Pre-resolved GitHub logins for a "reports-to" virtual team. */
    public reportToLogins?: string[];

    constructor(data: OptionsData = {}) {
        this.since = data.since;
        this.until = data.until;
        this.isDataMocked = data.isDataMocked;
        this.githubOrg = data.githubOrg;
        this.githubEnt = data.githubEnt;
        this.githubTeam = data.githubTeam;
        this.scope = data.scope;
        this.excludeHolidays = data.excludeHolidays;
        this.locale = data.locale;
        this.reportToLogins = data.reportToLogins;
    }

    /**
     * Create Options from route parameters and runtime config
     */
    static fromRoute(route: RouteLocationNormalizedLoadedGeneric, since: string | undefined = undefined, until: string | undefined = undefined): Options {
        const options = new Options();
        const config = useRuntimeConfig();

        if (since) options.since = since;
        if (until) options.until = until;

        // Handle mocking — must explicitly be true/truthy string, not just any non-empty value
        const isMocked = config.public.isDataMocked === true;
        if (route.query.mock || isMocked) {
            options.isDataMocked = true;
        }

        // Handle GitHub organization/enterprise/team parameters
        if (route.params.org) {
            options.githubOrg = route.params.org as string;
            options.scope = 'organization';
            if (route.params.team) options.githubTeam = route.params.team as string;
            // reports-to virtual team: treat as a team-scoped view
            if (route.params.upn) {
                options.githubTeam = `reports-to:${route.params.upn as string}`;
                const usersB64 = route.query.users as string | undefined;
                if (usersB64) options.reportToLogins = decodeUsersParam(usersB64);
            }
        } else if (route.params.ent) {
            options.githubEnt = route.params.ent as string;
            options.scope = 'enterprise';
            if (route.params.team) options.githubTeam = route.params.team as string;
            // reports-to virtual team: treat as a team-scoped view
            if (route.params.upn) {
                options.githubTeam = `reports-to:${route.params.upn as string}`;
                const usersB64 = route.query.users as string | undefined;
                if (usersB64) options.reportToLogins = decodeUsersParam(usersB64);
            }
        } else {
            // Use defaults from runtime config
            // Normalize legacy 'team-organization'/'team-enterprise' values to base scope
            const rawScope = config.public.scope as string;
            if (rawScope === 'team-organization') {
                options.scope = 'organization';
            } else if (rawScope === 'team-enterprise') {
                options.scope = 'enterprise';
            } else if (rawScope === 'organization' || rawScope === 'enterprise') {
                options.scope = rawScope;
            } else {
                options.scope = 'organization';
            }
            // In mock mode with no URL-based org/ent, use a fixed mock identity
            // so the UI never shows a real org name when browsing demo data
            if (options.isDataMocked) {
                options.githubOrg = 'octodemo';
                options.scope = 'organization';
            } else {
                if (config.public.githubOrg) options.githubOrg = config.public.githubOrg;
                if (config.public.githubEnt) options.githubEnt = config.public.githubEnt;
                if (config.public.githubTeam) options.githubTeam = config.public.githubTeam as string;
            }
        }

        return options;
    }


    /**
     * Create Options from URLSearchParams
     */
    static fromURLSearchParams(params: URLSearchParams): Options {
        const rawScope = params.get('scope');
        const scope = rawScope === 'team-organization' ? 'organization'
            : rawScope === 'team-enterprise' ? 'enterprise'
            : (rawScope as Scope) || undefined;
        const options = new Options({
            since: params.get('since') || undefined,
            until: params.get('until') || undefined,
            githubOrg: params.get('githubOrg') || undefined,
            githubEnt: params.get('githubEnt') || undefined,
            githubTeam: params.get('githubTeam') || undefined,
            scope,
            locale: params.get('locale') || undefined
        });

        // Only set boolean properties if they're explicitly provided
        if (params.has('isDataMocked')) {
            options.isDataMocked = params.get('isDataMocked') === 'true';
        }

        if (params.has('excludeHolidays')) {
            options.excludeHolidays = params.get('excludeHolidays') === 'true';
        }

        const usersB64 = params.get('users');
        if (usersB64) options.reportToLogins = decodeUsersParam(usersB64);

        return options;
    }

    static fromQuery(query: QueryObject): Options {
        const rawScope = query.scope as string | undefined;
        const scope = rawScope === 'team-organization' ? 'organization'
            : rawScope === 'team-enterprise' ? 'enterprise'
            : (rawScope as Scope) || undefined;
        const options = new Options({
            since: query.since as string | undefined,
            until: query.until as string | undefined,
            githubOrg: query.githubOrg as string | undefined,
            githubEnt: query.githubEnt as string | undefined,
            githubTeam: query.githubTeam as string | undefined,
            scope,
            locale: query.locale as string | undefined
        });

        // Only set boolean properties if they're explicitly provided
        if (query.isDataMocked !== undefined) {
            options.isDataMocked = query.isDataMocked === 'true';
        }

        if (query.excludeHolidays !== undefined) {
            options.excludeHolidays = query.excludeHolidays === 'true';
        }

        const usersB64 = query.users as string | undefined;
        if (usersB64) options.reportToLogins = decodeUsersParam(usersB64);

        return options;
    }

    /**
     * Serialize to query string
     */
    toQueryString(): string {
        return this.toURLSearchParams().toString();
    }

    /**
     * Serialize to URLSearchParams
     */
    toURLSearchParams(): URLSearchParams {
        const params = new URLSearchParams();

        if (this.since) params.set('since', this.since);
        if (this.until) params.set('until', this.until);
        if (this.isDataMocked) params.set('isDataMocked', 'true');
        if (this.githubOrg) params.set('githubOrg', this.githubOrg);
        if (this.githubEnt) params.set('githubEnt', this.githubEnt);
        if (this.githubTeam) params.set('githubTeam', this.githubTeam);
        if (this.scope) params.set('scope', this.scope);
        if (this.excludeHolidays) params.set('excludeHolidays', 'true');
        if (this.locale) params.set('locale', this.locale);
        if (this.reportToLogins?.length) params.set('users', encodeUsersParam(this.reportToLogins));

        return params;
    }

    toParams(): Record<string, string> {
        const params: Record<string, string> = {};
        if (this.since) params.since = this.since;
        if (this.until) params.until = this.until;
        if (this.isDataMocked) params.isDataMocked = String(this.isDataMocked);
        if (this.githubOrg) params.githubOrg = this.githubOrg;
        if (this.githubEnt) params.githubEnt = this.githubEnt;
        if (this.githubTeam) params.githubTeam = this.githubTeam;
        if (this.scope) params.scope = this.scope;
        if (this.excludeHolidays) params.excludeHolidays = String(this.excludeHolidays);
        if (this.locale) params.locale = this.locale;
        if (this.reportToLogins?.length) params.users = encodeUsersParam(this.reportToLogins);
        return params;
    }

    /**
     * Serialize to plain object
     */
    toObject(): OptionsData {
        const result: OptionsData = {};

        if (this.since !== undefined) result.since = this.since;
        if (this.until !== undefined) result.until = this.until;
        if (this.isDataMocked !== undefined) result.isDataMocked = this.isDataMocked;
        if (this.githubOrg !== undefined) result.githubOrg = this.githubOrg;
        if (this.githubEnt !== undefined) result.githubEnt = this.githubEnt;
        if (this.githubTeam !== undefined) result.githubTeam = this.githubTeam;
        if (this.scope !== undefined) result.scope = this.scope;
        if (this.excludeHolidays !== undefined) result.excludeHolidays = this.excludeHolidays;
        if (this.locale !== undefined) result.locale = this.locale;
        if (this.reportToLogins !== undefined) result.reportToLogins = this.reportToLogins;

        return result;
    }

    /**
     * Clone the options
     */
    clone(): Options {
        return new Options(this.toObject());
    }

    /**
     * Merge with another Options instance
     */
    merge(other: Options): Options {
        return new Options({
            since: other.since ?? this.since,
            until: other.until ?? this.until,
            isDataMocked: other.isDataMocked ?? this.isDataMocked,
            githubOrg: other.githubOrg ?? this.githubOrg,
            githubEnt: other.githubEnt ?? this.githubEnt,
            githubTeam: other.githubTeam ?? this.githubTeam,
            scope: other.scope ?? this.scope,
            excludeHolidays: other.excludeHolidays ?? this.excludeHolidays,
            locale: other.locale ?? this.locale,
            reportToLogins: other.reportToLogins ?? this.reportToLogins
        });
    }

    /**
     * Check if date range is set
     */
    hasDateRange(): boolean {
        return Boolean(this.since || this.until);
    }

    /**
     * Check if GitHub organization/enterprise settings are configured
     */
    hasGitHubConfig(): boolean {
        return Boolean(this.githubOrg || this.githubEnt);
    }

    /**
     * Get the API URL based on scope and configuration
     */
    getApiUrl(): string {
        const baseUrl = getGitHubApiBaseUrl();
        let url = '';

        switch (this.scope) {
            case 'organization':
                if (!this.githubOrg) {
                    throw new Error('GitHub organization must be set for organization scope');
                }
                url = `${baseUrl}/orgs/${this.githubOrg}/copilot/metrics`;
                break;

            case 'enterprise':
                if (!this.githubEnt) {
                    throw new Error('GitHub enterprise must be set for enterprise scope');
                }
                url = `${baseUrl}/enterprises/${this.githubEnt}/copilot/metrics`;
                break

            default:
                throw new Error(`Invalid scope: ${this.scope}`);
        }

        if (this.since || this.until) {
            const sinceParam = this.since ? `since=${encodeURIComponent(this.since)}` : '';
            const untilParam = this.until ? `until=${encodeURIComponent(this.until)}` : '';
            const params = [sinceParam, untilParam].filter(Boolean).join('&');
            url += params ? `?${params}` : '';
        }
        return url;
    }

    /**
     * Get the Seats API URL based on scope and configuration
     */
    getSeatsApiUrl(): string {
        const baseUrl = getGitHubApiBaseUrl();

        switch (this.scope) {
            case 'organization':
                if (!this.githubOrg) {
                    throw new Error('GitHub organization must be set for organization scope');
                }
                return `${baseUrl}/orgs/${this.githubOrg}/copilot/billing/seats`;

            case 'enterprise':
                if (!this.githubEnt) {
                    throw new Error('GitHub enterprise must be set for enterprise scope');
                }
                return `${baseUrl}/enterprises/${this.githubEnt}/copilot/billing/seats`;

            default:
                throw new Error(`Invalid scope: ${this.scope}`);
        }
    }
    
    /**
     * Get the Teams API URL based on scope and configuration.
     * For enterprise scope with a githubOrg override, returns the org teams URL
     * to support browsing org-level teams in Full GHEC enterprises.
     */
    getTeamsApiUrl(): string {
        const baseUrl = getGitHubApiBaseUrl();

        switch (this.scope) {
            case 'organization':
                if (!this.githubOrg) {
                    throw new Error('GitHub organization must be set for organization scope');
                }
                return `${baseUrl}/orgs/${this.githubOrg}/teams`;

            case 'enterprise':
                if (!this.githubEnt) {
                    throw new Error('GitHub enterprise must be set for enterprise scope');
                }
                // When an org is selected (Full GHEC), list that org's teams
                if (this.githubOrg) {
                    return `${baseUrl}/orgs/${this.githubOrg}/teams`;
                }
                return `${baseUrl}/enterprises/${this.githubEnt}/teams`;

            default:
                throw new Error(`Invalid scope: ${this.scope}`);
        }
    }

    /**
     * Get the team members API URL based on scope and configuration.
     * For enterprise scope with a githubOrg override, uses the org-level members
     * endpoint to support org-level teams in Full GHEC enterprises.
     */
    getTeamMembersApiUrl(): string {
        const baseUrl = getGitHubApiBaseUrl();

        switch (this.scope) {
            case 'organization':
                if (!this.githubOrg || !this.githubTeam) {
                    throw new Error('GitHub organization and team must be set for organization scope');
                }
                return `${baseUrl}/orgs/${this.githubOrg}/teams/${this.githubTeam}/members`;

            case 'enterprise':
                if (!this.githubEnt || !this.githubTeam) {
                    throw new Error('GitHub enterprise and team must be set for enterprise scope');
                }
                // When an org is selected (Full GHEC), use org-based team members endpoint
                if (this.githubOrg) {
                    return `${baseUrl}/orgs/${this.githubOrg}/teams/${this.githubTeam}/members`;
                }
                return `${baseUrl}/enterprises/${this.githubEnt}/teams/${this.githubTeam}/memberships`;

            default:
                throw new Error(`Invalid scope: ${this.scope}`);
        }
    }

    /**
     * Get the mock data path based on scope
     */
    getMockDataPath(): string {
        switch (this.scope) {
            case 'enterprise':
                return 'public/mock-data/enterprise_metrics_response_sample.json';

            default:
                return 'public/mock-data/organization_metrics_response_sample.json';
        }
    }

    /**
 * Get the mock data path based on scope
 */
    getSeatsMockDataPath(): string {
        switch (this.scope) {
            case 'enterprise':
                return 'public/mock-data/enterprise_seats_response_sample.json';

            default:
                return 'public/mock-data/organization_seats_response_sample.json';
        }
    }

    /**
     * Get the mock data path for per-user metrics based on scope
     */
    getUserMetricsMockDataPath(): string {
        switch (this.scope) {
            case 'enterprise':
                return 'public/mock-data/new-api/enterprise-users-28-day-report.json';

            default:
                return 'public/mock-data/new-api/organization-users-28-day-report.json';
        }
    }

    /**
     * Validate the options
     */
    validate(): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (this.scope === 'organization') {
            if (!this.githubOrg) {
                errors.push('GitHub organization must be set for organization scopes');
            }
        }

        if (this.scope === 'enterprise') {
            if (!this.githubEnt) {
                errors.push('GitHub enterprise must be set for enterprise scopes');
            }
        }

        // Validate date range
        if (this.since && this.until) {
            const sinceDate = new Date(this.since);
            const untilDate = new Date(this.until);

            if (sinceDate > untilDate) {
                errors.push('Since date must be before until date');
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Convert to string representation
     */
    toString(): string {
        return `Options(${this.toQueryString()})`;
    }
}
