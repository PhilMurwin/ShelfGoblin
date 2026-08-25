<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import type { BookDraft } from '@/models/book'
import BookDetails from '@/components/BookDetails.vue'
import BarcodeScanner from '@/components/BarcodeScanner.vue'
import { canonicalizeIsbn, createBookDraft } from '@/services/bookDraft.ts'
import { lookupBookByIsbn } from '@/services/googleBooks'
import {
  ensureShelfGoblinSpreadsheet,
  addBookToShelf
} from '@/services/googleSheets'
import { ArrowLeftIcon, CameraIcon } from '@heroicons/vue/24/outline'

const spreadsheetId = ref<string | null>(null)
const spreadsheetError = ref<string | null>(null)

const isbn = ref('')
const showScanner = ref(false)
const bookDraft = ref<BookDraft | null>(null)
const lookupLoading = ref(false)
const lookupError = ref<string | null>(null)

const saving = ref(false)
const saveError = ref<string | null>(null)
const saveMessage = ref<string | null>(null)

let restartTimer: ReturnType<typeof setTimeout> | null = null

function clearRestartTimer() {
  if (restartTimer !== null) {
    clearTimeout(restartTimer)
    restartTimer = null
  }
}

onUnmounted(clearRestartTimer)

onMounted(async () => {
  try {
    const result = await ensureShelfGoblinSpreadsheet()
    spreadsheetId.value = result.spreadsheetId
  } catch (error) {
    spreadsheetError.value = error instanceof Error ? error.message : 'Unable to initialize your bookshelf.'
  }
})

function toggleScanner() {
  clearRestartTimer()
  if (!showScanner.value) bookDraft.value = null
  showScanner.value = !showScanner.value
}

async function onBarcodeDetected(barcode: string) {
  showScanner.value = false
  isbn.value = barcode
  await lookupBook()
}

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

    if (result.added) {
      const title = bookDraft.value.title
      bookDraft.value = null
      isbn.value = ''
      saveMessage.value = `${title} added to your collection`
      restartTimer = setTimeout(() => {
        saveMessage.value = null
        showScanner.value = true
      }, 1800)
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
    <RouterLink
      :to="{ name: 'home' }"
      class="mt-6 inline-flex items-center gap-1.5 text-sm text-(--text) opacity-60 hover:opacity-100 transition-opacity"
    >
      <ArrowLeftIcon class="w-4 h-4" />
      My Collection
    </RouterLink>
    <h2 class="mt-3">Add a Book</h2>
    <p class="mt-1 text-sm text-(--text) opacity-70">Scan a barcode or enter an ISBN to find a book.</p>
    <form class="flex gap-3 mt-8" @submit.prevent="lookupBook">
      <div class="relative flex-1">
        <input
          v-model="isbn"
          placeholder="Enter ISBN"
          class="w-full pl-4 pr-11 py-3 rounded-lg border border-(--border) bg-(--bg) text-(--text-h) placeholder:text-(--text) focus:outline-none focus:ring-2 focus:ring-(--accent) focus:border-transparent transition-shadow"
        />
        <button
          type="button"
          :class="showScanner ? 'text-(--accent)' : 'text-(--text) opacity-40 hover:opacity-80'"
          class="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer transition-opacity"
          :title="showScanner ? 'Close scanner' : 'Scan barcode'"
          @click="toggleScanner"
        >
          <CameraIcon class="w-5 h-5" />
        </button>
      </div>

      <button
        :disabled="lookupLoading"
        type="submit"
        class="px-6 py-3 rounded-lg font-medium bg-(--accent) text-white cursor-pointer hover:opacity-90 active:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
      >
        {{ lookupLoading ? 'Looking up...' : 'Look Up' }}
      </button>
    </form>

    <BarcodeScanner
      v-if="showScanner"
      @detected="onBarcodeDetected"
      @close="showScanner = false"
    />

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