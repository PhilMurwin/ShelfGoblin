import { getAccessToken } from './googleAuth'

export const METADATA_FILENAME = 'Shelf Goblin Metadata.json'

const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'

export interface ShelfGoblinMetadata {
  spreadsheetId: string
}

interface DriveFile {
  id: string
  name: string
}

interface DriveFileListResponse {
  files: DriveFile[]
}

async function authorizedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken()
  return fetch(url, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${token}` },
  })
}

export async function findMetadataFile(): Promise<DriveFile | null> {
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    q: `name = '${METADATA_FILENAME}'`,
    fields: 'files(id,name)',
  })

  const response = await authorizedFetch(`${DRIVE_API}/files?${params}`)

  if (!response.ok) {
    throw new Error(`Google Drive error ${response.status}: ${response.statusText}`)
  }

  const data = (await response.json()) as DriveFileListResponse
  return data.files[0] ?? null
}

export async function createMetadataFile(metadata: ShelfGoblinMetadata): Promise<DriveFile> {
  const boundary = 'shelf-goblin-multipart-boundary'
  const fileMeta = JSON.stringify({
    name: METADATA_FILENAME,
    parents: ['appDataFolder'],
    mimeType: 'application/json',
  })
  const fileContent = JSON.stringify(metadata)
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${fileMeta}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${fileContent}\r\n` +
    `--${boundary}--`

  const params = new URLSearchParams({ uploadType: 'multipart', fields: 'id,name' })
  const response = await authorizedFetch(`${DRIVE_UPLOAD_API}/files?${params}`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  })

  if (!response.ok) {
    throw new Error(`Google Drive error ${response.status}: ${response.statusText}`)
  }

  return response.json() as Promise<DriveFile>
}

export async function readMetadataFile(fileId: string): Promise<ShelfGoblinMetadata> {
  const response = await authorizedFetch(`${DRIVE_API}/files/${fileId}?alt=media`)

  if (!response.ok) {
    throw new Error(`Google Drive error ${response.status}: ${response.statusText}`)
  }

  return response.json() as Promise<ShelfGoblinMetadata>
}

export async function updateMetadataFile(
  fileId: string,
  metadata: ShelfGoblinMetadata,
): Promise<void> {
  const params = new URLSearchParams({ uploadType: 'media' })
  const response = await authorizedFetch(`${DRIVE_UPLOAD_API}/files/${fileId}?${params}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metadata),
  })

  if (!response.ok) {
    throw new Error(`Google Drive error ${response.status}: ${response.statusText}`)
  }
}
