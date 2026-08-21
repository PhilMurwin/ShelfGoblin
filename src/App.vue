<script setup lang="ts">
import { ref } from 'vue'
import shelfGoblinBadge from '@/assets/ShelfGoblinBadge.png'
import BookDetails from '@/components/BookDetails.vue'
import type { BookDraft } from '@/models/book'
import { canonicalizeIsbn, createBookDraft } from '@/services/bookDraft'
import { lookupBookByIsbn } from '@/services/googleBooks'

const isbn = ref('')
const bookDraft = ref<BookDraft | null>(null)
const loading = ref(false)
const error = ref('')

async function lookupBook() {
  const cleanIsbn = canonicalizeIsbn(isbn.value)

  if (!cleanIsbn) {
    return
  }

  loading.value = true
  error.value = ''
  bookDraft.value = null

  try {
    const metadata = await lookupBookByIsbn(cleanIsbn)

    if (!metadata) {
      error.value = 'No book found for that ISBN.'
      return
    }

    bookDraft.value = createBookDraft(metadata, cleanIsbn)
  } catch (err) {
    console.error(err)
    error.value = 'Unable to look up the book.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="w-full max-w-xl mx-auto px-6 py-16">
    <div class="flex items-center gap-3">
      <img :src="shelfGoblinBadge" alt="Shelf Goblin" class="h-12 w-auto" />
      <h1>Shelf Goblin</h1>
    </div>

    <form class="flex gap-3 mt-8" @submit.prevent="lookupBook">
      <input
        v-model="isbn"
        placeholder="Enter ISBN"
        class="flex-1 px-4 py-3 rounded-lg border border-(--border) bg-(--bg) text-(--text-h) placeholder:text-(--text) focus:outline-none focus:ring-2 focus:ring-(--accent) focus:border-transparent transition-shadow"
      />

      <button
        :disabled="loading"
        type="submit"
        class="px-6 py-3 rounded-lg font-medium bg-(--accent) text-white cursor-pointer hover:opacity-90 active:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
      >
        {{ loading ? 'Looking up...' : 'Look Up' }}
      </button>
    </form>

    <p v-if="error" class="mt-4 text-sm text-red-500">
      {{ error }}
    </p>

    <BookDetails v-if="bookDraft" v-model="bookDraft" />
  </main>
</template>
