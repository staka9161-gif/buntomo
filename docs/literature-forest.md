# Reading Forest

User-facing names are "読書の森", "読書マップ" and "読書年表"; the feature covers
all book genres, not only literature. Internal route, schema and catalog IDs
retain the original literature-forest names for compatibility.

## Source of Truth

- Book identity: existing `Book.id`, not Work/Edition identity.
- Personal total and partial progress: `ReadingStatus.totalPages` and `currentPage`.
- Completion: existing `ReadingStatus.status === "COMPLETED"`.
- A completed tree uses the personal total, never partial pages plus the total.
- Reverting completion uses the preserved currentPage. Total edits recalculate growth.
- A completed record with no personal total remains pending, not an invented zero.
- `book: null` legacy records are skipped, matching the existing reading list policy.

## Persistence and Authorization

`LiteratureTree` stores only the owner's per-book classification. Its unique key
is `(userId, bookId)`. Book, User and ReadingStatus fields are not duplicated.
Old completed books appear by joining existing reading records at read time;
there is no backfill write, completion hook, or forced classification step.

All forest GET routes require authentication and are private/no-store. Writes
reuse requireActiveUser and derive the owner exclusively from the session.
The classification validator checks scope, region, era, main genre and every
subgenre against the supplied catalog. Official subgenres have no numeric cap.
Free tags are separate (30 tags, 50 characters each).

`ForestPageOperation` makes page operations idempotent by `(userId, operationId)`.
The operation record and atomic currentPage increment are in one Serializable
transaction, retried on P2034/P2002. A retried operation cannot target a different
reading or delta. Completed books and page bounds are checked in that transaction.
The operation ledger must not be purged without defining an idempotency horizon.
Page-count PATCH uses a compare-and-swap condition on the owner's current page,
total and status. A stale edit returns 409 rather than overwriting a concurrent
tap or another tab's total. Completion/date-only edits retain their existing path.
Removal, reviews and search behavior is unchanged.

The UI allows one in-flight tap, updates optimistically, and retains an uncertain
operation ID for explicit retry. Session storage is optional recovery for that
single pending operation, not a second source of progress or an offline queue.
Errors are not shown as successful saves. Returning focus reloads server progress.
Private reading/map state is keyed by session user and book/scope. Account
changes remount that state; 401/403/404 responses discard unavailable content.
Read requests are cancelled on unmount and superseded by newer requests/writes.
Selecting the same Japan/world scope is a no-op, preserving the chosen region.
Reading mode returns to the configured scope's map, defaulting to world.

The global history controls use Navigation API availability when supported.
Otherwise they track only their own public history-state key, preserving router
state. Known forward entries, fragment links, branching and refresh recovery are
tracked without assuming that history length implies a forward destination.

## Routes and Data

Era values accept a signed year string (-9999..-1, 1..9999; no year zero).
The existing String field stores the exact year; no schema change is needed.
Legacy five-period IDs are still readable/editable without inventing a year.
The same five foliage colors are derived using display-only period boundaries:
Japan 1185 / 1603 / 1868 / 1945; world 500 / 1500 / 1800 / 1945.
These are approximate display groups, not universal historical classifications.
Each main genre has a distinct crown and sprout leaf silhouette; size/progress
is independent. The classification form previews the mature silhouette/color
without adding pages or changing the actual growth stage.

- `/books/[id]/read`: first setup, reading mode, completed tree, classification edits.
- `/mypage/forest/japan`, `/world`, `/unplaced`: private maps and unplaced trees.
- Each forest places the map and selected book details above a full-width
  chronological timeline with vertical book strips. There are no view tabs;
  old `?view=...` links still open the same combined page. Filters and selection
  are shared by the map and timeline. Compact mobile tracks (minimum 36px)
  fit approximately 8-10 slots per row, including era separators. Full titles
  remain accessible and visible in the selected book's detail panel. Strips are
  380px tall with 248px title/author columns; long visual titles are shortened
  to 18 Unicode characters, without shortening their accessible names or details.
  Timeline intervals are equal per work, not proportional to elapsed years.
  Missing exact years (including legacy periods) are explicitly grouped last.
  User-selected years are not presented as verified publication dates.
  Overview map markers render the actual trees with region counts; region zoom
  renders individual selectable trees. Map geometry and HTML markers share the
  same aspect-ratio plane, including mobile letterboxing.
- Completed books link directly to `/books/[id]/read?settings=1` using the label
  "地域・年代・ジャンル設定". Reading progress and classification APIs are unchanged.
- `/api/me/literature-forest`: own reading/completed trees.
- `/api/me/literature-forest/[bookId]`: own tree GET/classification PATCH.
- `/api/me/literature-forest/[bookId]/progress`: idempotent +/-1 POST.
- Existing PATCH `/api/me/readings/[id]` remains the page-count editor.

Genre catalog is the user-supplied v1 master (20 main genres / 592 subgenres).
Stable IDs are stored; labels and aliases are resolved from the independent JSON.
For catalog revisions, retain existing IDs or explicitly migrate retired IDs.

Maps use Natural Earth v5.1.2 public-domain boundaries: 47 Japanese prefectures
and 237 country/territory codes. `public/forest/ATTRIBUTION.md` records sources.
`node scripts/prepare-forest-maps.mjs` regenerates display data (network required).
Positions are deterministic within a region's largest land polygon, using the
book ID, not actual book/author coordinates. Overview counts cluster trees;
region selection shows individual trees. Keyboard controls and select menus
provide alternatives for small regions. Motion respects reduced-motion settings.

## Migration Safety

`20261028000000_add_literature_forest` creates the two new tables, indexes and
foreign keys only. It does not UPDATE, INSERT, DELETE or DROP existing records.
No migration is applied automatically by any forest page or preview command.
Apply it only to an explicitly approved database before deploying the new code.

## Local Verification

```powershell
npx.cmd prisma validate
npx.cmd prisma generate
npx.cmd tsc --noEmit
npx.cmd vitest run
node scripts/forest-preview.mjs --build
node scripts/forest-preview.mjs --production
```

The last command serves `http://127.0.0.1:3128/books/forest-demo/read`.
Add `--atlas` for additional fictional map/timeline/strip test books. These are
explicitly local fixtures, not imported real user or production reading records.
This is an isolated UI preview with in-memory fixtures, not a database-backed
login or persistence test. It overrides all DB URLs to an unused localhost port,
strips cookies/authorization from upstream requests and binds only to loopback.
Do not deploy the fixture proxy. Restarting it resets all test progress.

Unit tests mock Prisma for authorization, derivation, validation, transactional
retry and idempotency. They assert the Serializable option but do not substitute
for a real PostgreSQL concurrency test. Before release, apply the migration in an
approved disposable database and test two simultaneous sessions, completion
versus tap, restart persistence, total edits, rollback and owner isolation there.
Production data must not be used for that verification.
