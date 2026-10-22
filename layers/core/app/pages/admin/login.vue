<script setup lang="ts">
import { adminLoginSchema } from '../../../shared/auth'
import { CoreRoutes } from '../../../shared/routes'

definePageMeta({ name: CoreRoutes.ADMIN_LOGIN, auth: 'public' })

const { values, pending, fieldErrors, formError, submit } = useCredentialsForm({
  endpoint: '/api/admin/login',
  schema: adminLoginSchema,
  initial: { login: '', password: '' },
  redirectTo: CoreRoutes.ADMIN,
})
</script>

<template>
  <AuthCard title="Вход для администратора">
    <AuthForm
      submit-label="Войти"
      :pending="pending"
      :error="formError"
      @submit="submit"
    >
      <FormField
        v-slot="field"
        label="Логин"
        :error="fieldErrors.login"
      >
        <FormInput
          :id="field.id"
          v-model="values.login"
          name="login"
          autocomplete="username"
          autocapitalize="off"
          spellcheck="false"
          :aria-describedby="field.describedBy"
          :aria-invalid="field.invalid"
        />
      </FormField>

      <FormField
        v-slot="field"
        label="Пароль"
        :error="fieldErrors.password"
      >
        <FormInput
          :id="field.id"
          v-model="values.password"
          name="password"
          type="password"
          autocomplete="current-password"
          :aria-describedby="field.describedBy"
          :aria-invalid="field.invalid"
        />
      </FormField>
    </AuthForm>
  </AuthCard>
</template>
