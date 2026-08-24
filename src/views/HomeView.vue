<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { authState } from '@/services/googleAuth'
import type { Book } from '@/models/book'
import {
  SpreadsheetNotFoundError,
  getBooksFromShelf,
  setBookRead,
  ensureShelfGoblinSpreadsheet,
  recreateShelfGoblinSpreadsheet,
  BOOKSHELF_SHEET_NAME,
} from '@/services/googleSheets'
import BookList from '@/components/BookList.vue'
import BookCard from '@/components/BookCard.vue'

const router = useRouter()
const spreadsheetId = ref<string | null>(null)
const spreadsheetError = ref<string | null>(null)
const spreadsheetLoading = ref(false)
const missingSpreadsheetMetaFileId = ref<string | null>(null)
const recreating = ref(false)

const books = ref<Book[]>([])
const booksLoading = ref(false)
const booksError = ref<string | null>(null)

const searchQuery = ref('')
const viewMode = ref<'list' | 'card'>('list')

const filteredBooks = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return books.value
  return books.value.filter(
    (b) =>
      b.title.toLowerCase().includes(q) ||
      b.authors.toLowerCase().includes(q) ||
      b.series.toLowerCase().includes(q) ||
      (b.isbn ?? '').toLowerCase().includes(q),
  )
})

async function loadBooks(id: string) {
  booksLoading.value = true
  booksError.value = null
  try {
    books.value = await getBooksFromShelf(id, BOOKSHELF_SHEET_NAME)
  } catch (error) {
    booksError.value = error instanceof Error ? error.message : 'Unable to load your collection.'
  } finally {
    booksLoading.value = false
  }
}

watch(
  () => authState.user,
  async (user) => {
    if (!user) {
      spreadsheetId.value = null
      spreadsheetError.value = null
      missingSpreadsheetMetaFileId.value = null
      books.value = []
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
      spreadsheetLoading.value = false
      return
    }

    spreadsheetLoading.value = false
    await loadBooks(spreadsheetId.value)
  },
  { immediate: true },
)

function handleEdit(book: Book) {
  router.push({ name: 'edit-book', state: { book: JSON.parse(JSON.stringify(book)) } })
}

async function toggleRead(book: Book) {
  if (!spreadsheetId.value) return

  const prev = book.read
  book.read = !prev

  try {
    await setBookRead(spreadsheetId.value, BOOKSHELF_SHEET_NAME, book, book.read)
  } catch {
    book.read = prev
  }
}

async function handleRecreate() {
  if (!missingSpreadsheetMetaFileId.value) return

  recreating.value = true
  spreadsheetError.value = null

  try {
    const result = await recreateShelfGoblinSpreadsheet(missingSpreadsheetMetaFileId.value)
    spreadsheetId.value = result.spreadsheetId
    missingSpreadsheetMetaFileId.value = null
    await loadBooks(result.spreadsheetId)
  } catch (error) {
    spreadsheetError.value =
      error instanceof Error ? error.message : 'Unable to create a new bookshelf.'
  } finally {
    recreating.value = false
  }
}
</script>

<template>
  <section v-if="authState.user" class="mt-4">
    <h2>Your Book Shelf</h2>

    <!-- Spreadsheet initializing -->
    <p v-if="spreadsheetLoading" class="mt-3 text-sm" style="color: var(--text)">
      Setting up your bookshelf…
    </p>

    <!-- Spreadsheet missing / deleted -->
    <div
      v-else-if="missingSpreadsheetMetaFileId"
      class="mt-6 rounded-xl border border-(--border) p-6 text-center"
    >
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

    <!-- Spreadsheet API error -->
    <p v-else-if="spreadsheetError" class="mt-3 text-sm text-red-500">{{ spreadsheetError }}</p>

    <!-- Spreadsheet ready -->
    <template v-else-if="spreadsheetId">
      <!-- Collection loading -->
      <p v-if="booksLoading" class="mt-3 text-sm" style="color: var(--text)">
        Loading your collection…
      </p>

      <!-- Collection API error -->
      <p v-else-if="booksError" class="mt-3 text-sm text-red-500">{{ booksError }}</p>

      <!-- Empty collection -->
      <div v-else-if="books.length === 0" class="mt-6 text-center">
        <p class="text-sm" style="color: var(--text)">
          You don't have any books in your collection yet.
        </p>
        <RouterLink
          :to="{ name: 'add-book' }"
          class="mt-4 inline-block px-5 py-2 rounded-lg font-medium border border-(--border) cursor-pointer hover:bg-black/5 dark:hover:bg-white/10"
        >
          Add a Book
        </RouterLink>
      </div>

      <!-- Collection browser -->
      <template v-else>
        <p class="mt-2 text-sm" style="color: var(--text)">
          {{ books.length }} {{ books.length === 1 ? 'book' : 'books' }} in your collection.
        </p>

        <!-- Toolbar -->
        <div class="mt-4 flex flex-wrap items-center gap-3">
          <input
            v-model="searchQuery"
            type="search"
            placeholder="Search your collection…"
            class="flex-1 min-w-48 px-3 py-2 rounded-lg border border-(--border) text-sm focus:outline-none"
            style="background: var(--bg)"
          />
          <div
            class="flex rounded-lg border border-(--border) overflow-hidden text-sm font-medium"
          >
            <button
              type="button"
              class="px-4 py-2 cursor-pointer"
              :style="viewMode === 'list' ? 'background: var(--accent); color: white;' : ''"
              :class="viewMode !== 'list' ? 'hover:bg-black/5 dark:hover:bg-white/10' : ''"
              @click="viewMode = 'list'"
            >
              List
            </button>
            <button
              type="button"
              class="px-4 py-2 cursor-pointer border-l border-(--border)"
              :style="viewMode === 'card' ? 'background: var(--accent); color: white;' : ''"
              :class="viewMode !== 'card' ? 'hover:bg-black/5 dark:hover:bg-white/10' : ''"
              @click="viewMode = 'card'"
            >
              Cards
            </button>
          </div>
          <RouterLink
            :to="{ name: 'add-book' }"
            class="px-5 py-2 rounded-lg font-medium text-sm border border-(--border) hover:bg-black/5 dark:hover:bg-white/10 whitespace-nowrap"
          >
            Add a Book
          </RouterLink>
        </div>

        <hr class="mt-4" style="border-color: var(--border)" />

        <!-- No search results -->
        <p
          v-if="filteredBooks.length === 0"
          class="mt-6 text-sm text-center"
          style="color: var(--text)"
        >
          No books match "{{ searchQuery }}".
        </p>

        <!-- List view -->
        <BookList v-else-if="viewMode === 'list'" :books="filteredBooks" class="mt-4" @toggle-read="toggleRead" @edit="handleEdit" />

        <!-- Card view -->
        <BookCard v-else :books="filteredBooks" class="mt-4" @toggle-read="toggleRead" @edit="handleEdit" />
      </template>
    </template>

    <p v-if="authState.error" class="mt-3 text-sm text-red-500">{{ authState.error }}</p>
  </section>
</template>
