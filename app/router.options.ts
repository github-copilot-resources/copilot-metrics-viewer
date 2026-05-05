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
            component: () => import('~/pages/index.vue')
        },
        {
            name: 'org-team',
            path: '/orgs/:org/teams/:team',
            component: () => import('~/pages/index.vue')
        },
        {
            name: 'ent',
            path: '/enterprises/:ent',
            component: () => import('~/pages/index.vue')
        },
        {
            name: 'ent-team',
            path: '/enterprises/:ent/teams/:team',
            component: () => import('~/pages/index.vue')
        },
        {
            name: 'org-reportsto',
            path: '/orgs/:org/reportsto/:upn',
            component: () => import('~/pages/index.vue')
        },
        {
            name: 'ent-reportsto',
            path: '/enterprises/:ent/reportsto/:upn',
            component: () => import('~/pages/index.vue')
        },
        {
            name: 'select-org',
            path: '/select-org',
            component: () => import('~/pages/select-org.vue')
        },
        {
            name: 'install',
            path: '/install',
            component: () => import('~/pages/install/index.vue')
        }
    ],
} satisfies RouterConfig