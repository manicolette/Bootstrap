This is a large batch of changes touching the data model, sync layer, PWA setup, and most UI screens. Here's how I'll ship it, grouped so related changes land together.

## 1. Data model changes (foundation for #4, #6, #7, #9)

Extend `src/lib/bootstrap/types.ts`:
- `BootstrapData.displayName?: string`
- `Track.startDate: string | null` (new)
- `Track.groups: TaskGroup[]` — subtasks now live inside groups. Legacy `Track.subtasks` migrated into a default "Ungrouped" group on load.
- `TaskGroup { id, label, startDate, endDate, collapsed?, subtasks: Subtask[] }`
- `Subtask.dueDate?: string | null`
- `Session.groupId?: string | null`

A one-time migration in `useBootstrapData` will move any existing `track.subtasks` into `track.groups[0]` so existing rows keep working. `trackProgress` / `phaseProgress` will sum subtasks across all groups.

## 2. PWA (#1)

- Rewrite `public/manifest.webmanifest` with all required fields (name, short_name, start_url, scope, display: standalone, orientation: portrait, theme_color, background_color, 192 + 512 icons, `purpose: "any maskable"`).
- Add head tags in `src/routes/__root.tsx`: manifest link, theme-color, apple-mobile-web-app-capable, status-bar-style, apple-touch-icon.
- Add a minimal app-shell service worker at `public/sw.js` (network-first for navigations, cache-first for hashed assets) plus a guarded registration wrapper that refuses to register in Lovable preview / dev / iframe / `?sw=off` per the PWA skill.

## 3. Realtime sync (#2)

In `useBootstrapData`, after initial load subscribe via `supabase.channel()` to `postgres_changes` on `user_data` filtered by the configured row id. On UPDATE, merge remote `bootstrap_data` into local state (skipping if it matches what we just saved, to avoid echo loops). Unsubscribe on settings change / unmount.

## 4. Phases: delete (#3)

In `PhaseManagerModal`, replace the current archive-on-delete with a hard delete: confirmation dialog with the exact copy from the request, then remove the phase, its tracks, and all sessions whose `phaseId` matches. Close the modal and return to dashboard.

## 5. Track detail modal rework (#4, #6, #7, #12)

Rewrite the subtasks section as a list of collapsible groups:
- Group header: emoji chevron, editable label, date range (`Jul 1–6`), add/rename/delete controls.
- Subtasks inside each group: checkbox, text, optional due date, delete. Drag-free move between groups via a small "move to…" menu.
- Groups sorted chronologically by `startDate` (nulls last).
- Add `startDate` field to the track's date row alongside `endDate`. New tracks default `startDate` to the active phase's `startDate`.
- Completion flow (#12): before archiving, show a summary screen with track name, total hours, start date, completion date, session count, and an optional final note field. "Archive" confirms; the note is stored on the archived track.

## 6. Dashboard (#5, #8, #10, #13)

Header:
- Greeting: `Welcome back, {displayName} ⚡` (falls back to `Welcome back`).
- Days-remaining countdown (existing) + `🔥 N week streak` badge computed from sessions grouped by ISO week (Mon–Sun); streak = consecutive weeks ending with either this week or last week that each contain ≥1 session.
- Rotating motivational quote (small curated array, index by day-of-year) with a prominent "+ Quick Log" button that opens the Log Session modal.

Track card:
- Show `startDate – endDate`.
- Highlight the currently active group (today ∈ [group.startDate, group.endDate]).
- Overdue indicator on any group whose `endDate < today` and progress < 100%.
- Summary line under the card: `X tasks this week · Yh this week · Z days left`.

## 7. Sessions (#9, #11)

- Log Session modal: after picking a track, show an optional "Week group" select populated from that track's groups.
- Sessions view: each entry expandable to reveal the full note; edit (opens the log modal pre-filled) and delete (with confirm) actions per entry. Weekly totals broken down by group where a `groupId` is set.

## 8. Settings (#5)

Add a "Display Name" text input at the top of Settings that reads/writes `data.displayName` (debounced through the existing update path, so it syncs to Supabase automatically).

## Files touched

- `public/manifest.webmanifest`, `public/sw.js` (new), `src/lib/pwa-register.ts` (new)
- `src/routes/__root.tsx` (head tags + SW registration)
- `src/lib/bootstrap/types.ts`, `src/lib/bootstrap/utils.ts` (migration, progress across groups, streak helper, active-group helper)
- `src/lib/bootstrap/useBootstrapData.ts` (realtime channel, migration on load)
- `src/lib/bootstrap/storage.ts` (expose supabase client for channel)
- `src/components/bootstrap/BootstrapApp.tsx` (dashboard header, quote, quick-log, streak, track card summary, sessions edit/delete/expand, settings display name)
- `src/components/bootstrap/modals.tsx` (track detail groups + dates, log session group tag, phase delete confirm, completion summary)
- `src/components/bootstrap/ui.tsx` (small additions if needed: Collapsible, ConfirmDialog)

## Notes / assumptions

- Realtime requires the `user_data` table to have realtime enabled in Supabase; if it isn't, the subscription silently no-ops and manual save still works. I'll surface a one-time console note, not a user-facing error.
- The service worker registers only in production; Lovable preview stays untouched per the PWA safety rules.
- Existing rows with only `subtasks` (no `groups`) are auto-migrated on read; the migrated shape is what gets saved back on the next edit.
- No schema changes needed — everything still lives in the single `bootstrap_data` jsonb blob.

Approve and I'll implement it in one pass.