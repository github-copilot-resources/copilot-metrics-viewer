/**
 * Strongly typed options class for GitHub Copilot Metrics Viewer
 * Handles serialization to/from query strings and provides type safety
 */
import type { QueryObject } from 'ufo';
import type { RouteLocationNormalizedLoadedGeneric } from 'vue-router';

export type Scope = 'organization' | 'enterprise' | 'team-organization' | 'team-enterprise';

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
    }

    /**
     * Create Options from route parameters and runtime config
     */
    static fromRoute(route: RouteLocationNormalizedLoadedGeneric, since: string | undefined = undefined, until: string | undefined = undefined): Options {
        const options = new Options();
        const config = useRuntimeConfig();

        if (since) options.since = since;
        if (until) options.until = until;

        // Handle mocking
        if (route.query.mock || config.public.isDataMocked) {
            options.isDataMocked = true;
        }

        // Handle GitHub organization/enterprise/team parameters
        if (route.params.org) {
            options.githubOrg = route.params.org as string;

            if (route.params.team) {
                options.githubTeam = route.params.team as string;
                options.scope = 'team-organization';
            } else {
                options.scope = 'organization';
            }
        } else if (route.params.ent) {
            options.githubEnt = route.params.ent as string;

            if (route.params.team) {
                options.githubTeam = route.params.team as string;
                options.scope = 'team-enterprise';
            } else {
                options.scope = 'enterprise';
            }
        } else {
            // Use defaults from runtime config
            options.scope = (config.public.scope as Scope) || 'organization';
            if (config.public.githubOrg) options.githubOrg = config.public.githubOrg;
            if (config.public.githubEnt) options.githubEnt = config.public.githubEnt;
            if (config.public.githubTeam) options.githubTeam = config.public.githubTeam;
        }

        return options;
    }


    /**
     * Create Options from URLSearchParams
     */
    static fromURLSearchParams(params: URLSearchParams): Options {
        const options = new Options({
            since: params.get('since') || undefined,
            until: params.get('until') || undefined,
            githubOrg: params.get('githubOrg') || undefined,
            githubEnt: params.get('githubEnt') || undefined,
            githubTeam: params.get('githubTeam') || undefined,
            scope: (params.get('scope') as Scope) || undefined,
            locale: params.get('locale') || undefined
        });

        // Only set boolean properties if they're explicitly provided
        if (params.has('isDataMocked')) {
            options.isDataMocked = params.get('isDataMocked') === 'true';
        }

        if (params.has('excludeHolidays')) {
            options.excludeHolidays = params.get('excludeHolidays') === 'true';
        }

        return options;
    }

    static fromQuery(query: QueryObject): Options {
        const options = new Options({
            since: query.since as string | undefined,
            until: query.until as string | undefined,
            githubOrg: query.githubOrg as string | undefined,
            githubEnt: query.githubEnt as string | undefined,
            githubTeam: query.githubTeam as string | undefined,
            scope: (query.scope as Scope) || undefined,
            locale: query.locale as string | undefined
        });

        // Only set boolean properties if they're explicitly provided
        if (query.isDataMocked !== undefined) {
            options.isDataMocked = query.isDataMocked === 'true';
        }

        if (query.excludeHolidays !== undefined) {
            options.excludeHolidays = query.excludeHolidays === 'true';
        }

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
            locale: other.locale ?? this.locale
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
        const baseUrl = 'https://api.github.com';
        let url = '';

        switch (this.scope) {
            case 'team-organization':
                if (!this.githubOrg || !this.githubTeam) {
                    throw new Error('GitHub organization and team must be set for team-organization scope');
                }
                url = `${baseUrl}/orgs/${this.githubOrg}/team/${this.githubTeam}/copilot/metrics`;
                break

            case 'organization':
                if (!this.githubOrg) {
                    throw new Error('GitHub organization must be set for organization scope');
                }
                url = `${baseUrl}/orgs/${this.githubOrg}/copilot/metrics`;
                break;

            case 'team-enterprise':
                if (!this.githubEnt || !this.githubTeam) {
                    throw new Error('GitHub enterprise and team must be set for team-enterprise scope');
                }
                url = `${baseUrl}/enterprises/${this.githubEnt}/team/${this.githubTeam}/copilot/metrics`;
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
        const baseUrl = 'https://api.github.com';

        switch (this.scope) {
            case 'team-organization':
            case 'organization':
                if (!this.githubOrg) {
                    throw new Error('GitHub organization must be set for organization scope');
                }
                return `${baseUrl}/orgs/${this.githubOrg}/copilot/billing/seats`;

            case 'team-enterprise':
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
     * Get the Teams API URL based on scope and configuration
     */
    getTeamsApiUrl(): string {
        const baseUrl = 'https://api.github.com';

        switch (this.scope) {
            case 'team-organization':
            case 'organization':
                if (!this.githubOrg) {
                    throw new Error('GitHub organization must be set for organization scope');
                }
                return `${baseUrl}/orgs/${this.githubOrg}/teams`;

            case 'team-enterprise':
            case 'enterprise':
                if (!this.githubEnt) {
                    throw new Error('GitHub enterprise must be set for enterprise scope');
                }
                return `${baseUrl}/enterprises/${this.githubEnt}/teams`;

            default:
                throw new Error(`Invalid scope: ${this.scope}`);
        }
    }

    /**
     * Get the Teams API URL based on scope and configuration
     */
    getTeamMembersApiUrl(): string {
        const baseUrl = 'https://api.github.com';

        switch (this.scope) {
            case 'team-organization':
            case 'organization':
                if (!this.githubOrg || !this.githubTeam) {
                    throw new Error('GitHub organization and team must be set for organization scope');
                }
                return `${baseUrl}/orgs/${this.githubOrg}/teams/${this.githubTeam}/members`;

            case 'team-enterprise':
            case 'enterprise':
                if (!this.githubEnt || !this.githubTeam) {
                    throw new Error('GitHub enterprise and team must be set for enterprise scope');
                }
                return `${baseUrl}/enterprises/${this.githubEnt}/teams/${this.githubTeam}/members`;

            default:
                throw new Error(`Invalid scope: ${this.scope}`);
        }
    }

    /**
     * Get the mock data path based on scope
     */
    getMockDataPath(): string {
        switch (this.scope) {
            case 'team-organization':
            case 'organization':
                return 'public/mock-data/organization_metrics_response_sample.json';

            case 'team-enterprise':
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
            case 'team-organization':
            case 'organization':
                return 'public/mock-data/organization_seats_response_sample.json';

            case 'team-enterprise':
            case 'enterprise':
                return 'public/mock-data/enterprise_seats_response_sample.json';

            default:
                return 'public/mock-data/organization_seats_response_sample.json';
        }
    }

    /**
     * Validate the options
     */
    validate(): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];

        // Validate scope-specific requirements
        if (this.scope === 'team-organization' || this.scope === 'team-enterprise') {
            if (!this.githubTeam) {
                errors.push('GitHub team must be set for team scopes');
            }
        }

        if (this.scope === 'organization' || this.scope === 'team-organization') {
            if (!this.githubOrg) {
                errors.push('GitHub organization must be set for organization scopes');
            }
        }

        if (this.scope === 'enterprise' || this.scope === 'team-enterprise') {
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
