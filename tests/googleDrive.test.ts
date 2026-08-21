import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getAccessToken } from '../src/services/googleAuth'
import {
  METADATA_FILENAME,
  createMetadataFile,
  findMetadataFile,
  readMetadataFile,
  updateMetadataFile,
} from '../src/services/googleDrive'

vi.mock('../src/services/googleAuth', () => ({
  getAccessToken: vi.fn(),
}))

const mockGetAccessToken = vi.mocked(getAccessToken)

function mockOkResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve(body),
  }
}

function mockErrorResponse(status: number, statusText: string) {
  return { ok: false, status, statusText, json: () => Promise.resolve({}) }
}

describe('Google Drive service', () => {
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

  describe('findMetadataFile', () => {
    it('queries appDataFolder with the correct authorization header', async () => {
      mockFetch.mockResolvedValue(mockOkResponse({ files: [] }))

      await findMetadataFile()

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect((options.headers as Record<string, string>)['Authorization']).toBe('Bearer test-token')
    })

    it('sets spaces=appDataFolder and queries by metadata filename', async () => {
      mockFetch.mockResolvedValue(mockOkResponse({ files: [] }))

      await findMetadataFile()

      const [url] = mockFetch.mock.calls[0] as [string, RequestInit]
      const parsed = new URL(url)
      expect(parsed.searchParams.get('spaces')).toBe('appDataFolder')
      expect(parsed.searchParams.get('q')).toContain(METADATA_FILENAME)
    })

    it('returns null when no metadata file exists', async () => {
      mockFetch.mockResolvedValue(mockOkResponse({ files: [] }))

      expect(await findMetadataFile()).toBeNull()
    })

    it('returns the file record when the metadata file exists', async () => {
      const file = { id: 'file-abc', name: METADATA_FILENAME }
      mockFetch.mockResolvedValue(mockOkResponse({ files: [file] }))

      expect(await findMetadataFile()).toEqual(file)
    })

    it('throws when the Drive API returns an error', async () => {
      mockFetch.mockResolvedValue(mockErrorResponse(500, 'Internal Server Error'))

      await expect(findMetadataFile()).rejects.toThrow('Google Drive error 500')
    })
  })

  describe('createMetadataFile', () => {
    const metadata = { spreadsheetId: 'sheet-123' }

    it('posts to the multipart upload endpoint with the correct authorization header', async () => {
      mockFetch.mockResolvedValue(mockOkResponse({ id: 'new-id', name: METADATA_FILENAME }))

      await createMetadataFile(metadata)

      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(url).toContain('/upload/drive/v3/files')
      expect(url).toContain('uploadType=multipart')
      expect((options.headers as Record<string, string>)['Authorization']).toBe('Bearer test-token')
    })

    it('sends a multipart/related body containing the filename, appDataFolder parent, and content', async () => {
      mockFetch.mockResolvedValue(mockOkResponse({ id: 'new-id', name: METADATA_FILENAME }))

      await createMetadataFile(metadata)

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect((options.headers as Record<string, string>)['Content-Type']).toContain('multipart/related')
      expect(options.body as string).toContain('appDataFolder')
      expect(options.body as string).toContain(METADATA_FILENAME)
      expect(options.body as string).toContain('"spreadsheetId":"sheet-123"')
    })

    it('returns the created file record', async () => {
      const file = { id: 'new-id', name: METADATA_FILENAME }
      mockFetch.mockResolvedValue(mockOkResponse(file))

      expect(await createMetadataFile(metadata)).toEqual(file)
    })

    it('throws when the Drive API returns an error', async () => {
      mockFetch.mockResolvedValue(mockErrorResponse(403, 'Forbidden'))

      await expect(createMetadataFile(metadata)).rejects.toThrow('Google Drive error 403')
    })
  })

  describe('readMetadataFile', () => {
    it('fetches file content by ID using alt=media with the correct authorization header', async () => {
      mockFetch.mockResolvedValue(mockOkResponse({ spreadsheetId: 'sheet-xyz' }))

      await readMetadataFile('file-456')

      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(url).toContain('/files/file-456')
      expect(url).toContain('alt=media')
      expect((options.headers as Record<string, string>)['Authorization']).toBe('Bearer test-token')
    })

    it('parses and returns the metadata', async () => {
      const metadata = { spreadsheetId: 'sheet-xyz' }
      mockFetch.mockResolvedValue(mockOkResponse(metadata))

      expect(await readMetadataFile('file-456')).toEqual(metadata)
    })

    it('throws when the Drive API returns an error', async () => {
      mockFetch.mockResolvedValue(mockErrorResponse(404, 'Not Found'))

      await expect(readMetadataFile('missing-id')).rejects.toThrow('Google Drive error 404')
    })
  })

  describe('updateMetadataFile', () => {
    const metadata = { spreadsheetId: 'new-sheet-789' }

    it('patches the file content using the media upload endpoint', async () => {
      mockFetch.mockResolvedValue(mockOkResponse({ id: 'file-456' }))

      await updateMetadataFile('file-456', metadata)

      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(url).toContain('/upload/drive/v3/files/file-456')
      expect(url).toContain('uploadType=media')
      expect(options.method).toBe('PATCH')
      expect((options.headers as Record<string, string>)['Authorization']).toBe('Bearer test-token')
    })

    it('sends the updated metadata as JSON', async () => {
      mockFetch.mockResolvedValue(mockOkResponse({ id: 'file-456' }))

      await updateMetadataFile('file-456', metadata)

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(options.body).toBe(JSON.stringify(metadata))
    })

    it('throws when the Drive API returns an error', async () => {
      mockFetch.mockResolvedValue(mockErrorResponse(403, 'Forbidden'))

      await expect(updateMetadataFile('file-456', metadata)).rejects.toThrow('Google Drive error 403')
    })
  })

  describe('403 errors', () => {
    it('surfaces a 403 as an error without retrying', async () => {
      mockFetch.mockResolvedValue(mockErrorResponse(403, 'Forbidden'))

      await expect(findMetadataFile()).rejects.toThrow('Google Drive error 403')
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })
})
