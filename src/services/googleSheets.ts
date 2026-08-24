import type { Book } from '@/models/book'
import { canonicalizeIsbn } from '../services/bookDraft.ts'
import { getAccessToken } from './googleAuth'
import { findMetadataFile, readMetadataFile, createMetadataFile, updateMetadataFile } from './googleDrive'

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets'

export const SPREADSHEET_NAME = 'Shelf Goblin'
export const BOOKSHELF_SHEET_NAME = 'BookShelf'
export const BOOKSHELF_HEADERS = [
  'ISBN',
  'Title',
  'Series',
  'Volume',
  'Authors',
  'Publisher',
  'Published',
  'Cover URL',
  'Description',
  'Read',
  'Date Read',
  'Rating',
  'Notes',
]

export type AddBookResult =
  | { added: true; rowNumber: number }
  | { added: false; reason: 'duplicate'; existingRowNumber: number }

export interface SheetInfo {
  sheetId: number
  title: string
}

export interface SpreadsheetInfo {
  spreadsheetId: string
  sheets: SheetInfo[]
}

interface ShelfBookMatch {
  rowNumber: number
  isbn: string
  title: string
}

export class SheetsApiError extends Error {
  readonly status: number

  constructor(status: number, statusText: string) {
    super(`Google Sheets error ${status}: ${statusText}`)
    this.name = 'SheetsApiError'
    this.status = status
  }
}

/** Thrown when metadata exists but the referenced spreadsheet returns 404. */
export class SpreadsheetNotFoundError extends Error {
  readonly metadataFileId: string

  constructor(metadataFileId: string) {
    super('Your Shelf Goblin spreadsheet could not be found.')
    this.name = 'SpreadsheetNotFoundError'
    this.metadataFileId = metadataFileId
  }
}

async function authorizedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken()
  return fetch(url, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${token}` },
  })
}

export async function createSpreadsheet(): Promise<SpreadsheetInfo> {
  const response = await authorizedFetch(SHEETS_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      properties: { title: SPREADSHEET_NAME },
      sheets: [{ properties: { title: BOOKSHELF_SHEET_NAME } }],
    }),
  })

  if (!response.ok) {
    throw new SheetsApiError(response.status, response.statusText)
  }

  return parseSpreadsheetResponse(await response.json())
}

export async function getSpreadsheet(spreadsheetId: string): Promise<SpreadsheetInfo> {
  const params = new URLSearchParams({ fields: 'spreadsheetId,sheets.properties' })
  const response = await authorizedFetch(`${SHEETS_API}/${encodeURIComponent(spreadsheetId)}?${params}`)

  if (!response.ok) {
    throw new SheetsApiError(response.status, response.statusText)
  }

  return parseSpreadsheetResponse(await response.json())
}

export async function addWorksheet(spreadsheetId: string, title: string): Promise<void> {
  const response = await authorizedFetch(
    `${SHEETS_API}/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title } } }],
      }),
    },
  )

  if (!response.ok) {
    throw new SheetsApiError(response.status, response.statusText)
  }
}

export async function readFirstRowCell(
  spreadsheetId: string,
  sheetTitle: string,
): Promise<string | null> {
  const range = encodeURIComponent(`${sheetTitle}!A1`)
  const response = await authorizedFetch(
    `${SHEETS_API}/${encodeURIComponent(spreadsheetId)}/values/${range}`,
  )

  if (!response.ok) {
    throw new SheetsApiError(response.status, response.statusText)
  }

  const data = (await response.json()) as { values?: string[][] }
  return data.values?.[0]?.[0] ?? null
}

export async function writeHeaderRow(spreadsheetId: string, sheetTitle: string): Promise<void> {
  const range = encodeURIComponent(`${sheetTitle}!A1`)
  const response = await authorizedFetch(
    `${SHEETS_API}/${encodeURIComponent(spreadsheetId)}/values/${range}?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [BOOKSHELF_HEADERS] }),
    },
  )

  if (!response.ok) {
    throw new SheetsApiError(response.status, response.statusText)
  }
}

/**
 * Finds or creates the Shelf Goblin spreadsheet, ensures the BookShelf worksheet
 * exists with its header row, and persists the spreadsheet ID in appDataFolder metadata.
 *
 * Throws SpreadsheetNotFoundError when metadata exists but the stored spreadsheet
 * returns 404 — the caller should offer to recreate it via recreateShelfGoblinSpreadsheet.
 * Other API errors (403, 500, etc.) are thrown as SheetsApiError.
 */
export async function ensureShelfGoblinSpreadsheet(): Promise<{ spreadsheetId: string }> {
  const metadataFile = await findMetadataFile()

  if (!metadataFile) {
    const spreadsheet = await createSpreadsheet()
    await writeHeaderRow(spreadsheet.spreadsheetId, BOOKSHELF_SHEET_NAME)
    await createMetadataFile({ spreadsheetId: spreadsheet.spreadsheetId })
    return { spreadsheetId: spreadsheet.spreadsheetId }
  }

  const metadata = await readMetadataFile(metadataFile.id)

  try {
    const spreadsheet = await getSpreadsheet(metadata.spreadsheetId)
    await ensureBookShelfWorksheet(spreadsheet)
    return { spreadsheetId: spreadsheet.spreadsheetId }
  } catch (error) {
    if (error instanceof SheetsApiError && error.status === 404) {
      throw new SpreadsheetNotFoundError(metadataFile.id)
    }
    throw error
  }
}

/**
 * Creates a fresh Shelf Goblin spreadsheet and updates the existing appDataFolder
 * metadata to point to it. Call this after catching SpreadsheetNotFoundError.
 */
export async function recreateShelfGoblinSpreadsheet(
  metadataFileId: string,
): Promise<{ spreadsheetId: string }> {
  const spreadsheet = await createSpreadsheet()
  await writeHeaderRow(spreadsheet.spreadsheetId, BOOKSHELF_SHEET_NAME)
  await updateMetadataFile(metadataFileId, { spreadsheetId: spreadsheet.spreadsheetId })
  return { spreadsheetId: spreadsheet.spreadsheetId }
}

async function ensureBookShelfWorksheet(spreadsheet: SpreadsheetInfo): Promise<void> {
  const hasBookShelf = spreadsheet.sheets.some((s) => s.title === BOOKSHELF_SHEET_NAME)

  if (!hasBookShelf) {
    await addWorksheet(spreadsheet.spreadsheetId, BOOKSHELF_SHEET_NAME)
    await writeHeaderRow(spreadsheet.spreadsheetId, BOOKSHELF_SHEET_NAME)
    return
  }

  const firstCell = await readFirstRowCell(spreadsheet.spreadsheetId, BOOKSHELF_SHEET_NAME)
  if (!firstCell) {
    await writeHeaderRow(spreadsheet.spreadsheetId, BOOKSHELF_SHEET_NAME)
  }
}

function parseSpreadsheetResponse(data: unknown): SpreadsheetInfo {
  if (!data || typeof data !== 'object') {
    throw new Error('Google Sheets returned an unexpected response.')
  }

  const d = data as Record<string, unknown>

  if (typeof d.spreadsheetId !== 'string') {
    throw new Error('Google Sheets returned an unexpected response.')
  }

  const sheets = Array.isArray(d.sheets)
    ? (d.sheets as Array<{ properties?: { sheetId?: number; title?: string } }>).map((s) => ({
        sheetId: s.properties?.sheetId ?? 0,
        title: s.properties?.title ?? '',
      }))
    : []

  return { spreadsheetId: d.spreadsheetId, sheets }
}

export async function findBookInShelf(
  spreadsheetId: string,
  sheetTitle: string,
  book: Book,
): Promise<ShelfBookMatch | null> {
  const range = encodeURIComponent(`${sheetTitle}!A:B`)
  const response = await authorizedFetch(
    `${SHEETS_API}/${encodeURIComponent(spreadsheetId)}/values/${range}`,
    {
      method: 'GET',
    },
  )

  if (!response.ok) {
    throw new SheetsApiError(response.status, response.statusText)
  }

  const data = (await response.json()) as {
    values?: string[][]
  }

  const rows = data.values ?? []

  // Skip the header row.
  for (let index = 1; index < rows.length; index++) {
    const row = rows[index]
    const existingIsbn = row?.[0]?.trim() ?? ''
    const existingTitle = row?.[1]?.trim() ?? ''

    if (book.isbn) {
      if (
        existingIsbn &&
        canonicalizeIsbn(existingIsbn) === canonicalizeIsbn(book.isbn)
      ) {
        return {
          rowNumber: index + 1,
          isbn: existingIsbn,
          title: existingTitle,
        }
      }
    } else if (
      existingTitle &&
      existingTitle.toLowerCase() === book.title.trim().toLowerCase()
    ) {
      return {
        rowNumber: index + 1,
        isbn: existingIsbn,
        title: existingTitle,
      }
    }
  }

  return null
}

export async function addBookToShelf(
  spreadsheetId: string,
  sheetTitle: string,
  book: Book,
): Promise<AddBookResult> {
  const existingBook = await findBookInShelf(spreadsheetId, sheetTitle, book,)

  if (existingBook) {
    return {
      added: false,
      reason: 'duplicate',
      existingRowNumber: existingBook.rowNumber,
    }
  }

  const range = encodeURIComponent(`${sheetTitle}!A:M`)
  const response = await authorizedFetch(
    `${SHEETS_API}/${encodeURIComponent(spreadsheetId)}/values/${range}:append?valueInputOption=RAW`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        values: [[
          book.isbn ?? '',
          book.title,
          book.series,
          book.volume,
          book.authors,
          book.publisher,
          book.published,
          book.coverUrl,
          book.description,
          book.read,
          book.dateRead,
          book.rating ?? '',
          book.notes,
        ]],
      }),
    },
  )

  if (!response.ok) {
    throw new SheetsApiError(response.status, response.statusText)
  }

  const data = (await response.json()) as {
    updates?: {
      updatedRange?: string
    }
  }

  // The Sheets API normally returns something like:
  // BookShelf!A2:M2
  const updatedRange = data.updates?.updatedRange
  const rowNumber = updatedRange ? Number(updatedRange.match(/\d+/)?.[0]) : 0

  return {
    added: true,
    rowNumber,
  }
}

export async function countBooksInShelf(
  spreadsheetId: string,
  sheetTitle: string,
): Promise<number> {
  const range = encodeURIComponent(`${sheetTitle}!B2:B`)
  const response = await authorizedFetch(
    `${SHEETS_API}/${encodeURIComponent(spreadsheetId)}/values/${range}`,
  )

  if (!response.ok) {
    throw new SheetsApiError(response.status, response.statusText)
  }

  const data = (await response.json()) as { values?: string[][] }

  return data.values?.filter((row) => row[0]?.trim()).length ?? 0
}
