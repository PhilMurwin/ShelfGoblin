# Milestones

1. [x] Data
  * Vue app → manually enter ISBN → Google Books → display book.
2. [x] Google
  * Google login → create user's BookShelf spreadsheet → write/read a book record.
  * Spreadsheet name: `Shelf Goblin`; primary worksheet/tab: `BookShelf`
  * [x] Google Sign-In implemented (One Tap + button)
  * [x] `appDataFolder` metadata stores the spreadsheet ID (`Shelf Goblin Metadata.json`)
  * [x] `ensureShelfGoblinSpreadsheet()` — finds or creates the spreadsheet, ensures BookShelf worksheet and header row exist
  * [x] Write/read individual book records
3. [x] Collection
  * [x] Browse/search collection.
  * [x] Edit/delete collection.
4. [ ] Scanner
  * Phone camera → ISBN → book lookup.
5. [ ] Polish
  * Series grouping, read tracking, statistics, missing volumes, etc.
  