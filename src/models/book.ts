/** A BookShelf row representing one physical book or edition. */
export interface Book {
  isbn?: string
  title: string
  series: string
  volume: string
  authors: string
  publisher: string
  published: string
  coverUrl: string
  description: string
  read: boolean
  dateRead: string
  rating: number | null
  notes: string
}

/**
 * A Book being reviewed before it is saved to BookShelf.
 */
export interface BookDraft extends Book {

}
