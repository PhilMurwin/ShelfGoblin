# Shelf Goblin Architecture

## Overview

Shelf Goblin is a Vue 3 + Vite + TypeScript web application for
cataloging and tracking physical books.

The application is designed primarily for manga and graphic novels,
but should support any physical book, including novels, reference
books, video game strategy guides, etc.

The user's Google Sheet is the application's persistence layer.

## Core Principles

### Google Sheets is the user's data

Shelf Goblin does not maintain a separate application database.

The user's collection is stored in their own Google Drive as a
Google Sheet created by Shelf Goblin.

Shelf Goblin will store the user's collection in a visible Google 
Spreadsheet. The spreadsheet ID will be persisted in Google's 
application-specific Drive appDataFolder so the application can 
rediscover the user's spreadsheet across browsers/devices without 
requiring broad Drive access. The BookShelf worksheet remains 
human-readable and manually editable.

The primary worksheet is named `BookShelf`.

The BookShelf worksheet is intentionally human-readable and should
remain useful if the user opens and edits it directly in Google Sheets.

### BookShelf is the source of truth

Each row in BookShelf represents one physical book/edition.

Additional worksheets may be introduced later for derived information,
statistics, settings, or other features, but the application should
remain fundamentally usable from BookShelf alone.

### External metadata vs. user data

Google Books is an external metadata source, not the application's
source of truth.

When a book is added:

    ISBN
      ↓
    Google Books
      ↓
    BookDraft
      ↓
    User review/edit
      ↓
    BookShelf

Once saved, the BookShelf record is used for normal application
display and operation.

Shelf Goblin should not query Google Books again simply to display
an existing book.

### Metadata refresh

Google Books may be queried again only when:

- adding a new book, or
- the user explicitly requests a metadata refresh.

Refreshing metadata should not silently overwrite user corrections.
The user should be able to review changes before applying them.

### ISBN

ISBN is a useful lookup mechanism but is not required for a BookShelf
record.

Users must be able to add books for which an ISBN is unknown.

Shelf Goblin should never invent a fake ISBN.

### Book model

The application uses a simple Book model corresponding closely to
a BookShelf row rather than a normalized relational database model.

Volume is stored as text because values may include things such as:

- `1`
- `1-2`
- `10.5`

Format is not tracked as a separate field. Edition/format information
can remain part of the title when appropriate.

### Google Books data

Google Books metadata may include information that is useful to the
UI but does not need to be persisted.

Cover URLs are persisted in BookShelf so existing collection records
can display their covers without additional Google Books API calls.

Descriptions are persisted in BookShelf so existing collection records
can display their stored metadata without additional Google Books API calls.

## Google Integration

Google authentication will use the user's own Google account.

Shelf Goblin does not maintain a separate application account system.

The user's Google account provides identity and authorization to access
the user's spreadsheet.

Google-related functionality should be isolated behind services rather
than coupled directly to Vue components.

Services:

- Google Books
- Google Authentication
- Google Drive (appdata only)
- Google Sheets

### OAuth scopes

Shelf Goblin requests the minimum scopes required:

| Scope | Purpose |
|---|---|
| `https://www.googleapis.com/auth/drive.file` | Read/write the spreadsheet Shelf Goblin creates — no access to the user's other files |
| `https://www.googleapis.com/auth/drive.appdata` | Store the spreadsheet ID in the hidden appDataFolder |

`drive.file` is used instead of the broader `spreadsheets` scope because it
restricts access to only files the app created. The Google Sheets API accepts
`drive.file` for spreadsheets the app owns, so no broader permission is needed.

Broad Drive scopes (`drive`, `drive.readonly`, `drive.metadata`, etc.)
and the `spreadsheets` scope are intentionally not requested.

### Hidden application metadata

Shelf Goblin stores a small JSON metadata file in Google's hidden
`appDataFolder`. This file is invisible to the user in Google Drive and
is private to this application.

Current metadata structure:

```json
{
  "spreadsheetId": "..."
}
```

Filename: `Shelf Goblin Metadata.json`

This allows Shelf Goblin to locate the user's spreadsheet across
browsers and devices without storing the spreadsheet ID only in
localStorage or requiring broad Drive access.

The spreadsheet ID is stored in metadata so Shelf Goblin can locate the
user's spreadsheet across browsers and devices. `ensureShelfGoblinSpreadsheet()`
in `src/services/googleSheets.ts` handles finding or creating the spreadsheet
and ensuring the BookShelf worksheet with its header row exists. Writing individual
book records to the spreadsheet is handled in a subsequent milestone.

## Data Ownership

The user owns and controls their collection data because it resides
in their own Google Drive.

Shelf Goblin should avoid making the user's data dependent on an
application-specific backend whenever possible.
