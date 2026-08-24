<script setup lang="ts">
import shelfGoblinBadge from '@/assets/ShelfGoblinBadge.png'
</script>

<template>
  <main class="min-h-screen w-full max-w-xl mx-auto px-6 py-16 flex flex-col">
    <div class="flex items-center gap-3 justify-center">
      <img :src="shelfGoblinBadge" alt="Shelf Goblin" class="h-12 w-auto" />
      <RouterLink
          :to="{ name: 'home' }"
          >
          <h1>Shelf Goblin</h1>
        </RouterLink>
    </div>

    <RouterView />

    <footer class="mt-auto pt-12 text-center text-sm">
      <a href="/support.html" class="underline hover:opacity-80">Support</a>
      <span class="mx-2">·</span>
      <a href="/privacy.html" class="underline hover:opacity-80">Privacy policy</a>
    </footer>
  </main>
</template>
