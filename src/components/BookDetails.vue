<script setup lang="ts">
import type { BookDraft } from '@/models/book'

const props = defineProps<{
  modelValue: BookDraft
}>()

const emit = defineEmits<{
  'update:modelValue': [book: BookDraft]
}>()

function updateText(field: keyof BookDraft, value: string) {
  emit('update:modelValue', { ...props.modelValue, [field]: value })
}

function setRatingFromClick(star: number, event: MouseEvent) {
  const button = event.currentTarget as HTMLButtonElement
  const bounds = button.getBoundingClientRect()
  const selectedRating =
    event.detail === 0 || event.clientX - bounds.left >= bounds.width / 2 ? star : star - 0.5

  emit('update:modelValue', {
    ...props.modelValue,
    rating: props.modelValue.rating === selectedRating ? null : selectedRating,
  })
}

function updateRead(value: boolean) {
  emit('update:modelValue', { ...props.modelValue, read: value })
}

function starFill(star: number) {
  if (props.modelValue.rating === null || props.modelValue.rating < star - 0.5) {
    return 0
  }

  return props.modelValue.rating < star ? 50 : 100
}
</script>

<template>
  <section class="mt-10 text-left" aria-label="Book details">
    <img
      v-if="modelValue.coverUrl"
      :src="modelValue.coverUrl"
      :alt="modelValue.title || 'Book cover'"
      class="max-h-80 rounded-md mb-6 shadow-md"
    />

    <div class="grid gap-4">
      <label>
        <span class="field-label">Title *</span>
        <input :value="modelValue.title" required @input="updateText('title', ($event.target as HTMLInputElement).value)" />
      </label>

      <label>
        <span class="field-label">ISBN</span>
        <input :value="modelValue.isbn" @input="updateText('isbn', ($event.target as HTMLInputElement).value)" />
      </label>

      <label>
        <span class="field-label">Author(s)</span>
        <input :value="modelValue.authors" @input="updateText('authors', ($event.target as HTMLInputElement).value)" />
      </label>

      <div class="grid gap-4 sm:grid-cols-2">
        <label>
          <span class="field-label">Series</span>
          <input :value="modelValue.series" @input="updateText('series', ($event.target as HTMLInputElement).value)" />
        </label>
        <label>
          <span class="field-label">Volume</span>
          <input :value="modelValue.volume" @input="updateText('volume', ($event.target as HTMLInputElement).value)" />
        </label>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <label>
          <span class="field-label">Publisher</span>
          <input :value="modelValue.publisher" @input="updateText('publisher', ($event.target as HTMLInputElement).value)" />
        </label>
        <label>
          <span class="field-label">Published</span>
          <input :value="modelValue.published" @input="updateText('published', ($event.target as HTMLInputElement).value)" />
        </label>
      </div>

      <label>
        <span class="field-label">Cover URL</span>
        <input :value="modelValue.coverUrl" type="url" @input="updateText('coverUrl', ($event.target as HTMLInputElement).value)" />
      </label>

      <label>
        <span class="field-label">Description</span>
        <textarea :value="modelValue.description" rows="5" @input="updateText('description', ($event.target as HTMLTextAreaElement).value)" />
      </label>

      <div class="grid gap-4 sm:grid-cols-3">
        <label class="flex items-center gap-2 pt-6 pl-10">
          <input
            :checked="modelValue.read"
            type="checkbox"
            class="h-5 w-5 shrink-0"
            @change="updateRead(($event.target as HTMLInputElement).checked)"
          />
          <span>Read</span>
        </label>
        <label>
          <span class="field-label">Date read</span>
          <input :value="modelValue.dateRead" type="date" @input="updateText('dateRead', ($event.target as HTMLInputElement).value)" />
        </label>
        <div>
          <span id="rating-label" class="field-label">Rating</span>
          <div class="rating-stars" aria-labelledby="rating-label">
            <button
              v-for="star in 5"
              :key="star"
              type="button"
              class="rating-star"
              :style="{ '--fill': `${starFill(star)}%` }"
              :aria-label="`Set rating to ${star} stars; click the left half for ${star - 0.5} stars`"
              @click="setRatingFromClick(star, $event)"
            >
              ★
            </button>
          </div>
        </div>
      </div>

      <label>
        <span class="field-label">Notes</span>
        <textarea :value="modelValue.notes" rows="3" @input="updateText('notes', ($event.target as HTMLTextAreaElement).value)" />
      </label>
    </div>

  </section>
</template>

<style scoped>
input:not([type='checkbox']),
textarea {
  width: 100%;
  margin-top: 0.25rem;
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  background: var(--bg);
  color: var(--text-h);
}

.field-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-h);
}

.rating-stars {
  display: flex;
  gap: 0.125rem;
  margin-top: 0.25rem;
}

.rating-star {
  width: 2.75rem;
  height: 2.75rem;
  padding: 0;
  border: 0;
  border-radius: 0.375rem;
  cursor: pointer;
  font-size: 2rem;
  line-height: 1;
  background: linear-gradient(90deg, var(--accent) var(--fill), var(--border) var(--fill));
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
}

.rating-star:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>
