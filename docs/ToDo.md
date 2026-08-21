# ToDo
1. [x] Create the Vue project
2. [x] Get ISBN book information working
3. [x] Setup Google Cloud
  * Create a Google Cloud project specifically for the application.
  * [x] Enable Book API
  * [x] Enable Sheets API
  * [x] Configure OAuth
4. [x] Define the data model
  * Define the Book record stored in the BookShelf tab.
  * One row represents one physical book/edition.
  * ISBN is optional.
  * The BookShelf tab is intentionally human-readable and should be usable directly by the user without Shelf Goblin.
5. [x] Define a small Book Details component (BookDetails.vue)
  * Retrieve Google Books response, convert to Shelf Goblin data model
  * Display via BookDetails.vue from Data model
6. [x] Implement Sign in with Google
  * The first usable screen should simply be:
    ```
    Shelf Goblin

    Track your books and reading progress.

    [ Sign in with Google ]
    ```
  * The user authorizes the application.
  * Importantly, we're not creating an account system for the app. Google is effectively providing the identity.
7. [x] Create the user's spreadsheet
  * Google's Sheets API supports creating a spreadsheet directly and returns its spreadsheetId and URL.
    * BookShelf
      * The canonical collection data.
      * One row per physical book/edition.
    * Additional tabs may be added later for things such as:
      * Series
      * Statistics
      * Settings
      * Wishlist
  * The spreadsheet itself remains in the user's Google account.
8. [ ] Build the confirmation screen
  * Don't immediately write the result to the spreadsheet.
  * After scanning/looking up:
    ```
    ┌──────────────────────────────┐
    │                              │
    │       [cover image]          │
    │                              │
    │ One Piece, Vol. 42           │
    │                              │
    │ Series: One Piece            │
    │ Volume: 42                   │
    │ Publisher: VIZ Media         │
    │ ISBN: 978142...              │
    │                              │
    │ [ Edit ]      [ Add ]        │
    └──────────────────────────────┘
    ```
  * This is particularly important for manga because metadata can be imperfect.
    * You should be able to correct:
      * Title
      * Series
      * Volume
      * Authors
      * Publisher
      * Published
      * ISBN (optional)
    * before saving it.
9. [ ] Add the phone camera scanner
  * Once the ISBN lookup works, add the camera.
  * Make the scanner automatically restart after adding a book.
    * That way you can sit in front of a shelf and go:
      > scan → confirm → scan → confirm → scan → confirm
    * rather than navigating through the app every time.
10. [ ] Build the collection interface
  * add the actual collection view.
    ```
    My Collection

    Search: [________________]

    Series             Owned    Read
    ────────────────────────────────
    One Piece           42/110   35
    Death Note          12/12    12
    Initial D            8/12     5
    Spy × Family         9/14     7
    ```
  * Clicking a series could show its individual volumes.
    * And then have:
      * 📷 Scan
      * as the prominent action.
11. [ ] Before go live
  * Set Privacy Policy URL in google oauth consent config
  * Set Support URL in google oauth consent config
12. [ ] Add fun stuff
  * Read/unread tracking
  * Duplicate detection
  * Wishlist
  * Ratings
  * Notes
  * Cover gallery
  * Statistics
