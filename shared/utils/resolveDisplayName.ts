import getDisplayName from './getDisplayName';

export interface ResolveDisplayNameOpts {
  urlOrg: string;
  urlEnt: string;
  isMockMode: boolean;
  configOrg?: string;
  configEnt?: string;
  configScope?: string;
  teamName?: string;
}

/**
 * Resolves the page display name for MainComponent, respecting URL route params
 * (org/ent) over mock-mode defaults and runtime config.
 *
 * Priority:
 *  1. URL org param  → show as Organization
 *  2. URL ent param  → show as Enterprise
 *  3. Mock mode      → fall back to 'octodemo'
 *  4. Real mode      → use runtime config org/ent
 */
export function resolveDisplayName(opts: ResolveDisplayNameOpts): string {
  let effectiveOrg: string;
  let effectiveEnt: string;

  if (opts.urlOrg) {
    effectiveOrg = opts.urlOrg;
    effectiveEnt = '';
  } else if (opts.urlEnt) {
    effectiveOrg = '';
    effectiveEnt = opts.urlEnt;
  } else {
    effectiveOrg = opts.isMockMode ? 'octodemo' : (opts.configOrg || '');
    effectiveEnt = opts.isMockMode ? '' : (opts.configEnt || '');
  }

  const base = getDisplayName({
    githubOrg: effectiveOrg,
    githubEnt: effectiveEnt,
    scope: opts.configScope || 'organization',
  });

  return opts.teamName ? `${base} | Team : ${opts.teamName}` : base;
}
