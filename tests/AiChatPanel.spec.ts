import { afterEach, describe, expect, test, vi } from 'vitest'
import { flushPromises, shallowMount } from '@vue/test-utils'
import AiChatPanel from '../app/components/AiChatPanel.vue'

interface ChatState {
  inputText: string
  messages: { role: string; content: string }[]
  isLoading: boolean
  errorMessage: string
  tokenSetupNeeded: boolean
  sendMessage: () => Promise<void>
  clearConversation: () => void
}

afterEach(() => vi.unstubAllGlobals())

describe('AI conversation request lifecycle', () => {
  for (const fails of [false, true]) {
    test(`ignores a cleared request's late ${fails ? 'failure' : 'success'} while a new request is pending`, async () => {
      let resolveOld!: (value: { answer: string }) => void
      let rejectOld!: (reason: unknown) => void
      let resolveNew!: (value: { answer: string }) => void
      const oldResponse = new Promise<{ answer: string }>((resolve, reject) => {
        resolveOld = resolve
        rejectOld = reject
      })
      const newResponse = new Promise<{ answer: string }>(resolve => { resolveNew = resolve })
      const fetch = vi.fn().mockReturnValueOnce(oldResponse).mockReturnValueOnce(newResponse)
      vi.stubGlobal('$fetch', fetch)
      const wrapper = shallowMount(AiChatPanel)
      const state = wrapper.vm as unknown as ChatState
      try {
        state.inputText = 'Old synthetic question'
        const oldRequest = state.sendMessage()
        await flushPromises()
        expect(fetch).toHaveBeenCalledTimes(1)
        state.clearConversation()
        expect(state.isLoading).toBe(false)
        expect(state.messages).toEqual([])

        state.inputText = 'New synthetic question'
        const newRequest = state.sendMessage()
        await flushPromises()
        expect(fetch).toHaveBeenCalledTimes(2)
        if (fails) rejectOld({ statusMessage: 'missing_token' })
        else resolveOld({ answer: 'Discarded synthetic answer' })
        await oldRequest
        expect(state.messages).toEqual([{ role: 'user', content: 'New synthetic question' }])
        expect(state.isLoading).toBe(true)
        expect(state.errorMessage).toBe('')
        expect(state.tokenSetupNeeded).toBe(false)

        resolveNew({ answer: 'Fresh synthetic answer' })
        await newRequest
        expect(state.messages).toEqual([
          { role: 'user', content: 'New synthetic question' },
          { role: 'assistant', content: 'Fresh synthetic answer' },
        ])
        expect(state.isLoading).toBe(false)
      } finally {
        wrapper.unmount()
      }
    })
  }
})
