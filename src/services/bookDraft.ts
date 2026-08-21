import type { BookDraft } from '@/models/book'
import type { GoogleBooksMetadata } from './googleBooks'

/** Converts user-entered ISBN text to the format used for lookups and storage. */
export function canonicalizeIsbn(isbn: string): string {
  return isbn.replace(/[\s-]/g, '')
}

/** Converts optional external metadata into the editable Shelf Goblin shape. */
export function createBookDraft(metadata: GoogleBooksMetadata, isbn: string): BookDraft {
  return {
    isbn: canonicalizeIsbn(isbn) || undefined,
    title: metadata.title ?? '',
    series: '',
    volume: '',
    authors: metadata.authors?.join(', ') ?? '',
    publisher: metadata.publisher ?? '',
    published: metadata.publishedDate ?? '',
    coverUrl: metadata.coverUrl ?? '',
    read: false,
    dateRead: '',
    rating: null,
    notes: '',
    description: metadata.description ?? '',
  }
}
