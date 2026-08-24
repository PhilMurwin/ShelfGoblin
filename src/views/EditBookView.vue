<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { Book, BookDraft } from '@/models/book'
import BookDetails from '@/components/BookDetails.vue'
import { createBookDraft } from '@/services/bookDraft.ts'
import { lookupBookByIsbn } from '@/services/googleBooks'
import {
  ensureShelfGoblinSpreadsheet,
  updateBookInShelf,
  deleteBookFromShelf,
  BOOKSHELF_SHEET_NAME,
} from '@/services/googleSheets'

const router = useRouter()

const spreadsheetId = ref<string | null>(null)
const spreadsheetError = ref<string | null>(null)

const originalBook = ref<Book | null>(null)
const bookDraft = ref<BookDraft | null>(null)

const refreshLoading = ref(false)
const refreshError = ref<string | null>(null)

type Suggestion = { field: keyof BookDraft; label: string; current: string; suggested: string }
const suggestions = ref<Suggestion[]>([])

const saving = ref(false)
const saveError = ref<string | null>(null)

const confirmingDelete = ref(false)
const deleting = ref(false)
const deleteError = ref<string | null>(null)

const REFRESH_FIELDS: { key: keyof BookDraft; label: string }[] = [
  { key: 'title', label: 'Title' },
  { key: 'authors', label: 'Authors' },
  { key: 'publisher', label: 'Publisher' },
  { key: 'published', label: 'Published' },
  { key: 'coverUrl', label: 'Cover URL' },
  { key: 'description', label: 'Description' },
]

onMounted(async () => {
  const stateBook = history.state?.book as Book | undefined
  if (!stateBook) {
    router.replace({ name: 'home' })
    return
  }

  originalBook.value = stateBook
  bookDraft.value = { ...stateBook }

  try {
    const result = await ensureShelfGoblinSpreadsheet()
    spreadsheetId.value = result.spreadsheetId
  } catch (error) {
    spreadsheetError.value =
      error instanceof Error ? error.message : 'Unable to initialize your bookshelf.'
  }
})

async function refreshFromGoogle() {
  if (!bookDraft.value?.isbn) return

  refreshLoading.value = true
  refreshError.value = null
  suggestions.value = []

  try {
    const metadata = await lookupBookByIsbn(bookDraft.value.isbn)
    if (!metadata) {
      refreshError.value = 'No book found for that ISBN.'
      return
    }

    const fresh = createBookDraft(metadata, bookDraft.value.isbn)

    suggestions.value = REFRESH_FIELDS.filter((f) => {
      const suggested = String(fresh[f.key] ?? '')
      const current = String(bookDraft.value![f.key] ?? '')
      return suggested && suggested !== current
    }).map((f) => ({
      field: f.key,
      label: f.label,
      current: String(bookDraft.value![f.key] ?? ''),
      suggested: String(fresh[f.key] ?? ''),
    }))

    if (suggestions.value.length === 0) {
      refreshError.value = 'No changes — your data already matches Google Books.'
    }
  } catch {
    refreshError.value = 'Unable to fetch book data from Google Books.'
  } finally {
    refreshLoading.value = false
  }
}

function applySuggestion(suggestion: Suggestion) {
  if (!bookDraft.value) return
  bookDraft.value = { ...bookDraft.value, [suggestion.field]: suggestion.suggested }
  suggestions.value = suggestions.value.filter((s) => s.field !== suggestion.field)
}

async function save() {
  if (!bookDraft.value || !originalBook.value || !spreadsheetId.value) return

  saving.value = true
  saveError.value = null

  try {
    await updateBookInShelf(
      spreadsheetId.value,
      BOOKSHELF_SHEET_NAME,
      originalBook.value,
      bookDraft.value,
    )
    router.back()
  } catch (error) {
    saveError.value = error instanceof Error ? error.message : 'Unable to save changes.'
    saving.value = false
  }
}

async function confirmDelete() {
  if (!originalBook.value || !spreadsheetId.value) return

  deleting.value = true
  deleteError.value = null

  try {
    await deleteBookFromShelf(spreadsheetId.value, BOOKSHELF_SHEET_NAME, originalBook.value)
    router.replace({ name: 'home' })
  } catch (error) {
    deleteError.value = error instanceof Error ? error.message : 'Unable to delete the book.'
    deleting.value = false
    confirmingDelete.value = false
  }
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between gap-4 mt-4">
      <h2>Edit Book</h2>
      <button
        type="button"
        class="text-sm px-4 py-2 rounded-lg border border-(--border) cursor-pointer hover:bg-black/5 dark:hover:bg-white/10"
        @click="router.back()"
      >
        Cancel
      </button>
    </div>

    <p v-if="spreadsheetError" class="mt-4 text-sm text-red-500">{{ spreadsheetError }}</p>

    <template v-if="bookDraft">
      <!-- Refresh from Google (only if book has an ISBN) -->
      <div v-if="bookDraft.isbn" class="mt-6">
        <button
          type="button"
          :disabled="refreshLoading"
          class="text-sm px-4 py-2 rounded-lg border border-(--border) cursor-pointer hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50"
          @click="refreshFromGoogle"
        >
          {{ refreshLoading ? 'Fetching…' : 'Refresh metadata from Google Books' }}
        </button>

        <p v-if="refreshError" class="mt-2 text-sm" style="color: var(--text)">
          {{ refreshError }}
        </p>

        <!-- Suggestions strip -->
        <div
          v-if="suggestions.length"
          class="mt-3 rounded-lg border border-(--border) divide-y divide-(--border) text-sm"
        >
          <div
            v-for="s in suggestions"
            :key="s.field"
            class="flex items-start gap-3 px-4 py-3"
          >
            <div class="flex-1 min-w-0">
              <span class="font-medium" style="color: var(--text-h)">{{ s.label }}</span>
              <div class="mt-0.5 truncate" style="color: var(--text)">
                <span v-if="s.current" class="line-through opacity-60">{{ s.current }}</span>
                <span v-else class="opacity-40 italic">empty</span>
                <span class="mx-1 opacity-40">→</span>
                <span>{{ s.suggested }}</span>
              </div>
            </div>
            <button
              type="button"
              class="shrink-0 px-3 py-1 rounded border border-(--border) cursor-pointer hover:bg-black/5 dark:hover:bg-white/10"
              @click="applySuggestion(s)"
            >
              Use
            </button>
          </div>
        </div>
      </div>

      <!-- Editable form -->
      <BookDetails v-model="bookDraft" />

      <!-- Actions -->
      <div class="mt-8 flex flex-wrap items-center gap-3">
        <button
          type="button"
          :disabled="saving || !spreadsheetId"
          class="px-6 py-2 rounded-lg font-medium bg-(--accent) text-white cursor-pointer hover:opacity-90 disabled:opacity-50"
          @click="save"
        >
          {{ saving ? 'Saving…' : 'Save' }}
        </button>

        <template v-if="!confirmingDelete">
          <button
            type="button"
            :disabled="saving || !spreadsheetId"
            class="px-6 py-2 rounded-lg font-medium border border-red-300 text-red-600 dark:border-red-800 dark:text-red-400 cursor-pointer hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50"
            @click="confirmingDelete = true"
          >
            Delete
          </button>
        </template>

        <template v-else>
          <span class="text-sm" style="color: var(--text)">Remove this book from your collection?</span>
          <button
            type="button"
            :disabled="deleting"
            class="px-5 py-2 rounded-lg font-medium bg-red-600 text-white cursor-pointer hover:opacity-90 disabled:opacity-50"
            @click="confirmDelete"
          >
            {{ deleting ? 'Deleting…' : 'Yes, delete' }}
          </button>
          <button
            type="button"
            :disabled="deleting"
            class="px-5 py-2 rounded-lg border border-(--border) cursor-pointer hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50"
            @click="confirmingDelete = false"
          >
            Cancel
          </button>
        </template>
      </div>

      <p v-if="saveError" class="mt-3 text-sm text-red-500">{{ saveError }}</p>
      <p v-if="deleteError" class="mt-3 text-sm text-red-500">{{ deleteError }}</p>
    </template>
  </div>
</template>
