const PROPS = ["MOCKED_DATA", "SCOPE", "GITHUB_ORG", "GITHUB_ENT", "GITHUB_TEAM", "GITHUB_TOKEN", "GITHUB_API"];

const env: any = {};
PROPS.forEach(prop => {
	const propName = `VUE_APP_${prop}`;
	if (process.env.NODE_ENV === "production") {
		env[propName] = (window as any)["_ENV_"][propName];
	}
	else {
		env[propName] = process.env[propName];
	}
});

const VALID_SCOPE = ['organization', 'enterprise'];

let scopeType;
if (VALID_SCOPE.includes(env.VUE_APP_SCOPE)) {
	scopeType = env.VUE_APP_SCOPE as 'enterprise' | 'organization'
}

let apiUrl: string;
const githubOrgName = env.VUE_APP_GITHUB_ORG;
const githubEntName = env.VUE_APP_GITHUB_ENT;
const baseApi = env.VUE_APP_GITHUB_API;


let scopeName: string;
if (scopeType === 'organization') {
	scopeName = githubOrgName;
	apiUrl = `${baseApi || 'https://api.github.com'}/orgs/${githubOrgName}`;
}
else if (scopeType === 'enterprise') {
	scopeName = githubEntName;
	apiUrl = `${baseApi || 'https://api.github.com'}/enterprises/${githubEntName}`;
}
else {
	throw new Error(`Invalid VUE_APP_SCOPE value: ${env.VUE_APP_SCOPE}. Valid values: ${VALID_SCOPE.join(', ')}`)
}

const config: Config = {
	mockedData: env.VUE_APP_MOCKED_DATA === "true",
	scope: {
		type: scopeType,
		name: scopeName
	},
	github: {
		org: githubOrgName,
		ent: githubEntName,
		team: env.VUE_APP_GITHUB_TEAM,
		token: env.VUE_APP_GITHUB_TOKEN,
		apiUrl,
		baseApi
	}
}
if (!config.mockedData && !config.github.token && !config.github.baseApi) {
	throw new Error("VUE_APP_GITHUB_TOKEN environment variable must be set or calls have to be proxied by the api layer.");
}

export default config;

interface Config {
	mockedData: boolean;
	scope: {
		type: 'organization' | 'enterprise';
		name: string;
	};
	github: {
		/** The GitHub organization name. */
		org: string; 
		/** The GitHub enterprise name. */
		ent: string;
		/** The GitHub team name. */
		team: string;
		/** 
		 * The GitHub token to authenticate requests. 
		 * 
		 * CAUTION: Do not expose the token in the client-side code.
		 * */
		token: string;
		/**
		 * The GitHub API URL, different for GitHub Organization and GitHub Enterprise.
		 * 
		 * This is the base URL for the GitHub API. It can be customized to use GitHub Enterprise or GitHub.com.
		 * When using the proxy, it used `env.VUE_APP_GITHUB_API` to set the base URL, so that requests are sent to the proxy before being forwarded to the GitHub API.
		 * 
		 */
		apiUrl: string;
		/**
		 * The base URL for the GitHub API. When set to `/api/github` it sends data via proxy to the GitHub API to hide the token.
		 * 
		 * default: https://api.github.com
		 */
		baseApi: string;
	}
}
