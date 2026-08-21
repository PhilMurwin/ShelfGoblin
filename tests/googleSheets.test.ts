import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getAccessToken } from '../src/services/googleAuth'
import {
  findMetadataFile,
  readMetadataFile,
  createMetadataFile,
  updateMetadataFile,
} from '../src/services/googleDrive'
import {
  BOOKSHELF_HEADERS,
  BOOKSHELF_SHEET_NAME,
  SPREADSHEET_NAME,
  SpreadsheetNotFoundError,
  addWorksheet,
  createSpreadsheet,
  ensureShelfGoblinSpreadsheet,
  getSpreadsheet,
  readFirstRowCell,
  recreateShelfGoblinSpreadsheet,
  writeHeaderRow,
} from '../src/services/googleSheets'

vi.mock('../src/services/googleAuth', () => ({
  getAccessToken: vi.fn(),
}))

vi.mock('../src/services/googleDrive', () => ({
  findMetadataFile: vi.fn(),
  readMetadataFile: vi.fn(),
  createMetadataFile: vi.fn(),
  updateMetadataFile: vi.fn(),
}))

const mockGetAccessToken = vi.mocked(getAccessToken)
const mockFindMetadataFile = vi.mocked(findMetadataFile)
const mockReadMetadataFile = vi.mocked(readMetadataFile)
const mockCreateMetadataFile = vi.mocked(createMetadataFile)
const mockUpdateMetadataFile = vi.mocked(updateMetadataFile)

function okResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve(body),
  }
}

function errorResponse(status: number, statusText: string) {
  return { ok: false, status, statusText, json: () => Promise.resolve({}) }
}

function spreadsheetResponse(spreadsheetId: string, sheetTitles: string[] = [BOOKSHELF_SHEET_NAME]) {
  return {
    spreadsheetId,
    sheets: sheetTitles.map((title, i) => ({ properties: { sheetId: i, title } })),
  }
}

describe('Google Sheets API functions', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)
    mockGetAccessToken.mockResolvedValue('test-token')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  describe('createSpreadsheet', () => {
    it('posts to the Sheets API with an authorization header', async () => {
      mockFetch.mockResolvedValue(okResponse(spreadsheetResponse('sheet-new')))

      await createSpreadsheet()

      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(url).toContain('sheets.googleapis.com/v4/spreadsheets')
      expect(options.method).toBe('POST')
      expect((options.headers as Record<string, string>)['Authorization']).toBe('Bearer test-token')
    })

    it('creates the spreadsheet with the expected name and BookShelf sheet', async () => {
      mockFetch.mockResolvedValue(okResponse(spreadsheetResponse('sheet-new')))

      await createSpreadsheet()

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit]
      const body = JSON.parse(options.body as string) as {
        properties: { title: string }
        sheets: Array<{ properties: { title: string } }>
      }
      expect(body.properties.title).toBe(SPREADSHEET_NAME)
      expect(body.sheets[0].properties.title).toBe(BOOKSHELF_SHEET_NAME)
    })

    it('returns the parsed spreadsheet info', async () => {
      mockFetch.mockResolvedValue(okResponse(spreadsheetResponse('sheet-abc', ['BookShelf'])))

      const info = await createSpreadsheet()

      expect(info.spreadsheetId).toBe('sheet-abc')
      expect(info.sheets).toEqual([{ sheetId: 0, title: 'BookShelf' }])
    })

    it('throws on a Sheets API error', async () => {
      mockFetch.mockResolvedValue(errorResponse(403, 'Forbidden'))

      await expect(createSpreadsheet()).rejects.toThrow('Google Sheets error 403')
    })

    it('throws on an unexpected response shape', async () => {
      mockFetch.mockResolvedValue(okResponse({ notASpreadsheet: true }))

      await expect(createSpreadsheet()).rejects.toThrow('unexpected response')
    })
  })

  describe('getSpreadsheet', () => {
    it('fetches the spreadsheet by ID with the fields parameter', async () => {
      mockFetch.mockResolvedValue(okResponse(spreadsheetResponse('sheet-xyz')))

      await getSpreadsheet('sheet-xyz')

      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(url).toContain('sheet-xyz')
      expect(url).toContain('fields=')
      expect(options.method).toBeUndefined()
      expect((options.headers as Record<string, string>)['Authorization']).toBe('Bearer test-token')
    })

    it('returns the parsed spreadsheet info including all sheets', async () => {
      mockFetch.mockResolvedValue(
        okResponse(spreadsheetResponse('sheet-xyz', ['BookShelf', 'Stats'])),
      )

      const info = await getSpreadsheet('sheet-xyz')

      expect(info.spreadsheetId).toBe('sheet-xyz')
      expect(info.sheets).toHaveLength(2)
      expect(info.sheets[0].title).toBe('BookShelf')
      expect(info.sheets[1].title).toBe('Stats')
    })

    it('throws on a Sheets API error', async () => {
      mockFetch.mockResolvedValue(errorResponse(404, 'Not Found'))

      await expect(getSpreadsheet('missing-id')).rejects.toThrow('Google Sheets error 404')
    })
  })

  describe('addWorksheet', () => {
    it('sends a batchUpdate request with an addSheet operation', async () => {
      mockFetch.mockResolvedValue(okResponse({ replies: [{}] }))

      await addWorksheet('sheet-abc', 'BookShelf')

      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(url).toContain('sheet-abc')
      expect(url).toContain(':batchUpdate')
      expect(options.method).toBe('POST')

      const body = JSON.parse(options.body as string) as {
        requests: Array<{ addSheet: { properties: { title: string } } }>
      }
      expect(body.requests[0].addSheet.properties.title).toBe('BookShelf')
    })

    it('throws on a Sheets API error', async () => {
      mockFetch.mockResolvedValue(errorResponse(400, 'Bad Request'))

      await expect(addWorksheet('sheet-abc', 'BookShelf')).rejects.toThrow('Google Sheets error 400')
    })
  })

  describe('readFirstRowCell', () => {
    it('fetches the A1 range of the specified sheet', async () => {
      mockFetch.mockResolvedValue(okResponse({ values: [['ISBN']] }))

      const result = await readFirstRowCell('sheet-abc', 'BookShelf')

      const [url] = mockFetch.mock.calls[0] as [string]
      expect(url).toContain('sheet-abc')
      expect(url).toContain('BookShelf')
      expect(url).toContain('A1')
      expect(result).toBe('ISBN')
    })

    it('returns null when the range has no data', async () => {
      mockFetch.mockResolvedValue(okResponse({}))

      expect(await readFirstRowCell('sheet-abc', 'BookShelf')).toBeNull()
    })

    it('returns null when the values array is empty', async () => {
      mockFetch.mockResolvedValue(okResponse({ values: [] }))

      expect(await readFirstRowCell('sheet-abc', 'BookShelf')).toBeNull()
    })

    it('throws on a Sheets API error', async () => {
      mockFetch.mockResolvedValue(errorResponse(403, 'Forbidden'))

      await expect(readFirstRowCell('sheet-abc', 'BookShelf')).rejects.toThrow(
        'Google Sheets error 403',
      )
    })
  })

  describe('writeHeaderRow', () => {
    it('sends a PUT to the values endpoint with RAW input', async () => {
      mockFetch.mockResolvedValue(okResponse({ updatedCells: 13 }))

      await writeHeaderRow('sheet-abc', 'BookShelf')

      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(url).toContain('sheet-abc')
      expect(url).toContain('BookShelf')
      expect(url).toContain('A1')
      expect(url).toContain('valueInputOption=RAW')
      expect(options.method).toBe('PUT')
    })

    it('writes the expected header columns', async () => {
      mockFetch.mockResolvedValue(okResponse({ updatedCells: 13 }))

      await writeHeaderRow('sheet-abc', 'BookShelf')

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit]
      const body = JSON.parse(options.body as string) as { values: string[][] }
      expect(body.values[0]).toEqual(BOOKSHELF_HEADERS)
      expect(body.values[0]).toHaveLength(13)
    })

    it('throws on a Sheets API error', async () => {
      mockFetch.mockResolvedValue(errorResponse(500, 'Server Error'))

      await expect(writeHeaderRow('sheet-abc', 'BookShelf')).rejects.toThrow(
        'Google Sheets error 500',
      )
    })
  })
})

describe('ensureShelfGoblinSpreadsheet', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)
    mockGetAccessToken.mockResolvedValue('test-token')
    mockCreateMetadataFile.mockResolvedValue({ id: 'meta-file-id', name: 'Shelf Goblin Metadata.json' })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  describe('new spreadsheet (no metadata)', () => {
    beforeEach(() => {
      mockFindMetadataFile.mockResolvedValue(null)
    })

    it('creates a spreadsheet with the expected name', async () => {
      mockFetch
        .mockResolvedValueOnce(okResponse(spreadsheetResponse('new-sheet-id')))
        .mockResolvedValueOnce(okResponse({ updatedCells: 13 }))

      await ensureShelfGoblinSpreadsheet()

      const [, createOptions] = mockFetch.mock.calls[0] as [string, RequestInit]
      const body = JSON.parse(createOptions.body as string) as {
        properties: { title: string }
        sheets: Array<{ properties: { title: string } }>
      }
      expect(body.properties.title).toBe(SPREADSHEET_NAME)
    })

    it('initializes the BookShelf worksheet with the header row', async () => {
      mockFetch
        .mockResolvedValueOnce(okResponse(spreadsheetResponse('new-sheet-id')))
        .mockResolvedValueOnce(okResponse({ updatedCells: 13 }))

      await ensureShelfGoblinSpreadsheet()

      const [writeUrl, writeOptions] = mockFetch.mock.calls[1] as [string, RequestInit]
      expect(writeUrl).toContain('new-sheet-id')
      expect(writeUrl).toContain('BookShelf')
      expect(writeUrl).toContain('valueInputOption=RAW')
      const writeBody = JSON.parse(writeOptions.body as string) as { values: string[][] }
      expect(writeBody.values[0]).toEqual(BOOKSHELF_HEADERS)
    })

    it('stores the new spreadsheet ID in appDataFolder metadata', async () => {
      mockFetch
        .mockResolvedValueOnce(okResponse(spreadsheetResponse('new-sheet-id')))
        .mockResolvedValueOnce(okResponse({ updatedCells: 13 }))

      await ensureShelfGoblinSpreadsheet()

      expect(mockCreateMetadataFile).toHaveBeenCalledWith({ spreadsheetId: 'new-sheet-id' })
    })

    it('returns the new spreadsheet ID', async () => {
      mockFetch
        .mockResolvedValueOnce(okResponse(spreadsheetResponse('new-sheet-id')))
        .mockResolvedValueOnce(okResponse({ updatedCells: 13 }))

      const result = await ensureShelfGoblinSpreadsheet()

      expect(result).toEqual({ spreadsheetId: 'new-sheet-id' })
    })

    it('throws when spreadsheet creation fails without creating metadata', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(500, 'Server Error'))

      await expect(ensureShelfGoblinSpreadsheet()).rejects.toThrow('Google Sheets error 500')
      expect(mockCreateMetadataFile).not.toHaveBeenCalled()
    })
  })

  describe('existing spreadsheet with BookShelf and headers', () => {
    beforeEach(() => {
      mockFindMetadataFile.mockResolvedValue({ id: 'meta-file-id', name: 'Shelf Goblin Metadata.json' })
      mockReadMetadataFile.mockResolvedValue({ spreadsheetId: 'existing-sheet-id' })
    })

    it('does not create a new spreadsheet', async () => {
      mockFetch
        .mockResolvedValueOnce(okResponse(spreadsheetResponse('existing-sheet-id')))
        .mockResolvedValueOnce(okResponse({ values: [['ISBN']] }))

      await ensureShelfGoblinSpreadsheet()

      const postCalls = mockFetch.mock.calls.filter(([, opts]) => {
        const options = opts as RequestInit
        return options.method === 'POST'
      })
      expect(postCalls).toHaveLength(0)
    })

    it('reuses the existing BookShelf worksheet and does not write headers', async () => {
      mockFetch
        .mockResolvedValueOnce(okResponse(spreadsheetResponse('existing-sheet-id')))
        .mockResolvedValueOnce(okResponse({ values: [['ISBN']] }))

      await ensureShelfGoblinSpreadsheet()

      const putCalls = mockFetch.mock.calls.filter(([, opts]) => {
        const options = opts as RequestInit
        return options.method === 'PUT'
      })
      expect(putCalls).toHaveLength(0)
    })

    it('returns the existing spreadsheet ID', async () => {
      mockFetch
        .mockResolvedValueOnce(okResponse(spreadsheetResponse('existing-sheet-id')))
        .mockResolvedValueOnce(okResponse({ values: [['ISBN']] }))

      const result = await ensureShelfGoblinSpreadsheet()

      expect(result).toEqual({ spreadsheetId: 'existing-sheet-id' })
    })

    it('does not create new metadata when the spreadsheet already exists', async () => {
      mockFetch
        .mockResolvedValueOnce(okResponse(spreadsheetResponse('existing-sheet-id')))
        .mockResolvedValueOnce(okResponse({ values: [['ISBN']] }))

      await ensureShelfGoblinSpreadsheet()

      expect(mockCreateMetadataFile).not.toHaveBeenCalled()
    })
  })

  describe('existing spreadsheet, BookShelf present but no headers', () => {
    beforeEach(() => {
      mockFindMetadataFile.mockResolvedValue({ id: 'meta-file-id', name: 'Shelf Goblin Metadata.json' })
      mockReadMetadataFile.mockResolvedValue({ spreadsheetId: 'existing-sheet-id' })
    })

    it('writes the header row when row 1 is empty', async () => {
      mockFetch
        .mockResolvedValueOnce(okResponse(spreadsheetResponse('existing-sheet-id')))
        .mockResolvedValueOnce(okResponse({}))
        .mockResolvedValueOnce(okResponse({ updatedCells: 13 }))

      await ensureShelfGoblinSpreadsheet()

      const putCalls = mockFetch.mock.calls.filter(([, opts]) => {
        const options = opts as RequestInit
        return options.method === 'PUT'
      })
      expect(putCalls).toHaveLength(1)
    })

    it('does not create an additional worksheet', async () => {
      mockFetch
        .mockResolvedValueOnce(okResponse(spreadsheetResponse('existing-sheet-id')))
        .mockResolvedValueOnce(okResponse({}))
        .mockResolvedValueOnce(okResponse({ updatedCells: 13 }))

      await ensureShelfGoblinSpreadsheet()

      const batchUpdateCalls = mockFetch.mock.calls.filter(([url]) =>
        (url as string).includes(':batchUpdate'),
      )
      expect(batchUpdateCalls).toHaveLength(0)
    })
  })

  describe('existing spreadsheet, BookShelf worksheet missing', () => {
    beforeEach(() => {
      mockFindMetadataFile.mockResolvedValue({ id: 'meta-file-id', name: 'Shelf Goblin Metadata.json' })
      mockReadMetadataFile.mockResolvedValue({ spreadsheetId: 'existing-sheet-id' })
    })

    it('creates the BookShelf worksheet when it is absent', async () => {
      mockFetch
        .mockResolvedValueOnce(okResponse(spreadsheetResponse('existing-sheet-id', ['Settings'])))
        .mockResolvedValueOnce(okResponse({ replies: [{}] }))
        .mockResolvedValueOnce(okResponse({ updatedCells: 13 }))

      await ensureShelfGoblinSpreadsheet()

      const batchUpdateCalls = mockFetch.mock.calls.filter(([url]) =>
        (url as string).includes(':batchUpdate'),
      )
      expect(batchUpdateCalls).toHaveLength(1)

      const [, batchOptions] = batchUpdateCalls[0] as [string, RequestInit]
      const body = JSON.parse(batchOptions.body as string) as {
        requests: Array<{ addSheet: { properties: { title: string } } }>
      }
      expect(body.requests[0].addSheet.properties.title).toBe(BOOKSHELF_SHEET_NAME)
    })

    it('writes headers after creating the BookShelf worksheet', async () => {
      mockFetch
        .mockResolvedValueOnce(okResponse(spreadsheetResponse('existing-sheet-id', ['Settings'])))
        .mockResolvedValueOnce(okResponse({ replies: [{}] }))
        .mockResolvedValueOnce(okResponse({ updatedCells: 13 }))

      await ensureShelfGoblinSpreadsheet()

      const putCalls = mockFetch.mock.calls.filter(([, opts]) => {
        const options = opts as RequestInit
        return options.method === 'PUT'
      })
      expect(putCalls).toHaveLength(1)
    })
  })

  describe('idempotency', () => {
    it('does not create duplicate spreadsheets on repeated calls', async () => {
      mockFindMetadataFile
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'meta-file-id', name: 'Shelf Goblin Metadata.json' })
      mockReadMetadataFile.mockResolvedValue({ spreadsheetId: 'sheet-id' })

      mockFetch
        .mockResolvedValueOnce(okResponse(spreadsheetResponse('sheet-id')))
        .mockResolvedValueOnce(okResponse({ updatedCells: 13 }))
        .mockResolvedValueOnce(okResponse(spreadsheetResponse('sheet-id')))
        .mockResolvedValueOnce(okResponse({ values: [['ISBN']] }))

      await ensureShelfGoblinSpreadsheet()
      await ensureShelfGoblinSpreadsheet()

      expect(mockCreateMetadataFile).toHaveBeenCalledTimes(1)
    })

    it('does not duplicate the header row on repeated calls', async () => {
      mockFindMetadataFile
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'meta-file-id', name: 'Shelf Goblin Metadata.json' })
      mockReadMetadataFile.mockResolvedValue({ spreadsheetId: 'sheet-id' })

      mockFetch
        .mockResolvedValueOnce(okResponse(spreadsheetResponse('sheet-id')))
        .mockResolvedValueOnce(okResponse({ updatedCells: 13 }))
        .mockResolvedValueOnce(okResponse(spreadsheetResponse('sheet-id')))
        .mockResolvedValueOnce(okResponse({ values: [['ISBN']] }))

      await ensureShelfGoblinSpreadsheet()
      await ensureShelfGoblinSpreadsheet()

      const putCalls = mockFetch.mock.calls.filter(([, opts]) => {
        const options = opts as RequestInit
        return options.method === 'PUT'
      })
      expect(putCalls).toHaveLength(1)
    })
  })

  describe('error handling', () => {
    it('throws when the user is not authenticated', async () => {
      mockGetAccessToken.mockRejectedValue(
        new Error('Sign in with Google before accessing your spreadsheet.'),
      )
      mockFindMetadataFile.mockResolvedValue(null)
      mockFetch.mockResolvedValue(errorResponse(401, 'Unauthorized'))

      await expect(ensureShelfGoblinSpreadsheet()).rejects.toThrow('Sign in with Google')
    })

    it('throws and does not create metadata when the Sheets API fails during creation', async () => {
      mockFindMetadataFile.mockResolvedValue(null)
      mockFetch.mockResolvedValue(errorResponse(500, 'Internal Server Error'))

      await expect(ensureShelfGoblinSpreadsheet()).rejects.toThrow('Google Sheets error 500')
      expect(mockCreateMetadataFile).not.toHaveBeenCalled()
    })

    it('throws SpreadsheetNotFoundError when the stored spreadsheet returns 404', async () => {
      mockFindMetadataFile.mockResolvedValue({ id: 'meta-file-id', name: 'Shelf Goblin Metadata.json' })
      mockReadMetadataFile.mockResolvedValue({ spreadsheetId: 'gone-sheet-id' })
      mockFetch.mockResolvedValue(errorResponse(404, 'Not Found'))

      const error = await ensureShelfGoblinSpreadsheet().catch((e: unknown) => e)
      expect(error).toBeInstanceOf(SpreadsheetNotFoundError)
      expect((error as SpreadsheetNotFoundError).metadataFileId).toBe('meta-file-id')
    })

    it('does not create a replacement spreadsheet when the stored one is inaccessible', async () => {
      mockFindMetadataFile.mockResolvedValue({ id: 'meta-file-id', name: 'Shelf Goblin Metadata.json' })
      mockReadMetadataFile.mockResolvedValue({ spreadsheetId: 'bad-sheet-id' })
      mockFetch.mockResolvedValue(errorResponse(403, 'Forbidden'))

      await expect(ensureShelfGoblinSpreadsheet()).rejects.toThrow()
      expect(mockCreateMetadataFile).not.toHaveBeenCalled()
    })

    it('throws when metadata cannot be read', async () => {
      mockFindMetadataFile.mockResolvedValue({ id: 'meta-file-id', name: 'Shelf Goblin Metadata.json' })
      mockReadMetadataFile.mockRejectedValue(new Error('Google Drive error 500: Server Error'))

      await expect(ensureShelfGoblinSpreadsheet()).rejects.toThrow('Google Drive error 500')
    })

    it('surfaces a non-404 Sheets API error without offering recovery', async () => {
      mockFindMetadataFile.mockResolvedValue({ id: 'meta-file-id', name: 'Shelf Goblin Metadata.json' })
      mockReadMetadataFile.mockResolvedValue({ spreadsheetId: 'sheet-id' })
      mockFetch.mockResolvedValue(errorResponse(403, 'Forbidden'))

      const error = await ensureShelfGoblinSpreadsheet().catch((e: unknown) => e)
      expect(error).not.toBeInstanceOf(SpreadsheetNotFoundError)
      expect(error).toBeInstanceOf(Error)
    })
  })
})

describe('recreateShelfGoblinSpreadsheet', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)
    mockGetAccessToken.mockResolvedValue('test-token')
    mockUpdateMetadataFile.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('creates a new spreadsheet', async () => {
    mockFetch
      .mockResolvedValueOnce(okResponse(spreadsheetResponse('new-sheet-id')))
      .mockResolvedValueOnce(okResponse({ updatedCells: 13 }))

    await recreateShelfGoblinSpreadsheet('meta-file-id')

    const [createUrl, createOptions] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(createUrl).toContain('sheets.googleapis.com/v4/spreadsheets')
    expect(createOptions.method).toBe('POST')
  })

  it('writes the header row to the new spreadsheet', async () => {
    mockFetch
      .mockResolvedValueOnce(okResponse(spreadsheetResponse('new-sheet-id')))
      .mockResolvedValueOnce(okResponse({ updatedCells: 13 }))

    await recreateShelfGoblinSpreadsheet('meta-file-id')

    const putCalls = mockFetch.mock.calls.filter(([, opts]) => {
      const options = opts as RequestInit
      return options.method === 'PUT'
    })
    expect(putCalls).toHaveLength(1)
  })

  it('updates the existing metadata file with the new spreadsheet ID', async () => {
    mockFetch
      .mockResolvedValueOnce(okResponse(spreadsheetResponse('new-sheet-id')))
      .mockResolvedValueOnce(okResponse({ updatedCells: 13 }))

    await recreateShelfGoblinSpreadsheet('meta-file-id')

    expect(mockUpdateMetadataFile).toHaveBeenCalledWith('meta-file-id', {
      spreadsheetId: 'new-sheet-id',
    })
  })

  it('does not create a second metadata file', async () => {
    mockFetch
      .mockResolvedValueOnce(okResponse(spreadsheetResponse('new-sheet-id')))
      .mockResolvedValueOnce(okResponse({ updatedCells: 13 }))

    await recreateShelfGoblinSpreadsheet('meta-file-id')

    expect(mockCreateMetadataFile).not.toHaveBeenCalled()
  })

  it('returns the new spreadsheet ID', async () => {
    mockFetch
      .mockResolvedValueOnce(okResponse(spreadsheetResponse('new-sheet-id')))
      .mockResolvedValueOnce(okResponse({ updatedCells: 13 }))

    const result = await recreateShelfGoblinSpreadsheet('meta-file-id')

    expect(result).toEqual({ spreadsheetId: 'new-sheet-id' })
  })

  it('throws when spreadsheet creation fails', async () => {
    mockFetch.mockResolvedValue(errorResponse(500, 'Internal Server Error'))

    await expect(recreateShelfGoblinSpreadsheet('meta-file-id')).rejects.toThrow(
      'Google Sheets error 500',
    )
    expect(mockUpdateMetadataFile).not.toHaveBeenCalled()
  })
})
