<script setup lang="ts">
import { ref } from 'vue'
import shelfGoblinBadge from '@/assets/ShelfGoblinBadge.png'

interface BookInfo {
  title: string
  subtitle?: string
  authors?: string[]
  publisher?: string
  publishedDate?: string
  description?: string
  pageCount?: number
  categories?: string[]
  imageLinks?: {
    smallThumbnail?: string
    thumbnail?: string
  }
  industryIdentifiers?: {
    type: string
    identifier: string
  }[]
}

const isbn = ref('')
const book = ref<BookInfo | null>(null)
const loading = ref(false)
const error = ref('')

async function lookupBook() {
  if (!isbn.value.trim()) {
    return
  }

  loading.value = true
  error.value = ''
  book.value = null

  try {
    const cleanIsbn = isbn.value.replace(/[-\s]/g, '')

    const response = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}&key=${import.meta.env.VITE_GOOGLE_BOOKS_API_KEY}`
    )

    if (!response.ok) {
      throw new Error('Google Books request failed')
    }

    const data = await response.json()

    //console.log(data)
    //console.log(JSON.stringify(data.items?.[0]?.volumeInfo, null, 2))

    if (!data.items?.length) {
      error.value = 'No book found for that ISBN.'
      return
    }

    book.value = data.items[0].volumeInfo
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

    <div class="flex gap-3 mt-8">
      <input
        v-model="isbn"
        placeholder="Enter ISBN"
        @keyup.enter="lookupBook"
        class="flex-1 px-4 py-3 rounded-lg border border-(--border) bg-(--bg) text-(--text-h) placeholder:text-(--text) focus:outline-none focus:ring-2 focus:ring-(--accent) focus:border-transparent transition-shadow"
      />

      <button
        @click="lookupBook"
        :disabled="loading"
        class="px-6 py-3 rounded-lg font-medium bg-(--accent) text-white cursor-pointer hover:opacity-90 active:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
      >
        {{ loading ? 'Looking up...' : 'Look Up' }}
      </button>
    </div>

    <p v-if="error" class="mt-4 text-sm text-red-500">
      {{ error }}
    </p>

    <section v-if="book" class="mt-10 text-left">
      <img
        v-if="book.imageLinks?.thumbnail"
        :src="book.imageLinks.thumbnail"
        :alt="book.title"
        class="rounded-md mb-6 shadow-md"
      />

      <h2>{{ book.title }}</h2>

      <p v-if="book.subtitle" class="mt-1 italic text-(--text)">
        {{ book.subtitle }}
      </p>

      <div class="mt-5 space-y-2 text-sm">
        <p v-if="book.authors">
          <strong>Author:</strong>
          {{ book.authors.join(', ') }}
        </p>

        <p v-if="book.publisher">
          <strong>Publisher:</strong>
          {{ book.publisher }}
        </p>

        <p v-if="book.publishedDate">
          <strong>Published:</strong>
          {{ book.publishedDate }}
        </p>

        <p>
          <strong>ISBN:</strong>
          {{ isbn }}
        </p>

      </div>

      <p v-if="book.description" class="mt-6 text-sm leading-relaxed">
        {{ book.description }}
      </p>
    </section>
  </main>
</template>
