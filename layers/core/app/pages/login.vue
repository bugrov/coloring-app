<script setup lang="ts">
import { loginSchema } from '../../shared/auth'

definePageMeta({ auth: 'public' })

// Names and their order come from the browser's own locale data, which differs from the
// server's: the list is built after mounting, so server and client markup match.
const countries = ref<CountryOption[]>([])
onMounted(() => {
  countries.value = useCountries()
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
    <form
      class="login__form"
      novalidate
      @submit.prevent="submit"
    >
      <FormField
        label="Имя"
        :error="fieldErrors.username"
      >
        <input
          v-model="values.username"
          class="form-input"
          name="username"
          autocomplete="username"
          autocapitalize="off"
          spellcheck="false"
          maxlength="20"
        >
      </FormField>

      <FormField
        label="Страна"
        :error="fieldErrors.country"
      >
        <select
          v-model="values.country"
          class="form-input"
          name="country"
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

      <p
        class="login__error"
        role="alert"
      >
        {{ formError }}
      </p>

      <button
        class="button button--primary"
        type="submit"
        :disabled="pending"
      >
        Играть
      </button>
    </form>

    <p class="login__notice">
      Мы сохраняем имя, страну и ваши рисунки, чтобы вы могли продолжить позже,
      а также анонимную статистику о том, какие рисунки открывают чаще.
    </p>
  </AuthCard>
</template>

<style scoped lang="scss">
.login__form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.login__error {
  min-height: 1.25em;
  margin: 0;
  color: var(--color-danger);
  font-size: var(--font-size-s);
}

.login__notice {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-s);
}
</style>
