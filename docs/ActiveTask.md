We are ready to begin the next development step for Shelf Goblin.

First, read and understand the documentation in the docs/ folder:

- docs/Architecture.md
- docs/BookDataModel.txt
- docs/Milestones.md
- docs/Todo.md
- docs/project_structure.txt

Treat Architecture.md as the source of truth for architectural decisions and the other documents as the current project plan/model/structure.

Then inspect the existing source code before making changes.

## Current state

Shelf Goblin is a Vue 3 + Vite + TypeScript application.

Milestone 1 is complete:
- The user can manually enter an ISBN.
- The application calls the Google Books API.
- The API key is provided through VITE_GOOGLE_BOOKS_API_KEY in .env.local.
- Book information is successfully retrieved and displayed.
- We have tested real manga ISBNs successfully.

Do not implement Google authentication, Google Sheets, or barcode scanning yet.

## Goal for this task

Refactor the current prototype so that Google Books metadata is cleanly separated from the Shelf Goblin Book model.

The desired flow is:

Google Books API
    ↓
Google Books metadata
    ↓
BookDraft
    ↓
BookDetails.vue
    ↓
User reviews/edits
    ↓
Book

The Book model should correspond closely to one row in the BookShelf worksheet.

The current BookShelf fields are:

- ISBN
- Title
- Series
- Volume
- Author(s)
- Publisher
- Published
- Cover URL
- Read
- Date Read
- Rating
- Notes

Important rules:

- ISBN is optional.
- Title is required.
- Volume is a string, not a number.
- Format is NOT a BookShelf field.
- Edition is NOT a BookShelf field.
- Cover URL IS persisted.
- Description is NOT currently persisted in BookShelf.
- Google Books is an external metadata source, not the source of truth.
- Once a book is saved, Shelf Goblin should use the stored BookShelf data rather than querying Google Books again.
- Google Books may be queried again only when adding a book or when the user explicitly requests a metadata refresh.
- Do not invent an ISBN when one is unknown.
- The application is for books generally, not just manga.

## Implementation

Create a clean Google Books service rather than keeping the API call in App.vue.

Create an appropriate TypeScript model/type for the Shelf Goblin Book.

Create an appropriate type for the Google Books response/metadata we actually use.

Create BookDetails.vue as the component responsible for displaying/editing the Shelf Goblin Book data.

The existing ISBN lookup should continue to work after the refactor.

Do not implement persistence yet.

Do not implement Google authentication yet.

Do not implement barcode scanning yet.

Do not add unnecessary dependencies.

Follow the project structure described in docs/project_structure.txt. If the current structure conflicts with the documentation, make the smallest reasonable change necessary and explain it.

Keep the UI simple for now. We are establishing the application architecture, not doing visual polish.

## Important

Before finishing:

1. Run the TypeScript/Vite build.
2. Fix any errors introduced by the refactor.
3. Verify the existing ISBN lookup still works.
4. Update docs/Todo.md and docs/Milestones.md only if this task changes their completion status.
5. Do not modify Architecture.md unless you discover that the existing architecture decisions need to change.
6. Summarize the files you changed and briefly explain the new data flow.

Do not make unrelated improvements.