<script setup lang="ts">
import { adminLoginSchema } from '../../../shared/auth'

definePageMeta({ auth: 'public' })

const { values, pending, fieldErrors, formError, submit } = useCredentialsForm({
  endpoint: '/api/admin/login',
  schema: adminLoginSchema,
  initial: { login: '', password: '' },
  redirectTo: '/admin',
})
</script>

<template>
  <AuthCard title="Вход для администратора">
    <form
      class="admin-login__form"
      novalidate
      @submit.prevent="submit"
    >
      <FormField
        label="Логин"
        :error="fieldErrors.login"
      >
        <input
          v-model="values.login"
          class="form-input"
          name="login"
          autocomplete="username"
          autocapitalize="off"
          spellcheck="false"
        >
      </FormField>

      <FormField
        label="Пароль"
        :error="fieldErrors.password"
      >
        <input
          v-model="values.password"
          class="form-input"
          name="password"
          type="password"
          autocomplete="current-password"
        >
      </FormField>

      <p
        class="admin-login__error"
        role="alert"
      >
        {{ formError }}
      </p>

      <button
        class="button button--primary"
        type="submit"
        :disabled="pending"
      >
        Войти
      </button>
    </form>
  </AuthCard>
</template>

<style scoped lang="scss">
.admin-login__form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.admin-login__error {
  min-height: 1.25em;
  margin: 0;
  color: var(--color-danger);
  font-size: var(--font-size-s);
}
</style>
