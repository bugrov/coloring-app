<script setup lang="ts">
import { CoreRoutes } from '../../../shared/routes'

definePageMeta({ name: CoreRoutes.ADMIN, auth: 'admin' })

const { user } = useUserSession()
const signOut = useSignOut(CoreRoutes.ADMIN_LOGIN)
</script>

<template>
  <SafeAreaPage>
    <h1 class="admin__title">
      Администратор
    </h1>
    <p class="admin__note">
      {{ user?.username }}: управление артами, пользователями и статистикой появится на шаге 8.
    </p>
    <button
      class="button button--ghost admin__sign-out"
      type="button"
      @click="signOut"
    >
      Выйти
    </button>
  </SafeAreaPage>
</template>

<style scoped lang="scss">
.admin__title {
  margin: 0;
  font-size: var(--font-size-l);
}

.admin__note {
  margin: 0;
  color: var(--color-text-muted);
}

.admin__sign-out {
  align-self: flex-start;
}
</style>
