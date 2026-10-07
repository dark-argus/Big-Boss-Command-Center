# Big Boss Command Center

The Tech House is in chaos. This single-page dashboard lets Big Boss manage contestants, scores, tasks, captaincy, nominations, immunity, announcements, a countdown timer and evictions from one place. Every change updates the whole dashboard immediately.


The dashboard uses a neo-brutalist style. Dark mode is the default; the **Dark mode** switch in the header changes to light mode and remembers the choice.


## Technology

| Layer | Technology |
| --- | --- |
| Markup | Semantic HTML (`index.html`) with a native `<dialog>` for eviction confirmation |
| Styling | Plain CSS (`styles.css`): custom properties, Grid, Flexbox, media queries |
| Logic | Modern JavaScript ES modules, native DOM APIs |
| Persistence | Browser `localStorage` (JSON) |

No dependencies, frameworks, CDNs, build step, backend or package install.

## Running locally

Prerequisites: a modern browser and Python 3 (or any other static file server).

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open <http://127.0.0.1:8000> and stop the server with Ctrl+C. The page loads ES modules, so serve it over HTTP. Opening `index.html` via `file://` is not supported.

Verified with Python 3.14.7 and Chromium on Linux. Firefox, Safari and Edge were not tested.

## Project structure

```text
index.html          Dashboard markup and stable section containers
styles.css          Neo-brutalist theme (dark default, light option) and responsive layout
src/domain.js       Pure house rules: seed data, validation, actions, selectors, timer maths
src/storage.js      Load/validate/save/recover the versioned localStorage state
src/main.js         Rendering, event delegation, timer ticker, eviction dialog, theme switch
assets/             Screenshots of the running app
docs/AGENT_BRIEF.md The full implementation brief this app was built against
```

## Feature checklist

| # | Feature | Status |
| --- | --- | --- |
| 1 | Contestant management: 8 seeded contestants with name, team, points and status; Add Contestant form; captain/immune/nominated badges; evicted history | Implemented |
| 2 | Live leaderboard: active contestants only, ranked by points, ties by name then ID, top three highlighted | Implemented |
| 3 | Task management: create with title, active assignee and reward; mark complete; reward awarded exactly once | Implemented |
| 4 | Point system: Add Points / Deduct Points with whole-number validation (1–10,000); negative totals allowed | Implemented |
| 5 | Captaincy: one House Captain at a time, shown in header, stats and card | Implemented |
| 6 | Nominations: nominate / remove nomination; no duplicates | Implemented |
| 7 | Immunity: grant/revoke; granting clears nomination; immune contestants cannot be nominated (UI and domain) | Implemented |
| 8 | Danger Zone: every active nominee with team and points; "No contestants nominated" when empty | Implemented |
| 9 | Big Boss announcements: broadcast with local timestamp, dismiss, rendered as plain text | Implemented |
| 10 | Task timer: configurable (default 5:00), Start/Pause/Resume/Reset, MM:SS, "Time's up!", survives refresh | Implemented |
| 11 | House statistics: active count, highest scorer, completed tasks, nominees, immune count, captain | Implemented |
| 12 | Eviction: confirmation dialog naming the contestant; removed from active views; history kept | Implemented |

## Core rules

- **Immunity** blocks nomination. Granting immunity removes an existing nomination in the same update. Revoking immunity never nominates anyone automatically. Immunity does not block eviction.
- **Captaincy:** there is at most one captain (`captainId`). Assigning a new captain replaces the old one. Captaincy does not grant immunity.
- **Task rewards** are awarded only when a pending task is completed, together with the status change. Completed and cancelled tasks cannot award points again.
- **Negative scores** are allowed after deductions and rank correctly.
- **Eviction** marks the contestant as `evicted` rather than deleting them, all in one update. It clears nomination, immunity and captaincy, and cancels their pending tasks. Points and completed tasks are kept and shown in the Evicted Contestants table. Every management action rejects evicted contestants.
- **Timer:** a running timer stores a finish timestamp (`endsAt`), and the remaining time is derived from the clock. The display interval only triggers a redraw. Repeated Start clicks never create a second interval. Duration can only be changed in the Ready state (after Reset). Expiry does not complete tasks or change scores.

## Persistence and recovery

- House state is saved as one JSON value under `big-boss-command-center:v1` after every successful action, including timer start, pause, reset and expiry. Display ticks are not saved.
- On load, saved data is checked for shape, IDs, references, ranges and invariants. If it is malformed or from an unsupported version, the app restores demo data and shows *"Saved house data could not be loaded. Demo data has been restored."* The unreadable value is kept once under `big-boss-command-center:recovery`.
- If storage can't be written, the app keeps working in memory and shows *"Changes are available in this session but could not be saved."*
- The theme preference is stored separately under `big-boss-command-center:theme`.
- The app never calls `localStorage.clear()`.

## Checks performed

All checks were run in Chromium against the local server, through the real dashboard controls:

- Acceptance matrix: C01–C03, P01–P04, H01, N01, I01–I03, T01–T03, A01–A03, R01–R06, E01–E03, S01–S03 and U01. This covers duplicate-completion and immune-nomination attempts sent directly to the domain functions, a malformed-JSON recovery, a simulated storage write failure, and refreshes while the timer was running, paused and expired.
- Every button type was clicked (theme switch, Add Contestant, Add/Deduct Points, Make Captain, Nominate, Remove Nomination from the card and the Danger Zone, Grant/Revoke Immunity, Assign Task, Mark Complete, Broadcast, Dismiss, timer Start/Pause/Resume/Reset, Evict from the card and Danger Zone with Cancel, Escape and Confirm, and storage-notice Dismiss), and each produced the expected state change.
- Every button's text contrast was measured in both themes. All meet WCAG AA (lowest ratio 5.31:1).
- No horizontal overflow at 360px, 768px or 1280px widths.
- No console errors during the workflows.

There is no automated test suite. Node.js was not available in the build environment, so domain checks were run in the browser instead.

## Known limitations

- State lives in one browser profile and origin. Another browser, device or port starts with fresh demo data. One open tab is the supported editing session.
- There is no authentication. Anyone using the browser can edit or clear local data, so scores are not tamper-proof.
- The timer follows the system clock, so changing the clock affects a running countdown.

## Submission

Submit the GitHub repository URL on the Round 01 challenge page. The repository URL will be added here once the code is pushed.
