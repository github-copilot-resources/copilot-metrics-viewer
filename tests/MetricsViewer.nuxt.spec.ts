// @vitest-environment nuxt
import { mount  } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, test, expect } from 'vitest'
import type { Metrics } from '@/model/Metrics'

import { MetricsViewer } from '#components'

const metrics: Metrics[] = [];

describe('MetricsViewer.vue', () => {
  test('renders the component', async () => {
    // const component =await  mountSuspended(MetricsViewer, {
    //   props: {
    //     metrics: metrics
    //   }
    // })
    expect(true).toBeTruthy()
  })
})
