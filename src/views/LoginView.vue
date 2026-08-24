<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { authState, renderGoogleSignInButton } from '@/services/googleAuth'

const router = useRouter()

const googleButton = ref<HTMLElement | null>(null)
const setupError = ref<string | null>(null)

onMounted(async () => {
  if (!googleButton.value) {
    return
  }

  try {
    await renderGoogleSignInButton(googleButton.value)
  } catch (error) {
    setupError.value = error instanceof Error ? error.message : 'Unable to set up Google sign-in.'
  }
})

watch(
    () => authState.user,
    (user) => {
        if (user) {
            void router.replace({name: 'home'})
        }
    },
    { immediate: true },
)
</script>

<template>
    <section v-if="!authState.user" class="mt-12 text-center">
      <p class="text-lg">Track your books and reading progress.</p>
      <div ref="googleButton" class="mt-8 flex justify-center" />
      <p v-if="setupError || authState.error" class="mt-4 text-sm text-red-500">
        {{ setupError ?? authState.error }}
      </p>
    </section>
</template>