<script setup lang="ts">
import { ref } from 'vue'

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
    console.log(JSON.stringify(data.items?.[0]?.volumeInfo, null, 2))

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
  <main>
    <h1>Shelf Goblin</h1>

    <div>
      <input
        v-model="isbn"
        placeholder="Enter ISBN"
        @keyup.enter="lookupBook"
      />

      <button
        @click="lookupBook"
        :disabled="loading"
      >
        {{ loading ? 'Looking up...' : 'Look Up' }}
      </button>
    </div>

    <p v-if="error">
      {{ error }}
    </p>

    <section v-if="book">
      <img
        v-if="book.imageLinks?.thumbnail"
        :src="book.imageLinks.thumbnail"
        :alt="book.title"
      />

      <h2>{{ book.title }}</h2>

      <p v-if="book.subtitle">
        {{ book.subtitle }}
      </p>

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

      <div v-if="book.industryIdentifiers">
        <strong>Identifiers:</strong>

        <ul>
          <li
            v-for="identifier in book.industryIdentifiers"
            :key="identifier.identifier"
          >
            {{ identifier.type }}: {{ identifier.identifier }}
          </li>
        </ul>
      </div>

      <p v-if="book.description">
        {{ book.description }}
      </p>
    </section>
  </main>
</template>