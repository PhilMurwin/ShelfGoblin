<script setup lang="ts">
import { onMounted, ref } from 'vue'
import shelfGoblinBadge from '@/assets/ShelfGoblinBadge.png'
import { authState, renderGoogleSignInButton, signOut } from '@/services/googleAuth'

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
</script>

<template>
  <main class="w-full max-w-xl mx-auto px-6 py-16 text-left">
    <div class="flex items-center gap-3 justify-center">
      <img :src="shelfGoblinBadge" alt="Shelf Goblin" class="h-12 w-auto" />
      <h1>Shelf Goblin</h1>
    </div>

    <section v-if="!authState.user" class="mt-12 text-center">
      <p class="text-lg">Track your books and reading progress.</p>
      <div ref="googleButton" class="mt-8 flex justify-center" />
      <p v-if="setupError || authState.error" class="mt-4 text-sm text-red-500">
        {{ setupError ?? authState.error }}
      </p>
    </section>

    <section v-else class="mt-12 rounded-xl border border-(--border) p-6 text-center">
      <img
        v-if="authState.user.picture"
        :src="authState.user.picture"
        :alt="`${authState.user.name} profile picture`"
        class="mx-auto h-16 w-16 rounded-full"
      />
      <h2 class="mt-4">Signed in as {{ authState.user.name }}</h2>
      <p>{{ authState.user.email }}</p>
      <p v-if="authState.loading" class="mt-3 text-sm">Signing in…</p>
      <p v-else-if="authState.accessToken" class="mt-3 text-sm">Google Sheets access is authorized.</p>
      <p v-else class="mt-3 text-sm">Ready to request Google Sheets access when it is needed.</p>
      <p v-if="authState.error" class="mt-3 text-sm text-red-500">{{ authState.error }}</p>
      <button
        type="button"
        class="mt-6 px-5 py-2 rounded-lg font-medium border border-(--border) cursor-pointer hover:bg-black/5 dark:hover:bg-white/10"
        @click="signOut"
      >
        Sign out
      </button>
    </section>

    <footer class="mt-12 text-center text-sm">
      <a href="/support.html" class="underline hover:opacity-80">Support</a>
      <span class="mx-2">·</span>
      <a href="/privacy.html" class="underline hover:opacity-80">Privacy policy</a>
    </footer>
  </main>
</template>
