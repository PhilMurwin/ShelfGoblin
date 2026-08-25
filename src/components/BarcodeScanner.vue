<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'
import { CameraIcon, PhotoIcon, XMarkIcon } from '@heroicons/vue/24/outline'

const emit = defineEmits<{
  detected: [barcode: string]
  close: []
}>()

const mode = ref<'camera' | 'image'>('camera')
const videoRef = ref<HTMLVideoElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const cameraError = ref<string | null>(null)
const imageError = ref<string | null>(null)
const imageScanning = ref(false)

const isbnFormats = [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]

// Video reader: no TRY_HARDER — continuous scanning gets many frames so it doesn't need it,
// and TRY_HARDER causes ZXing to try far more reader combinations, flooding the console.
const videoReader = new BrowserMultiFormatReader(new Map<DecodeHintType, unknown>([
  [DecodeHintType.POSSIBLE_FORMATS, isbnFormats],
]))

// Image reader: TRY_HARDER on — single-shot so we need the thorough search.
const codeReader = new BrowserMultiFormatReader(new Map<DecodeHintType, unknown>([
  [DecodeHintType.TRY_HARDER, true],
  [DecodeHintType.POSSIBLE_FORMATS, isbnFormats],
]))
let controls: { stop(): void } | null = null
let mounted = false

onMounted(() => { mounted = true })
onUnmounted(() => {
  mounted = false
  controls?.stop()
  controls = null
})

async function startCamera() {
  if (!videoRef.value) return
  cameraError.value = null
  try {
    const cam = await videoReader.decodeFromVideoDevice(undefined, videoRef.value, (result) => {
      if (result) emit('detected', result.getText())
    })
    // Mode or mount state may have changed while the async call was in flight
    if (mounted && mode.value === 'camera') {
      controls = cam
    } else {
      cam.stop()
    }
  } catch {
    if (mounted) cameraError.value = 'Camera not available.'
  }
}

function stopCamera() {
  controls?.stop()
  controls = null
}

watch(videoRef, (el) => {
  if (el && mode.value === 'camera') startCamera()
})

watch(mode, (newMode) => {
  if (newMode === 'image') {
    stopCamera()
  } else {
    if (videoRef.value) startCamera()
  }
})

// --- image scanning ---

async function tryNativeDetector(file: File): Promise<string | null> {
  if (!('BarcodeDetector' in window)) return null
  try {
    const BarcodeDetectorClass = (window as any).BarcodeDetector
    const detector = new BarcodeDetectorClass()
    const bitmap = await createImageBitmap(file)
    const barcodes = await detector.detect(bitmap)
    bitmap.close()
    return barcodes.length > 0 ? barcodes[0].rawValue as string : null
  } catch {
    return null
  }
}

function scaleToWidth(img: HTMLImageElement | HTMLCanvasElement, targetWidth: number): HTMLCanvasElement {
  const srcW = img instanceof HTMLImageElement ? img.naturalWidth : img.width
  const srcH = img instanceof HTMLImageElement ? img.naturalHeight : img.height
  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = Math.round(srcH * (targetWidth / srcW))
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas
}

function cropStrip(img: HTMLImageElement, fromTop: boolean, fraction: number): HTMLCanvasElement {
  const cropH = Math.round(img.naturalHeight * fraction)
  const cropY = fromTop ? 0 : img.naturalHeight - cropH
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = cropH
  canvas.getContext('2d')!.drawImage(img, 0, cropY, img.naturalWidth, cropH, 0, 0, img.naturalWidth, cropH)
  return canvas
}

function cropRegion(img: HTMLImageElement, x: number, y: number, w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.drawImage(img, x, y, w, h, 0, 0, w, h)
  return canvas
}

function enhanced(src: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = src.width
  canvas.height = src.height
  const ctx = canvas.getContext('2d')!
  ctx.filter = 'grayscale(100%) contrast(250%)'
  ctx.drawImage(src, 0, 0)
  return canvas
}

async function tryZxing(file: File): Promise<string | null> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject()
      img.src = url
    })

    const { naturalWidth: w, naturalHeight: h } = img
    const isPortrait = h > w

    // Build all candidate canvases up front
    const candidates: HTMLCanvasElement[] = []

    for (const targetW of [1400, 2000, 800]) {
      candidates.push(scaleToWidth(img, targetW))
    }

    if (isPortrait) {
      // Full-width horizontal strips
      for (const vFrac of [0.35, 0.25, 0.15]) {
        for (const fromTop of [false, true]) {
          candidates.push(scaleToWidth(cropStrip(img, fromTop, vFrac), 1400))
        }
      }

      // Quadrant crops — handles barcodes in any corner
      const halfW = Math.round(w / 2)
      for (const vFrac of [0.35, 0.25]) {
        const cropH = Math.round(h * vFrac)
        for (const cropY of [h - cropH, 0]) {
          for (const cropX of [halfW, 0]) {
            candidates.push(scaleToWidth(cropRegion(img, cropX, cropY, halfW, cropH), 1400))
          }
        }
      }
    }

    // Pass 1: try each candidate as-is
    for (const c of candidates) {
      try { return (await codeReader.decodeFromCanvas(c)).getText() } catch { /* try next */ }
    }

    // Pass 2: grayscale + high contrast — sharpens blurry JPEG bar edges for ZXing's binarizer
    for (const c of candidates) {
      try { return (await codeReader.decodeFromCanvas(enhanced(c))).getText() } catch { /* try next */ }
    }

    return null
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function handleImageFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  imageError.value = null
  imageScanning.value = true

  try {
    const barcode = await tryNativeDetector(file) ?? await tryZxing(file)
    if (barcode) {
      emit('detected', barcode)
    } else {
      imageError.value = 'No barcode found in that image.'
    }
  } finally {
    imageScanning.value = false
    if (fileInputRef.value) fileInputRef.value.value = ''
  }
}
</script>

<template>
  <div class="mt-6 rounded-xl border border-(--border) overflow-hidden">

    <!-- Mode toggle -->
    <div class="flex border-b border-(--border) bg-(--bg)">
      <button
        type="button"
        :class="mode === 'camera' ? 'border-b-2 border-(--accent) text-(--accent)' : 'text-(--text) opacity-60 hover:opacity-100'"
        class="flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-colors"
        @click="mode = 'camera'"
      >
        <CameraIcon class="w-4 h-4" />
        Camera
      </button>
      <button
        type="button"
        :class="mode === 'image' ? 'border-b-2 border-(--accent) text-(--accent)' : 'text-(--text) opacity-60 hover:opacity-100'"
        class="flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-colors"
        @click="mode = 'image'"
      >
        <PhotoIcon class="w-4 h-4" />
        Image
      </button>

      <button
        type="button"
        class="ml-auto px-3 text-(--text) opacity-50 hover:opacity-100 transition-opacity"
        @click="emit('close')"
      >
        <XMarkIcon class="w-5 h-5" />
      </button>
    </div>

    <!-- Camera mode -->
    <div v-show="mode === 'camera'" class="relative bg-black aspect-video">
      <video
        ref="videoRef"
        class="w-full h-full object-cover"
        autoplay
        muted
        playsinline
      />
      <div v-if="cameraError" class="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white">
        <CameraIcon class="w-10 h-10 opacity-40" />
        <p class="text-sm opacity-60">{{ cameraError }}</p>
      </div>
      <template v-else>
        <!-- Corner-bracket viewfinder -->
        <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div class="relative w-3/4 h-1/2">
            <span class="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-white/80" />
            <span class="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-white/80" />
            <span class="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-white/80" />
            <span class="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-white/80" />
          </div>
        </div>
        <div class="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
        <p class="absolute bottom-3 inset-x-0 text-center text-white/70 text-sm pointer-events-none">
          Point at a barcode to scan
        </p>
      </template>
    </div>

    <!-- Image mode -->
    <div v-if="mode === 'image'" class="p-6 flex flex-col items-center gap-4 bg-(--bg)">
      <input
        ref="fileInputRef"
        type="file"
        accept="image/*"
        class="hidden"
        @change="handleImageFile"
      />
      <button
        type="button"
        :disabled="imageScanning"
        class="flex flex-col items-center gap-3 w-full py-10 rounded-lg border-2 border-dashed border-(--border) hover:border-(--accent) hover:text-(--accent) text-(--text) opacity-70 hover:opacity-100 disabled:opacity-40 transition-colors cursor-pointer"
        @click="fileInputRef?.click()"
      >
        <PhotoIcon class="w-10 h-10" />
        <span class="text-sm font-medium">
          {{ imageScanning ? 'Scanning...' : 'Click to choose an image' }}
        </span>
      </button>
      <p v-if="imageError" class="text-sm text-red-500">{{ imageError }}</p>
    </div>

  </div>
</template>
