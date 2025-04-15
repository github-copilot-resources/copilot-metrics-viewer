import type { RouterConfig } from '@nuxt/schema'

export default {
    // https://router.vuejs.org/api/interfaces/routeroptions.html#routes
    routes: (_routes) => [
        {
            name: 'home',
            path: '/',
            component: () => import('~/pages/index.vue')
        },
        {
            name: 'org',
            path: '/orgs/:org',
            component: () => import('~/pages/index.vue'),
            // Add alternative path for organization
            alias: '/organization/:org'
        },
        {
            name: 'team',
            path: '/orgs/:org/teams/:team',
            component: () => import('~/pages/index.vue')
        },
        {
            name: 'ent',
            path: '/enterprises/:ent',
            component: () => import('~/pages/index.vue'),
            // Add alternative path for enterprise
            alias: '/enterprise/:ent'
        }
    ],
} satisfies RouterConfig