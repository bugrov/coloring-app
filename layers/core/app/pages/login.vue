<script setup lang="ts">
import { USERNAME_MAX_LENGTH, loginSchema } from '../../shared/auth'
import type { CountryOption } from '../utils/countries'

definePageMeta({ auth: 'public' })

// Names and their order come from the browser's own locale data, which differs from the
// server's: the list is built after mounting, so server and client markup match.
const countries = ref<CountryOption[]>([])
onMounted(() => {
  countries.value = countryOptions()
})

const { values, pending, fieldErrors, formError, submit } = useCredentialsForm({
  endpoint: '/api/auth/login',
  schema: loginSchema,
  initial: { username: '', country: '' },
  redirectTo: '/',
})
</script>

<template>
  <AuthCard title="Войти в игру">
    <AuthForm
      submit-label="Играть"
      :pending="pending"
      :error="formError"
      @submit="submit"
    >
      <FormField
        v-slot="field"
        label="Имя"
        :error="fieldErrors.username"
      >
        <input
          :id="field.id"
          v-model="values.username"
          class="form-input"
          name="username"
          autocomplete="username"
          autocapitalize="off"
          spellcheck="false"
          :maxlength="USERNAME_MAX_LENGTH"
          :aria-describedby="field.describedBy"
          :aria-invalid="field.invalid"
        >
      </FormField>

      <FormField
        v-slot="field"
        label="Страна"
        :error="fieldErrors.country"
      >
        <select
          :id="field.id"
          v-model="values.country"
          class="form-input"
          name="country"
          :aria-describedby="field.describedBy"
          :aria-invalid="field.invalid"
        >
          <option
            value=""
            disabled
          >
            Выберите страну
          </option>
          <option
            v-for="country in countries"
            :key="country.code"
            :value="country.code"
          >
            {{ country.name }}
          </option>
        </select>
      </FormField>
    </AuthForm>

    <p class="login__notice">
      Мы сохраняем имя, страну и ваши рисунки, чтобы вы могли продолжить позже,
      а также анонимную статистику о том, какие рисунки открывают чаще.
    </p>
  </AuthCard>
</template>

<style scoped lang="scss">
.login__notice {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-s);
}
</style>
