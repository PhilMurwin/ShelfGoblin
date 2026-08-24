<script setup lang="ts">
import type { Book } from '@/models/book'
import { PencilSquareIcon } from '@heroicons/vue/24/outline'

defineProps<{ books: Book[] }>()
defineEmits<{ 'toggle-read': [book: Book]; edit: [book: Book] }>()
</script>

<template>
  <div class="overflow-x-auto">
    <table class="w-full text-sm border-collapse">
      <thead>
        <tr style="border-bottom: 1px solid var(--border)">
          <th class="pb-2 pr-3 w-10 font-medium text-left"></th>
          <th class="pb-2 pr-3 font-medium text-left">Title</th>
          <th class="pb-2 pr-3 font-medium text-left hidden sm:table-cell">Series</th>
          <th class="pb-2 pr-3 font-medium text-left hidden sm:table-cell">Vol.</th>
          <th class="pb-2 pr-3 font-medium text-left hidden md:table-cell">Author</th>
          <th class="pb-2 pr-3 font-medium text-left">Status</th>
          <th class="pb-2 font-medium text-left"></th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="book in books"
          :key="(book.isbn ?? '') + book.title"
          style="border-bottom: 1px solid var(--border)"
        >
          <td class="py-2 pr-3 align-middle">
            <img
              v-if="book.coverUrl"
              :src="book.coverUrl"
              :alt="book.title"
              class="w-8 h-10 object-cover rounded"
            />
            <div
              v-else
              class="w-8 h-10 rounded flex items-center justify-center text-base select-none"
              style="background: var(--border)"
            >
              📖
            </div>
          </td>
          <td class="py-2 pr-3 align-middle">
            <span class="font-medium" style="color: var(--text-h)">{{ book.title }}</span>
            <div class="sm:hidden text-xs mt-0.5" style="color: var(--text)">
              <span v-if="book.series">
                {{ book.series }}<span v-if="book.volume"> · {{ book.volume }}</span>
              </span>
            </div>
          </td>
          <td class="py-2 pr-3 align-middle hidden sm:table-cell" style="color: var(--text)">
            {{ book.series }}
          </td>
          <td class="py-2 pr-3 align-middle hidden sm:table-cell" style="color: var(--text)">
            {{ book.volume }}
          </td>
          <td class="py-2 pr-3 align-middle hidden md:table-cell" style="color: var(--text)">
            {{ book.authors }}
          </td>
          <td class="py-2 pr-3 align-middle">
            <button
              type="button"
              class="text-xs py-0.5 rounded-full font-medium cursor-pointer hover:opacity-75 transition-opacity w-16 text-center"
              :class="book.read
                ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'"
              :title="book.read ? 'Mark as unread' : 'Mark as read'"
              @click="$emit('toggle-read', book)"
            >
              {{ book.read ? 'Read' : 'Unread' }}
            </button>
          </td>
          <td class="py-2 align-middle">
            <button
              type="button"
              class="p-1 rounded cursor-pointer hover:bg-black/5 dark:hover:bg-white/10"
              style="color: var(--text)"
              aria-label="Edit book"
              @click="$emit('edit', book)"
            >
              <PencilSquareIcon class="w-4 h-4" />
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
