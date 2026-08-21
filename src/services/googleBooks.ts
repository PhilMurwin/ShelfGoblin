export interface GoogleBooksVolumeInfo {
  title?: string
  authors?: string[]
  publisher?: string
  publishedDate?: string
  description?: string
  imageLinks?: {
    thumbnail?: string
    smallThumbnail?: string
  }
}

interface GoogleBooksVolume {
  volumeInfo?: GoogleBooksVolumeInfo
}

interface GoogleBooksVolumesResponse {
  items?: GoogleBooksVolume[]
}

/** The Google Books fields Shelf Goblin uses while preparing a new BookDraft. */
export interface GoogleBooksMetadata {
  title?: string
  authors?: string[]
  publisher?: string
  publishedDate?: string
  description?: string
  coverUrl?: string
}

/** Extracts the fields Shelf Goblin uses from the first Google Books result. */
export function extractGoogleBooksMetadata(
  data: GoogleBooksVolumesResponse,
): GoogleBooksMetadata | null {
  const volumeInfo = data.items?.[0]?.volumeInfo

  if (!volumeInfo) {
    return null
  }

  return {
    title: volumeInfo.title,
    authors: volumeInfo.authors,
    publisher: volumeInfo.publisher,
    publishedDate: volumeInfo.publishedDate,
    description: volumeInfo.description,
    coverUrl: volumeInfo.imageLinks?.thumbnail ?? volumeInfo.imageLinks?.smallThumbnail,
  }
}

export async function lookupBookByIsbn(isbn: string): Promise<GoogleBooksMetadata | null> {
  const response = await fetch(
    `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}&key=${import.meta.env.VITE_GOOGLE_BOOKS_API_KEY}`,
  )

  if (!response.ok) {
    throw new Error('Google Books request failed')
  }

  const data: GoogleBooksVolumesResponse = await response.json()
  return extractGoogleBooksMetadata(data)
}
