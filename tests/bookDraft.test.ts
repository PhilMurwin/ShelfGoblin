import { describe, expect, it } from 'vitest'
import { canonicalizeIsbn, createBookDraft } from '../src/services/bookDraft.ts'
import { extractGoogleBooksMetadata } from '../src/services/googleBooks.ts'

describe('Google Books to BookDraft conversion', () => {
  it('converts normal Google Books metadata into a BookDraft', () => {
  const metadata = extractGoogleBooksMetadata({
    items: [
      {
        volumeInfo: {
          title: 'Fullmetal Alchemist, Vol. 1',
          authors: ['Hiromu Arakawa'],
          publisher: 'VIZ Media',
          publishedDate: '2014-11-11',
          description: 'Two brothers search for the Philosopher\'s Stone.',
          imageLinks: {
            thumbnail: 'https://example.com/thumbnail.jpg',
            smallThumbnail: 'https://example.com/small-thumbnail.jpg',
          },
        },
      },
    ],
  })

    expect(metadata).not.toBeNull()
    expect(createBookDraft(metadata!, '978-1-4215-3690-4')).toEqual({
      isbn: '9781421536904',
      title: 'Fullmetal Alchemist, Vol. 1',
      series: '',
      volume: '',
      authors: 'Hiromu Arakawa',
      publisher: 'VIZ Media',
      published: '2014-11-11',
      coverUrl: 'https://example.com/thumbnail.jpg',
      description: 'Two brothers search for the Philosopher\'s Stone.',
      read: false,
      dateRead: '',
      rating: null,
      notes: '',
    })
  })

  it('uses empty strings for missing optional Google Books metadata', () => {
    const metadata = extractGoogleBooksMetadata({
      items: [{ volumeInfo: { title: 'Untitled Book' } }],
    })

    expect(metadata).not.toBeNull()
    const draft = createBookDraft(metadata!, '')

    expect(draft.isbn).toBeUndefined()
    expect(draft.title).toBe('Untitled Book')
    expect(draft.authors).toBe('')
    expect(draft.publisher).toBe('')
    expect(draft.published).toBe('')
    expect(draft.description).toBe('')
  })

  it('joins multiple authors for BookShelf storage', () => {
    const metadata = extractGoogleBooksMetadata({
      items: [
        {
          volumeInfo: {
            authors: ['Terry Pratchett', 'Neil Gaiman'],
          },
        },
      ],
    })

    expect(metadata).not.toBeNull()
    expect(createBookDraft(metadata!, '9780060853983').authors).toBe(
      'Terry Pratchett, Neil Gaiman',
    )
  })

  it('uses an empty cover URL when Google Books supplies no cover', () => {
    const metadata = extractGoogleBooksMetadata({
      items: [{ volumeInfo: { title: 'No Cover' } }],
    })

    expect(metadata).not.toBeNull()
    expect(createBookDraft(metadata!, '9780060853983').coverUrl).toBe('')
  })

  it('returns null when Google Books has no result', () => {
    expect(extractGoogleBooksMetadata({ items: [] })).toBeNull()
    expect(extractGoogleBooksMetadata({})).toBeNull()
  })

  it('canonicalizes ISBN input by removing spaces and hyphens', () => {
    expect(canonicalizeIsbn('978-1 4215-3690 4')).toBe('9781421536904')
  })

  it('sets the BookShelf defaults for reading fields', () => {
    const draft = createBookDraft({}, '9780060853983')

    expect(draft.read).toBe(false)
    expect(draft.dateRead).toBe('')
    expect(draft.rating).toBeNull()
    expect(draft.notes).toBe('')
  })
})
