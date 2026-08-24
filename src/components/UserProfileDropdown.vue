<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { authState, signOut } from '@/services/googleAuth'

const open = ref(false)
const imageError = ref(false)

watch(
  () => authState.user?.picture,
  () => { imageError.value = false },
)

const showImage = computed(() => !!authState.user?.picture && !imageError.value)

function handleSignOut() {
  open.value = false
  signOut()
}
</script>

<template>
  <div v-if="authState.user" class="relative">
    <div v-if="open" class="fixed inset-0 z-10" @click="open = false" />

    <button
      type="button"
      class="relative z-20 flex items-center gap-2 cursor-pointer group rounded-full border border-(--border) pl-1 pr-3 py-1 transition-colors hover:border-(--accent) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--accent) focus-visible:ring-offset-2"
      :aria-expanded="open"
      aria-haspopup="true"
      @click="open = !open"
    >
      <div
        class="h-7 w-7 rounded-full overflow-hidden flex-shrink-0"
      >
        <img
          v-if="showImage"
          :src="authState.user.picture"
          :alt="authState.user.name"
          referrerpolicy="no-referrer"
          class="h-full w-full object-cover"
          @error="imageError = true"
        />
        <div
          v-else
          class="h-full w-full flex items-center justify-center bg-gray-100 dark:bg-gray-700"
        >
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            class="h-5 w-5 text-gray-400 dark:text-gray-500"
            aria-hidden="true"
          >
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
          </svg>
        </div>
      </div>

      <span class="text-sm font-medium truncate max-w-32">{{ authState.user.name }}</span>

      <svg
        viewBox="0 0 20 20"
        fill="currentColor"
        class="h-3.5 w-3.5 text-gray-400 flex-shrink-0 transition-transform duration-150"
        :class="open ? 'rotate-180' : ''"
        aria-hidden="true"
      >
        <path
          fill-rule="evenodd"
          d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
          clip-rule="evenodd"
        />
      </svg>
    </button>

    <Transition
      enter-active-class="transition ease-out duration-100"
      enter-from-class="transform opacity-0 scale-95"
      enter-to-class="transform opacity-100 scale-100"
      leave-active-class="transition ease-in duration-75"
      leave-from-class="transform opacity-100 scale-100"
      leave-to-class="transform opacity-0 scale-95"
    >
      <div
        v-if="open"
        class="absolute right-0 top-full z-20 mt-2 w-56 rounded-xl border border-(--border) bg-white dark:bg-[#1a1b22] shadow-lg overflow-hidden"
      >
        <div class="px-4 py-3 border-b border-(--border)">
          <p class="text-sm font-medium truncate">{{ authState.user.name }}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
            {{ authState.user.email }}
          </p>
        </div>
        <button
          type="button"
          class="w-full text-right px-4 py-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
          @click="handleSignOut"
        >
          Sign out
        </button>
      </div>
    </Transition>
  </div>
</template>
