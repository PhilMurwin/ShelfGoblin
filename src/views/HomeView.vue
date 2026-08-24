<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { authState, signOut } from '@/services/googleAuth'

import {
  SpreadsheetNotFoundError,
  countBooksInShelf,
  ensureShelfGoblinSpreadsheet,
  recreateShelfGoblinSpreadsheet,
} from '@/services/googleSheets'

const spreadsheetId = ref<string | null>(null)
const spreadsheetError = ref<string | null>(null)
const spreadsheetLoading = ref(false)
const missingSpreadsheetMetaFileId = ref<string | null>(null)
const recreating = ref(false)

const user = computed(() => authState.user)
const bookCount = ref<number | null>(null)

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

      bookCount.value = await countBooksInShelf(spreadsheetId.value, 'BookShelf')
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
  { immediate: true },
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
    <section v-if="user" class="mt-12 rounded-xl border border-(--border) p-6 text-center">
      <img
        v-if="user.picture"
        :src="user.picture"
        :alt="`${user.name} profile picture`"
        class="mx-auto h-16 w-16 rounded-full"
      />
      <h2 class="mt-4">Signed in as {{ user.name }}</h2>
      <p>{{ user.email }}</p>

      <p v-if="spreadsheetLoading" class="mt-3 text-sm">Setting up your bookshelf…</p>
      <div v-else-if="spreadsheetId" class="mt-4">
        <p class="mt-3 text-sm">
          You have {{ bookCount }} {{  bookCount === 1 ? 'book' : 'books' }} in your collection.
        </p>

        <RouterLink
          :to="{ name: 'add-book' }"
          class="mt-4 inline-block px-5 py-2 rounded-lg font-medium border border-(--border) cursor-pointer hover:bg-black/5 dark:hover:bg-white/10"
          >
          Add a Book
        </RouterLink>
      </div>
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
</template>