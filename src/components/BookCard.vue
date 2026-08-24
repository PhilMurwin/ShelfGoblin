<script setup lang="ts">
import type { Book } from '@/models/book'
import { PencilSquareIcon } from '@heroicons/vue/24/outline'

defineProps<{ books: Book[] }>()
defineEmits<{ 'toggle-read': [book: Book]; edit: [book: Book] }>()
</script>

<template>
  <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
    <div
      v-for="book in books"
      :key="(book.isbn ?? '') + book.title"
      class="rounded-lg overflow-hidden"
      style="border: 1px solid var(--border)"
    >
      <div
        class="aspect-[2/3] flex items-center justify-center overflow-hidden"
        style="background: var(--border)"
      >
        <img
          v-if="book.coverUrl"
          :src="book.coverUrl"
          :alt="book.title"
          class="w-full h-full object-cover"
        />
        <span v-else class="text-4xl select-none">📖</span>
      </div>

      <div class="p-2 text-sm">
        <div class="font-medium leading-snug" style="color: var(--text-h)">{{ book.title }}</div>
        <div v-if="book.series" class="text-xs mt-0.5 leading-snug" style="color: var(--text)">
          {{ book.series }}<span v-if="book.volume"> · {{ book.volume }}</span>
        </div>
        <div v-if="book.authors" class="text-xs mt-0.5 truncate" style="color: var(--text)">
          {{ book.authors }}
        </div>
        <div class="mt-1.5 flex items-center gap-1.5">
          <button
            type="button"
            class="text-xs py-0.5 rounded-full font-medium cursor-pointer hover:opacity-75 transition-opacity w-16 text-center"
            :class="book.read
              ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
              : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'"
            :title="book.read ? 'Mark as unread' : 'Mark as read'"
            @click="$emit('toggle-read', book)"
          >
            {{ book.read ? '✓ Read' : 'Unread' }}
          </button>
          <button
            type="button"
            class="p-1 rounded cursor-pointer hover:bg-black/5 dark:hover:bg-white/10"
            style="color: var(--text)"
            aria-label="Edit book"
            @click="$emit('edit', book)"
          >
            <PencilSquareIcon class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
