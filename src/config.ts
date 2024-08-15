const PROPS = ["MOCKED_DATA", "SCOPE", "GITHUB_ORG", "GITHUB_ENT", "GITHUB_TEAM", "GITHUB_TOKEN"];

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

let scopeName: string;
if (scopeType === 'organization') {
	scopeName = githubOrgName;
	apiUrl = `https://api.github.com/orgs/${githubOrgName}`;
}
else if (scopeType === 'enterprise') {
	scopeName = githubEntName;
	apiUrl = `https://api.github.com/enterprises/${githubEntName}`;
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
		apiUrl
	}
}
if (!config.mockedData && !config.github.token) {
	throw new Error("VUE_APP_GITHUB_TOKEN environment variable must be set.");
}

export default config;

interface Config {
	mockedData: boolean;
	scope: {
		type: 'organization' | 'enterprise';
		name: string;
	};
	github: {
		org: string;
		ent: string;
		team: string;
		token: string;
		apiUrl: string;
	}
}
