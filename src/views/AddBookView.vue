<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { BookDraft } from '@/models/book'
import BookDetails from '@/components/BookDetails.vue'
import { canonicalizeIsbn, createBookDraft } from '@/services/bookDraft.ts'
import { lookupBookByIsbn } from '@/services/googleBooks'
import {
  ensureShelfGoblinSpreadsheet,
  addBookToShelf
} from '@/services/googleSheets'

const spreadsheetId = ref<string | null>(null)
const spreadsheetError = ref<string | null>(null)

const isbn = ref('')
const bookDraft = ref<BookDraft | null>(null)
const lookupLoading = ref(false)
const lookupError = ref<string | null>(null)

const saving = ref(false)
const saveError = ref<string | null>(null)
const saveMessage = ref<string | null>(null)

onMounted(async () => {
  try {
    const result = await ensureShelfGoblinSpreadsheet()
    spreadsheetId.value = result.spreadsheetId
  } catch (error) {
    spreadsheetError.value = error instanceof Error ? error.message : 'Unable to initialize your bookshelf.'
  }
})

async function lookupBook() {
  // canonicalize ISBN
  const cleanIsbn = canonicalizeIsbn(isbn.value)
  if (!cleanIsbn) {
    return
  }

  lookupLoading.value = true
  lookupError.value = null
  saveError.value = null
  saveMessage.value = null
  bookDraft.value = null

  try {
    // call Google Books
    const metadata = await lookupBookByIsbn(cleanIsbn)

    if (!metadata) {
      lookupError.value = 'No book found for that ISBN.'
      return
    }
    // create BookDraft & put it in bookDraft
    bookDraft.value = createBookDraft(metadata, cleanIsbn)
  } catch (err) {
    console.error(err)
    lookupError.value = 'Unable to look up the book.'
  } finally {
    lookupLoading.value = false
  }
}

async function addBook() {
  if (!bookDraft.value || !spreadsheetId.value) {
    return
  }

  saving.value = true
  saveError.value = null
  saveMessage.value = null

  try {
    const result = await addBookToShelf(spreadsheetId.value, 'BookShelf', bookDraft.value)

    if (result.added)
    {
      saveMessage.value = `${bookDraft.value.title} has been added to your collection`
      bookDraft.value = null
    }
    else {
      saveError.value = 'This book is already in your collection'
    }
  } catch (error) {
    saveError.value = error instanceof Error ? error.message : 'Unable to add the book to your collection.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
    <div>Add Book</div>
    <form class="flex gap-3 mt-8" @submit.prevent="lookupBook">
      <input
        v-model="isbn"
        placeholder="Enter ISBN"
        class="flex-1 px-4 py-3 rounded-lg border border-(--border) bg-(--bg) text-(--text-h) placeholder:text-(--text) focus:outline-none focus:ring-2 focus:ring-(--accent) focus:border-transparent transition-shadow"
      />

      <button
        :disabled="lookupLoading"
        type="submit"
        class="px-6 py-3 rounded-lg font-medium bg-(--accent) text-white cursor-pointer hover:opacity-90 active:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
      >
        {{ lookupLoading ? 'Looking up...' : 'Look Up' }}
      </button>
    </form>

    <p v-if="lookupError" class="mt-4 text-sm text-red-500">
      {{ lookupError }}
    </p>

    <BookDetails v-if="bookDraft" v-model="bookDraft" />

    <div v-if="bookDraft" class="mt-8">
      <div class="flex justify-center">
        <button 
          type="button"
          :disabled="saving || !spreadsheetId"
          class="px-6 py-3 rounded-lg font-medium bg-(--accent) text-white cursor-pointer hover:opacity-90 active:opacity-80 disabled:opacity-50"
          @click="addBook"
          > 
          {{ saving ? 'Adding...' : 'Add to BookShelf'}}
        </button>
      </div>

      <p v-if="saveError" class="mt-4 text-sm text-red-500 text-center">
        {{ saveError }}
      </p>
    </div>
    <p v-if="saveMessage" class="mt-4 text-sm text-center">
      {{ saveMessage }}
    </p>
</template>