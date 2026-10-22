import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ConfirmDialog from '~~/layers/core/app/components/(ui)/ConfirmDialog.vue'

const props = { title: 'Удалить?', text: 'Насовсем.', confirmLabel: 'Удалить' }

describe('confirm dialog', () => {
  it('is shown when it is mounted already open (a parent adds it with v-if)', async () => {
    const wrapper = await mountSuspended(ConfirmDialog, { props: { ...props, open: true }, attachTo: document.body })

    expect(wrapper.find('dialog').element.open).toBe(true)
    wrapper.unmount()
  })

  it('follows `open` afterwards, in both directions', async () => {
    const wrapper = await mountSuspended(ConfirmDialog, { props: { ...props, open: false }, attachTo: document.body })

    expect(wrapper.find('dialog').element.open).toBe(false)
    await wrapper.setProps({ open: true })
    expect(wrapper.find('dialog').element.open).toBe(true)
    await wrapper.setProps({ open: false })
    expect(wrapper.find('dialog').element.open).toBe(false)
    wrapper.unmount()
  })
})
