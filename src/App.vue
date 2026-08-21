<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import shelfGoblinBadge from '@/assets/ShelfGoblinBadge.png'
import { authState, renderGoogleSignInButton, signOut } from '@/services/googleAuth'
import {
  SpreadsheetNotFoundError,
  ensureShelfGoblinSpreadsheet,
  recreateShelfGoblinSpreadsheet,
} from '@/services/googleSheets'

const googleButton = ref<HTMLElement | null>(null)
const setupError = ref<string | null>(null)
const spreadsheetId = ref<string | null>(null)
const spreadsheetError = ref<string | null>(null)
const spreadsheetLoading = ref(false)
const missingSpreadsheetMetaFileId = ref<string | null>(null)
const recreating = ref(false)

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
  async (user) => {
    if (!user) {
      spreadsheetId.value = null
      spreadsheetError.value = null
      missingSpreadsheetMetaFileId.value = null
      return
    }

    spreadsheetLoading.value = true
    spreadsheetError.value = null
    missingSpreadsheetMetaFileId.value = null

    try {
      const result = await ensureShelfGoblinSpreadsheet()
      spreadsheetId.value = result.spreadsheetId
    } catch (error) {
      if (error instanceof SpreadsheetNotFoundError) {
        missingSpreadsheetMetaFileId.value = error.metadataFileId
      } else {
        spreadsheetError.value =
          error instanceof Error ? error.message : 'Unable to initialize your bookshelf.'
      }
    } finally {
      spreadsheetLoading.value = false
    }
  },
)

async function handleRecreate() {
  if (!missingSpreadsheetMetaFileId.value) {
    return
  }

  recreating.value = true
  spreadsheetError.value = null

  try {
    const result = await recreateShelfGoblinSpreadsheet(missingSpreadsheetMetaFileId.value)
    spreadsheetId.value = result.spreadsheetId
    missingSpreadsheetMetaFileId.value = null
  } catch (error) {
    spreadsheetError.value =
      error instanceof Error ? error.message : 'Unable to create a new bookshelf.'
  } finally {
    recreating.value = false
  }
}
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

      <p v-if="spreadsheetLoading" class="mt-3 text-sm">Setting up your bookshelf…</p>
      <p v-else-if="spreadsheetId" class="mt-3 text-sm">Your bookshelf is ready.</p>
      <div v-else-if="missingSpreadsheetMetaFileId" class="mt-4">
        <p class="text-sm">
          Your bookshelf spreadsheet could not be found. It may have been deleted from Google Drive.
        </p>
        <button
          type="button"
          class="mt-3 px-5 py-2 rounded-lg font-medium border border-(--border) cursor-pointer hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50"
          :disabled="recreating"
          @click="handleRecreate"
        >
          {{ recreating ? 'Creating…' : 'Create new bookshelf' }}
        </button>
      </div>
      <p v-else-if="spreadsheetError" class="mt-3 text-sm text-red-500">{{ spreadsheetError }}</p>

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
