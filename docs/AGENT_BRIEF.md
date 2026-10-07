# Big Boss Command Center — Complete Coding Agent Specification

## Your task

Build a complete, working single-page web application that lets Big Boss manage the Tech House from one dashboard. Implement all 12 mandatory features below. Deliver functional controls, consistent state, responsive styling, and instructions for running the application.

Treat this document as an implementation brief. The features described here are requirements, not claims that the application already implements them.

The challenge has a 45-minute time limit. Each verified feature is worth 100 points, with an additional speed bonus of up to 50 points. Prioritize complete functionality before visual polish or optional features.

This brief specifies the technology, architecture, behavior, visual design, validation, persistence, testing, and delivery requirements. Follow the concrete decisions below for a new project. Preserve an existing project's stack unless it prevents the required functionality. Record material deviations in the delivery notes.

## Contents

1. Scope and technical approach
2. Technology stack and dependencies
3. Setup, running, and browser support
4. Architecture and action lifecycle
5. Mandatory requirements: all 12 features
6. State model and invariants
7. Validation and persistence
8. Dashboard design and accessibility
9. Project structure and code conventions
10. Action contracts and timer transitions
11. Error handling, security, and performance
12. Implementation schedule and verification
13. Repository, hosting, and submission
14. Definition of done

## Scope and technical approach

- Inspect the workspace and follow applicable repository instructions before editing.
- If an application already exists, extend its current stack and conventions.
- For an empty workspace, use HTML, CSS, and JavaScript with no required external dependencies. Keep the application easy to run and review.
- Use one central state object and persist it in browser `localStorage`.
- Update all affected views immediately after every successful action.
- Here, “real time” means immediate updates within the open dashboard. Shared state across users or devices is outside this challenge's scope.
- Do not add authentication, a database, external APIs, or a backend unless the existing project requires them.
- Finish the app, verify the mandatory features, and report the outcome. Do not stop after scaffolding or producing a mockup.

The mandatory competition requirements are the 12 numbered features. Additional choices in this document, including specific seed names, input limits, timer duration, layout, and task cancellation on eviction, are implementation decisions for this app. They are not additional rules stated by the competition.

## Technology stack and dependencies

### Default stack for an empty workspace

| Layer | Technology | Required use |
| --- | --- | --- |
| Document | Semantic HTML | Page structure, forms, buttons, tables, sections, dialogs |
| Styling | Plain CSS | Custom properties, Grid, Flexbox, media queries, restrained transitions |
| Application logic | Modern JavaScript with ES modules | State, action handlers, selectors, validation, rendering |
| Client persistence | Browser `localStorage` with JSON | Store the versioned house state |
| Countdown | `Date.now()`, one `setInterval`, `clearInterval` | Timestamp-based countdown with a lightweight display ticker |
| DOM rendering | Native DOM APIs | Safe text rendering and event delegation |
| IDs | `crypto.randomUUID()` when available | Stable contestant and task IDs; use a collision-checked fallback if unavailable |
| Formatting | `Intl.NumberFormat`, `Intl.DateTimeFormat` | Consistent scores and local broadcast times |
| Local preview | A local static HTTP server | Serve the HTML, CSS, and module files |
| Version control | Git and GitHub | Reviewable repository submission |
| Verification | Browser checks; optional Node built-in tests | Verify interactions and high-risk state transitions |

No frontend framework, UI component library, CSS framework, state library, runtime CDN, paid service, or application server is required for the default implementation. There is no dependency installation or compilation step for the browser application.

Use a system font stack, local CSS, and local or inline SVG icons. Do not require downloaded fonts or remote images for the dashboard to work. Important controls must retain visible text labels even when icons are included.

### Existing-project exception

If the workspace already uses React, Vue, TypeScript, Vite, Tailwind, or another established stack, implement the same requirements within that stack. Use the existing package manager and lockfile. Do not migrate or recreate the project just to match the default stack.

If dependencies are needed by the existing project, use its installed or compatible versions, preserve its lockfile, and document actual versions from the project. Do not invent version numbers or install unrelated packages.

### Technology scope

- No database schema, API endpoints, authentication, WebSockets, or cloud functions are needed in the default project.
- Browser storage is persistence for this single-browser demo; it is not an access-control system or shared database.
- Refresh persistence applies to the same browser profile and origin. Opening another browser or changing host/port does not transfer the saved state.
- One open dashboard tab is the supported editing session. Multi-tab merging and concurrent-user conflict resolution are outside scope.
- A local preview server serves static assets; it does not perform scoring or manage house data.
- Keep the app usable after its initial assets load without external service calls.

## Setup, running, and browser support

### New-project prerequisites

- A modern browser.
- Python 3 for the example static-server command below, or another already available static server.
- Git for repository submission.
- Node.js is optional and needed only if the optional built-in test suite is implemented.

### Local run procedure

From the application repository root:

```sh
python3 --version
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `http://127.0.0.1:8000` in the browser. Stop the server with Ctrl+C. If that port is occupied, choose another port and use its matching URL. The storage origin changes when the port changes, so the alternate URL may show fresh demo data.

If Python is unavailable, use an installed static-server tool or the existing project's development command. Document the exact command actually verified. Do not require installing Python solely to follow the example.

Load the entry module using:

```html
<link rel="stylesheet" href="./styles.css">
<script type="module" src="./src/main.js"></script>
```

Use relative asset URLs and explicit `.js` import extensions. Serve modules over HTTP; do not promise that opening `index.html` through a `file://` URL works. See the [MDN JavaScript modules guide](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules).

### Optional test setup

If Node is already available, a minimal `package.json` can declare `"private": true`, `"type": "module"`, and a test script:

```json
{
  "name": "big-boss-command-center",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/*.test.js"
  }
}
```

After implementing those tests, run `npm test` or `node --test tests/*.test.js`. No npm install is needed for this dependency-free setup. Verify the available Node runtime supports the command before documenting it as tested. If no automated suite is implemented, omit the test script rather than shipping a broken command.

### Browser support and responsive targets

Target modern Chrome, Edge, Firefox, and Safari using standard browser APIs. Check the browsers actually available; disclose untested browsers rather than claiming universal support.

Manually inspect at approximately 360px, 768px, and 1280px viewport widths. Avoid horizontal page overflow. Use feature detection for optional APIs and a readable fallback when an optional enhancement is unavailable.

## Architecture and action lifecycle

### Single source of truth

Keep a single application state object owned by the store. UI modules should not maintain independent copies of contestant scores, captaincy, task status, nominations, or immunity.

Keep form drafts, open dialogs, validation messages, and temporary toasts outside persisted house state. The timer's display interval ID is runtime-only and must never be serialized.

### Update flow

```text
User interaction
  -> read and validate input
  -> validate entity IDs and business rules
  -> compute the next state
  -> validate state invariants
  -> commit the state once
  -> attempt persistence
  -> update affected dashboard sections
  -> show concise feedback
```

Failed validation must leave house state unchanged. A storage failure must not undo an otherwise successful in-memory action; display the persistence limitation clearly.

Use explicit action handlers or a small reducer. Avoid scattering business rules among click handlers and rendering functions. Keep domain functions independent of the DOM so they can be tested with plain state objects.

### Selectors

Implement reusable functions equivalent to:

```text
getActiveContestants(state)
getEvictedContestants(state)
getLeaderboard(state)
getDangerZone(state)
getCaptain(state)
getHouseStatistics(state)
getTaskAssignees(state)
getRemainingSeconds(timer, now)
```

Sort copies of arrays; do not mutate the contestant array while calculating the leaderboard. Filters applied for optional contestant search must not change overall house statistics or leaderboard rankings.

### Initialization order

1. Locate the page's stable section containers.
2. Load and validate persisted state, or create demo state.
3. Reconcile any running timer against the current clock.
4. Register event handlers once.
5. Render all sections.
6. Start one display interval only if the timer is running.
7. Surface any storage recovery or persistence limitation.

Do not reseed contestants on every render or attach additional listeners every time the state changes.

## Mandatory requirements

### 1. Contestant management

- Seed at least eight contestants on first launch.
- Show each contestant's name, team, points, and active or evicted status.
- Provide an Add Contestant form with required name and team fields.
- Give each contestant a stable unique ID.
- Display clear badges for captaincy, immunity, and nomination.
- Show evicted contestants in a separate section so their history remains inspectable.

Suggested initial contestants:

| Name | Team | Starting points |
| --- | --- | ---: |
| Aarav | Phoenix | 120 |
| Diya | Titans | 95 |
| Kabir | Phoenix | 110 |
| Meera | Titans | 80 |
| Rohan | Phoenix | 70 |
| Ananya | Titans | 105 |
| Vikram | Phoenix | 60 |
| Isha | Titans | 90 |

### 2. Live leaderboard

- Rank only active contestants by points, highest first.
- Show rank, name, team, and points.
- Recalculate after point changes, task rewards, contestant additions, and evictions.
- Resolve equal scores consistently: name alphabetically, then ID.
- Highlight the top three contestants.
- Show a useful empty state if no active contestants remain.

### 3. Task management

- Create tasks with a required title, an active assignee, and configurable reward points.
- Show title, assignee, reward, and status for each task.
- Allow pending tasks to be marked complete.
- Award the assigned contestant the task's reward on completion.
- Award that reward exactly once, even if completion is triggered repeatedly.
- Retain completed tasks for review.
- When an assignee is evicted, cancel their pending tasks; retain completed tasks and past rewards.

### 4. Point system

- Provide Add Points and Deduct Points actions for active contestants.
- Require a positive whole-number adjustment amount.
- Allow negative total scores after deductions.
- Update contestant cards, leaderboard, and statistics immediately.
- Reject empty, invalid, fractional, or out-of-range values without changing state.

### 5. Captaincy

- Allow any active contestant to become House Captain.
- Keep at most one captain at a time.
- Selecting a new captain replaces the previous captain.
- Show the captain in the header and on their contestant card.
- Clear captaincy when the captain is evicted.

### 6. Nominations

- Allow active, non-immune contestants to be nominated.
- Allow a nomination to be removed.
- Disable nomination for immune contestants and explain why beside the control.
- Enforce the restriction in the action handler as well as the UI.
- Repeated nomination must not create duplicates.

### 7. Immunity

- Allow immunity to be granted and revoked for active contestants.
- Granting immunity immediately removes any existing nomination.
- Revoking immunity does not automatically nominate the contestant.
- Show an immunity badge wherever relevant.

### 8. Danger zone

- Automatically display every active nominated contestant.
- Show their name, team, and points.
- Update immediately after nomination changes, immunity changes, and eviction.
- Show “No contestants nominated” when the list is empty.

### 9. Big Boss announcements

- Provide a text input and Broadcast button.
- Reject blank or whitespace-only messages.
- Display the latest message prominently with its broadcast time.
- Provide a way to dismiss or clear the current announcement.
- Render messages as text so user input cannot become executable HTML.

### 10. Task timer

- Provide a configurable countdown duration, defaulting to five minutes.
- Support Start, Pause, Resume, and Reset.
- Pause must preserve the remaining time.
- Reset must stop the timer and restore the configured duration.
- Repeated Start clicks must not create multiple timer loops.
- Prevent duration edits while the timer is running or paused mid-countdown; allow them after Reset.
- Show time in `MM:SS` format and a clear “Time's up!” state at zero.
- Never display negative time.
- Preserve the timer's state through a page refresh.
- Store a finish timestamp for a running timer and derive the remaining time from the clock, rather than relying only on decrementing an interval counter.

The timer is a house-wide control. Expiry does not automatically complete tasks or award points.

### 11. House statistics

Display statistics derived from current state:

- Active contestant count.
- Highest scorer and their points, using the leaderboard tie rule.
- Completed task count.
- Active nominee count.
- Active immune contestant count.
- Current captain, or “No captain assigned.”

Completed task count includes historical completed tasks, including those completed by contestants who were later evicted.

### 12. Eviction

- Provide a clearly labelled Evict action for active contestants.
- Ask for confirmation naming the contestant before applying eviction.
- Set their status to evicted instead of deleting their record.
- Remove them from the active contestant section, leaderboard, danger zone, and task-assignment options.
- Clear their nomination and immunity, and clear captaincy if applicable.
- Cancel their pending tasks.
- Preserve their points and completed-task history.
- Prevent all further management actions on evicted contestants.

## State model

Use an equivalent structure if the existing codebase has established conventions:

```js
const houseState = {
  version: 1,
  contestants: [
    {
      id: "c1",
      name: "Aarav",
      team: "Phoenix",
      points: 120,
      status: "active", // active | evicted
      isImmune: false,
      isNominated: false
    }
  ],
  tasks: [
    {
      id: "t1",
      title: "Complete the coding challenge",
      assignedTo: "c1",
      rewardPoints: 50,
      status: "pending" // pending | completed | cancelled
    }
  ],
  captainId: null,
  announcement: null, // { message, createdAt }
  timer: {
    durationSeconds: 300,
    remainingSeconds: 300,
    isRunning: false,
    endsAt: null // Unix timestamp in milliseconds while running
  }
};
```

Do not persist separate leaderboard, danger-zone, or statistics arrays. Derive these views from the same source of truth.

### Entity definitions

| Entity | Required fields | Meaning |
| --- | --- | --- |
| Contestant | `id`, `name`, `team`, `points`, `status`, `isImmune`, `isNominated` | Identity, presentation, score, and house eligibility |
| Task | `id`, `title`, `assignedTo`, `rewardPoints`, `status` | A task belongs to one contestant through a stable ID |
| Announcement | `message`, `createdAt`, or `null` | Current broadcast and creation timestamp |
| Captain | `captainId`, or `null` | One active contestant ID; no separate `isCaptain` flags |
| Timer | `durationSeconds`, `remainingSeconds`, `isRunning`, `endsAt` | Configured duration, stopped remainder, and running deadline |
| State version | `version` | Schema compatibility indicator |

If timestamps such as `createdAt`, `completedAt`, or `evictedAt` are added, consistently use Unix milliseconds. Display them with the browser's local time formatter. Do not store display-formatted timestamps as canonical data.

Use plain serializable objects and arrays. Do not place functions, DOM nodes, interval IDs, `Date` instances, or cyclic references in persisted state.

### Invariants that must always hold

1. Contestant IDs are unique; task IDs are unique.
2. Every task assignee references a retained contestant record.
3. Every score is a finite safe integer; negative scores are valid.
4. `captainId` is `null` or references an active contestant.
5. No contestant is both immune and nominated.
6. Evicted contestants are neither immune nor nominated.
7. A pending task belongs to an active contestant.
8. A completed task cannot become pending or award another reward.
9. Cancelled tasks cannot award rewards.
10. Active views exclude evicted contestants.
11. Timer duration is within the configured input limits and remaining time is never negative.
12. A stopped timer has `endsAt: null`; a running timer has a finite deadline.

Captaincy does not imply immunity. A captain can be nominated when non-immune. Nomination does not prevent completing tasks, earning points, or becoming captain. Immunity blocks nomination; it does not block the administrator's explicit eviction action.

No automatic nomination threshold, automatic eviction, or automatic scoring on timer expiry should be introduced.

## State and validation rules

- Load saved state on startup; seed demo contestants only if no valid saved state exists.
- Use a versioned storage key, such as `big-boss-command-center:v1`.
- Validate restored state and recover gracefully from malformed stored data.
- Save after each successful action, including timer transitions.
- Use positive safe integers for point adjustments and timer durations; task rewards may be zero or a positive safe integer.
- Ensure resulting scores remain safe integers.
- Validate contestant status and task status inside action handlers.
- Keep UI feedback clear for rejected actions.
- Handle unavailable browser storage without crashing; explain that changes will last only for the current session.
- Store and render user-entered content safely using text nodes or the framework's default escaping.

Suggested action handlers:

```text
addContestant
adjustPoints
assignCaptain
nominateContestant
removeNomination
grantImmunity
revokeImmunity
createTask
completeTask
broadcastAnnouncement
clearAnnouncement
startTimer
pauseTimer
resetTimer
evictContestant
```

### Input validation contract

The following are app-specific limits chosen to keep the interface usable:

| Field | Accepted value | Rejected value |
| --- | --- | --- |
| Contestant name | Trimmed text, 1–50 characters | Blank or over 50 characters |
| Team | Trimmed text, 1–40 characters | Blank or over 40 characters |
| Initial score for an added contestant | Exactly 0 in the default form | Hidden or arbitrary prefilled score |
| Point adjustment | Integer from 1 to 10,000 | Zero, negative, fractional, blank, or nonnumeric |
| Task title | Trimmed text, 1–100 characters | Blank or over 100 characters |
| Task assignee | Existing active contestant ID | Missing, unknown, or evicted ID |
| Task reward | Integer from 0 to 10,000 | Negative, fractional, blank, or nonnumeric |
| Announcement | Trimmed text, 1–500 characters | Blank or over 500 characters |
| Timer minutes | Integer from 0 to 99 | Negative, fractional, blank, or over 99 |
| Timer seconds | Integer from 0 to 59 | Negative, fractional, blank, or over 59 |
| Total timer duration | 1–5,999 seconds | Zero or outside this range |

Default task reward is 50 points; default added contestant score is 0. Default duration inputs are 5 minutes and 0 seconds. Duplicate names are allowed because IDs establish identity; show name and team in selectors to reduce ambiguity.

Read numeric input as text, reject an empty trimmed value, then validate the entire numeric value. Do not use `parseInt` to silently convert `2.5` into `2` or accept a prefix such as `10abc`. Require finite integers within the declared limits.

Keep invalid forms open, preserve their entered values, associate errors with their fields, and focus the first invalid field. On success, clear only the relevant form or close its dialog. Validate again in domain handlers; HTML attributes alone are insufficient.

### Persistence and recovery contract

- Use one JSON state value under `big-boss-command-center:v1`.
- Wrap both reading and writing in error handling because browser storage may be unavailable.
- Validate shape, field types, IDs, references, enums, numeric ranges, and invariants after parsing.
- An absent key means first launch. Do not treat an existing valid empty contestant array as absent data.
- If JSON or state shape is invalid, initialize safe demo state and show “Saved house data could not be loaded. Demo data has been restored.”
- Where storage permits, retain the invalid raw value under one bounded recovery key before replacing it. Do not create an unlimited sequence of backups.
- An unsupported schema version must not be silently interpreted as the current version. Use the same explicit recovery behavior, or an implemented migration if one exists.
- If persistence fails, continue in memory and show “Changes are available in this session but could not be saved.” Do not report that the action itself failed when it succeeded in memory.
- Save completed-task status and its reward adjustment together as one next-state snapshot.
- Save timer Start, Pause, Reset, and expiry transitions. Do not write storage on every display tick.
- Clearing an announcement persists `announcement: null`.
- Never call `localStorage.clear()`; operate only on this app's keys.
- Refresh does not restart a paused timer. A running timer continues against its saved deadline.

Browser storage is associated with the page's origin and persists across sessions where permitted. See the [MDN localStorage documentation](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage).

## Dashboard design

Create a polished control-room theme with a dark background, readable cards, purple accents, and red danger indicators.

Recommended layout:

```text
Header: Big Boss Command Center + current captain
Statistics row
Announcement banner

Main column                     Side column
Contestant cards                Live leaderboard
Task management                 Danger zone
                                Countdown timer

Evicted contestants section
```

- Make every mandatory feature easy to locate during manual checking.
- Use visible text labels for important actions, not icons alone.
- Stack columns on smaller screens; avoid horizontal overflow.
- Provide labels for inputs, visible keyboard focus, and usable contrast.
- Use badges and text alongside color to communicate status.
- Show helpful empty states and short success or error messages.
- Keep animations subtle and respect reduced-motion preferences.

### Design tokens

Use a small CSS token system. These values are a starting palette; adjust combinations if needed for readability:

```css
:root {
  --bg: #0b1020;
  --surface: #151c30;
  --surface-raised: #202942;
  --text: #f4f7ff;
  --text-muted: #bac4db;
  --accent: #a78bfa;
  --danger: #fda4af;
  --success: #86efac;
  --warning: #fde68a;
  --border: #46516a;
  --radius: 16px;
  --space: 8px;
}
```

Use dark text on pale filled accent buttons. Check the actual foreground/background pairs used. Keep body text around 16px, section headings around 20–24px, and timer digits around 40–56px with tabular numerals. Use a 4/8/12/16/24/32px spacing scale.

### Layout behavior

- Wide screens: header, statistics, announcement, then a main content column and a narrower side column.
- Medium screens: reduce card columns while retaining a sensible reading order.
- Narrow screens: stack sections and allow action groups to wrap.
- Contestant cards should use an auto-fitting grid with a minimum width that fits inside a 360px viewport.
- Avoid a fixed-height dashboard that hides content.
- Long names, task titles, and announcements must wrap without breaking the layout.
- Show active status explicitly; badges supplement rather than replace it.
- A header “Live” label must represent immediate local updates, not imply a connected multi-user server.

### Component behavior

| Section | Controls and content |
| --- | --- |
| Header | Product title, short house subtitle, current captain |
| Stats | Active count, highest scorer, completed tasks, nominees, immune count |
| Contestants | Add form, cards, point controls, captaincy, nominations, immunity, eviction |
| Leaderboard | Ordered ranking, top-three emphasis, active contestants only |
| Tasks | Creation form, active assignee selector, pending/completed/cancelled labels |
| Danger zone | Nominees, points, remove-nomination action, link or action to eviction |
| Announcement | Composer, Broadcast, current message/time, Dismiss |
| Timer | Minute/second inputs, countdown, Start/Pause/Resume/Reset, expiry state |
| Evicted history | Name, team, final points, evicted label; no active management controls |

When no active contestants exist, disable task creation and captain assignment with a helpful explanation. Adding a contestant must make eligible controls available again.

### Accessibility and feedback

- Use native buttons and form controls wherever possible.
- Every input needs a visible label; placeholders are examples, not labels.
- Set button `type` explicitly to prevent accidental form submission.
- Provide section headings and semantic page landmarks.
- Give the leaderboard meaningful column headings or use an accessible ordered list.
- Support keyboard operation for every required action.
- Use a visible focus outline and comfortable targets, aiming for at least 44px on touch screens.
- Associate field errors with `aria-describedby` and mark invalid controls with `aria-invalid`.
- Announce action outcomes in a polite live region; do not make the entire dashboard a live region.
- Do not announce the countdown every second. Announce expiry once.
- Eviction dialogs must identify the contestant, offer Cancel and Evict, focus Cancel initially, support Escape to cancel, and return focus to a sensible control afterward.
- If using a custom modal, implement focus containment. A native confirmation is an acceptable time-saving alternative.
- Re-rendering must not erase typed drafts or unnecessarily move keyboard focus.
- Use success messages such as “Added 20 points to Diya” and specific errors such as “Isha has immunity and cannot be nominated.”
- Restrict nonessential motion under `prefers-reduced-motion: reduce`.

## Action contracts

| Action | Preconditions | Successful state change | Repeat or failure behavior |
| --- | --- | --- | --- |
| Add contestant | Valid name/team | Add unique active record at 0 points | Invalid form leaves state unchanged |
| Adjust points | Active ID, valid amount/direction, safe resulting score | Apply exactly one signed adjustment | Unknown/evicted IDs rejected |
| Assign captain | Active ID | Replace `captainId` | Assigning current captain is a harmless no-op |
| Nominate | Active and not immune | Set nomination true | Already nominated is a no-op; immune is rejected |
| Remove nomination | Active ID | Set nomination false | Already clear is a no-op |
| Grant immunity | Active ID | Set immune true and nominated false together | Already immune is a no-op |
| Revoke immunity | Active ID | Set immune false | Does not create a nomination |
| Create task | Valid title/reward, active assignee | Add unique pending task | Invalid input leaves state unchanged |
| Complete task | Existing pending task, active assignee, safe resulting score | Add reward and mark complete in one commit | Completed/cancelled task cannot award again |
| Broadcast | Valid message | Replace current announcement with timestamped message | Blank input rejected |
| Clear announcement | Any state | Set announcement to null | Already clear is a no-op |
| Evict | Active ID, user confirms | Mark evicted, clear flags/captaincy, cancel pending tasks | Cancel changes nothing; repeated eviction is a no-op |

Add/Deduct Points needs an explicit direction chosen by the action, not a user-entered signed amount. A missing ID or stale selection must fail gracefully rather than throw an uncaught error.

Eviction must apply all related changes in one state transition. Never briefly leave an evicted captain or nominated evicted contestant in derived views.

## Timer state machine and calculations

Derive timer mode from its persisted fields rather than storing a second conflicting mode:

- **Ready:** stopped, remainder equals duration.
- **Running:** running with a finite deadline.
- **Paused:** stopped with remainder greater than zero and less than duration.
- **Expired:** stopped with zero remainder.

For a paused timer whose remainder still equals its duration because it was paused immediately, showing Ready is acceptable; starting still uses that preserved remainder.

| Current mode | Action | Result |
| --- | --- | --- |
| Ready | Start | Running; deadline is current time plus remainder |
| Running | Start | No-op; no second interval |
| Running | Pause | Compute current remainder, stop, clear deadline and interval |
| Paused | Resume | Running from preserved remainder |
| Any | Reset | Ready with configured duration; clear deadline and interval |
| Running | Deadline reached | Expired; remainder 0, running false, deadline null |
| Expired | Start/Resume | Disabled; user must Reset first |
| Ready | Edit duration | Validate and update duration and remainder together |

During a running countdown, compute:

```js
const remaining = Math.min(
  timer.durationSeconds,
  Math.max(0, Math.ceil((timer.endsAt - now) / 1000))
);
```

Use the same clock snapshot when deciding expiry and calculating remainder. A system-clock adjustment may affect this deadline-based demo; do not promise clock-independent synchronization.

On Start or Resume:

```text
endsAt = now + remainingSeconds * 1000
isRunning = true
save transition
ensure exactly one display interval
```

On Pause, calculate remainder first. If the deadline has already passed, finish as Expired instead. Otherwise save the stopped remainder and clear `endsAt` and the interval.

Update only the timer display at roughly 250–1,000ms intervals. Reconcile on page visibility changes and startup. `setInterval` is a display trigger, not the authority for elapsed time; callbacks may be delayed. See the [MDN setInterval documentation](https://developer.mozilla.org/en-US/docs/Web/API/Window/setInterval).

At expiry, commit and save the transition once, clear the interval, and display “Time's up!” No score or task transition occurs. Refresh after expiry must not restart the timer. Provide Reset so the user can run it again.

## Error handling, security, and performance

### Error handling

- Expected validation failures produce readable inline feedback, not stack traces.
- Storage failure produces one persistent status message, not a toast on every tick.
- Disable submit controls briefly during a synchronous action if necessary to avoid accidental duplicate additions.
- Domain rules must still handle repeated commands safely.
- Keep failed-action messages distinct from successful actions whose persistence failed.
- If initialization cannot load saved state, use the documented recovery flow; avoid a blank screen.
- Avoid showing “Loading” indefinitely when all data is local.

### Security and privacy boundaries

- Treat form content and restored storage as untrusted input.
- Insert user text using `textContent` or equivalent escaping. Do not interpolate it into `innerHTML`, script, CSS, or executable attributes.
- Do not use `eval`, `new Function`, or string-based timer callbacks.
- Store no credentials, access tokens, or real sensitive contestant information in demo data.
- Do not commit secrets, personal browser data, or environment files to GitHub.
- Use the repository visibility authorized for this challenge. A static demo has no authentication and should not be described as a confidential production system.
- Browser users can edit local data; this app does not provide tamper-proof scoring. Mention this limitation in delivery documentation.

### Performance

- Eight to dozens of contestants do not need virtualization or complex caching.
- Derive small views directly from state; keep selectors deterministic.
- Update only affected sections where practical, especially during timer ticks.
- Preserve stable form nodes and drafts during state changes.
- Do not repeatedly attach listeners or start intervals in render functions.
- Avoid large images, blocking remote assets, excessive shadows, or continuous animation.
- Check that repeated Start/Pause/Reset cycles do not leave multiple intervals alive.

## Suggested file structure for a new application

```text
index.html
styles.css
README.md
src/
  main.js          # Initialization and event wiring
  seed.js          # Eight demo contestants and initial state factory
  store.js         # Current state and coordinated updates
  actions.js       # Business-rule transitions
  selectors.js     # Derived leaderboard, danger zone, and statistics
  storage.js       # Load, validate, save, and recover persisted state
  timer.js         # Countdown calculations and interval lifecycle
  ui.js            # DOM rendering, dialogs, and feedback
  utils.js         # IDs, parsing, text normalization, and formatting
tests/
  core.test.js     # Optional focused domain tests
assets/
  screenshot.png  # Add only after capturing the actual application
.gitignore
package.json      # Optional; only if using Node tests or an existing toolchain
```

This is a recommended separation of responsibilities, not a requirement to create empty files. Combine closely related modules if needed to finish within the time limit. Do not ship placeholder modules, unused assets, or screenshots that were not captured from the app.

### Code conventions

- Use meaningful names such as `grantImmunity`, not unexplained abbreviations.
- Prefer `const`; use `let` only for values that change.
- Keep module imports explicit and avoid circular dependencies.
- Use named constants for storage keys, defaults, limits, and timer update intervals.
- Use comments for business decisions and tricky transitions rather than narrating obvious code.
- Keep inline event-handler attributes out of HTML; wire events in JavaScript.
- Use event delegation on stable containers for repeated contestant and task controls.
- Identify entities using `data-contestant-id` or `data-task-id`; do not use array positions as identity.
- Do not add network requests, analytics, debug dumps, or console errors to normal interactions.
- Remove dead code and debug logging before delivery.
- Prefer small functions and straightforward code over unnecessary abstractions.
- For an existing framework project, follow its established component, formatting, and state conventions.

## 45-minute implementation schedule

| Time | Deliverable |
| --- | --- |
| 0–5 minutes | Application setup, dashboard structure, eight seeded contestants |
| 5–15 minutes | Contestant management, points, leaderboard, captaincy |
| 15–23 minutes | Nominations, immunity, danger zone, eviction |
| 23–30 minutes | Task creation, assignment, completion, one-time rewards |
| 30–35 minutes | Announcement controls and countdown timer |
| 35–39 minutes | Statistics, persistence, validation |
| 39–43 minutes | Responsive styling and mandatory acceptance checks |
| 43–45 minutes | Run instructions, feature checklist, submission preparation |

Implement persistence alongside the state actions where practical. Do not defer all verification until the final minute.

## Acceptance checks

Verify the actual application, not just the source code:

1. First launch shows at least eight contestants with name, team, points, and status.
2. Adding a contestant updates the active count and leaderboard.
3. Adding and deducting points updates rankings and the highest-scorer statistic immediately.
4. Changing the captain leaves exactly one captain.
5. Nominating a contestant adds them to the danger zone and increments the nominee count.
6. Granting that contestant immunity clears their nomination and blocks further nomination.
7. Revoking immunity allows nomination again without automatically nominating them.
8. Completing an assigned task awards its reward once and increments completed-task count once.
9. A broadcast appears immediately; blank broadcasts are rejected.
10. Timer Start, Pause, Resume, and Reset behave correctly, including repeated Start clicks and expiry.
11. Refresh restores contestants, scores, captaincy, tasks, nominations, immunity, announcement, and timer state.
12. Evicting a nominated captain removes them from active views, clears captaincy and nomination, and cancels their pending tasks.
13. Evicted contestants remain visible in history and cannot receive management actions.
14. Empty states work when there are no nominees, no tasks, or no active contestants.
15. The dashboard remains usable on desktop and a narrow mobile viewport.
16. No uncaught browser errors occur during the main workflow.

Use focused automated checks if the project already supports them, especially for immunity restrictions, duplicate task rewards, eviction, and timer state. Do not spend challenge time introducing a large test framework.

### Manual verification matrix

Use fresh demo state for the baseline. Perform destructive or recovery checks in a separate test browser profile or after exporting a copy of the app's storage value.

| ID | Scenario | Expected outcome |
| --- | --- | --- |
| C01 | First launch | Eight active contestants; Aarav leads with 120 points |
| C02 | Add a valid contestant | New active card at 0 points; active count becomes 9 |
| C03 | Submit blank name or team | Inline error; no new contestant |
| P01 | Add 20 to Diya | Score 115; leaderboard updates |
| P02 | Deduct 5 from Diya after P01 | Score 110; tie resolved by name and ID |
| P03 | Deduct more than a contestant's points | Negative total displayed and ranked correctly |
| P04 | Submit zero, decimal, nonnumeric, or over-limit adjustment | Rejected without score changes |
| H01 | Assign Aarav captain, then Diya | Only Diya remains captain |
| N01 | Nominate Isha | Isha appears in danger zone; nominee count increases |
| I01 | Grant immunity to nominated Isha | Nomination removed; danger zone and counts update |
| I02 | Attempt nomination while immune | UI disabled; direct action rejected; no nomination |
| I03 | Revoke immunity | Nomination becomes available; Isha remains un-nominated |
| T01 | Assign Diya a 50-point task and complete it after P02 | Diya reaches 160 points and leads; completed count increases |
| T02 | Trigger completion again | Score and completed count stay unchanged |
| T03 | Create a zero-reward task and complete it | Completed count increases; score stays unchanged |
| A01 | Broadcast a valid message | Exact text and local timestamp displayed |
| A02 | Broadcast whitespace only | Rejected; previous message remains |
| A03 | Broadcast HTML-like text | Text is displayed literally; no injected markup executes |
| R01 | Start 10 seconds, pause, wait, resume | Paused display stays fixed; resume uses remaining time |
| R02 | Click Start repeatedly | Countdown does not speed up |
| R03 | Refresh during a running timer | Countdown continues against the saved deadline |
| R04 | Refresh during a paused timer | Timer remains paused |
| R05 | Leave tab inactive beyond deadline, then return | Expired state; zero remainder; no task or score change |
| R06 | Reset | Stops and restores configured duration |
| E01 | Create a pending task for nominated captain Diya, then evict her | Removed from active views; captain cleared; pending task cancelled; past completed task retained |
| E02 | Cancel eviction dialog | No changes to state or views |
| E03 | Invoke a management action on an evicted ID | Rejected without changing that record |
| S01 | Refresh after multiple house actions | Saved scores, flags, captaincy, tasks, and announcement restored |
| S02 | Supply malformed saved JSON in test storage | App recovers with explicit feedback |
| S03 | Simulate storage write failure | App works in memory and shows persistence limitation |
| U01 | Evict all contestants in test state | Empty active views; disabled assignee controls; retained history |
| U02 | Test 360px viewport and keyboard-only navigation | No page overflow; required controls remain reachable |

### Focused automated checks

If time and runtime availability allow, test pure domain functions with the existing test runner or Node's built-in runner. High-value assertions are:

- Immune nomination leaves state unchanged.
- Granting immunity clears nomination in the same transition.
- Replacing captaincy leaves exactly one captain ID.
- A task completion changes task status and score together.
- Repeated completion and cancelled completion cannot award points.
- Eviction clears captaincy/flags and cancels only pending tasks for that contestant.
- Leaderboard excludes evicted contestants, handles negative scores, and resolves ties.
- Failed validation leaves the previous state intact.
- Timer calculations use a supplied clock value and clamp at zero.
- Timer restore after a passed deadline yields Expired.

Inject `now` into timer calculations for deterministic checks. Do not use real sleeps to test elapsed time. Domain tests should not require a DOM, browser storage, or a running local server.

Do not write tests that simply repeat CSS values or restate the implementation. Automated checks supplement the actual UI workflow; they do not establish that all buttons are wired correctly.

### Browser inspection and evidence

- Inspect the browser console for uncaught exceptions during the main workflow.
- Inspect asset requests for missing files and incorrect module MIME types.
- Confirm controls still work after repeated updates, not only on first render.
- Capture at least one screenshot of the actual complete dashboard if tooling is available.
- Record the commands and browser checks actually performed, including failures and unresolved limitations.
- If browser access is unavailable, say that UI verification is pending. Source review alone must not be reported as a passed browser check.

### Two-minute evaluator walkthrough

1. Show eight seeded contestants and the initial leaderboard.
2. Add and deduct points, pointing out updated rankings and highest scorer.
3. Assign and replace the captain.
4. Nominate a contestant, then grant immunity and demonstrate the blocked nomination.
5. Assign and complete a task; show the one-time reward and completed-task count.
6. Broadcast an announcement.
7. Run a short timer, pause/resume it, and reset it.
8. Evict a contestant and show their removal from active views and presence in history.
9. Refresh and show restored house state.

## Troubleshooting guidelines

| Symptom | Likely issue | What to check |
| --- | --- | --- |
| Blank page or inactive buttons | Module load failure or initialization error | Console, script path, HTTP server, import paths |
| Module MIME error | Server returned HTML or another content type | Actual requested URL, file existence, server configuration |
| Works locally but assets fail under a repository URL | Root-relative asset paths | Use `./styles.css`, `./src/main.js`, and relative module imports |
| Scores change but leaderboard does not | Duplicate state or stale render | Central store and selector use; affected-section render after commit |
| Immune contestant can be nominated | Rule enforced only in UI | Domain action preconditions and restored state invariants |
| Task reward applies twice | Missing status guard | Check pending status before changing task and score |
| Timer runs faster after repeated Start | More than one interval | Runtime interval ownership and cleanup |
| Timer freezes while backgrounded | Countdown based on tick count | Derive from deadline and reconcile on visibility changes |
| Refresh loses data | Save/load failure or different origin | Storage status, key, URL host/port, browser profile |
| Typing disappears during a timer tick | Whole-page rerender | Update timer node only; preserve form drafts |
| Evicted captain still appears | Partial eviction transition | Clear captaincy, flags, and pending tasks in one commit |

Diagnose the actual failure and fix it before broadening the scope. Do not replace the project or introduce a new framework to solve a small wiring error.

## Optional improvements

Only add these after all mandatory features pass:

- Activity feed for point changes, tasks, captaincy, nominations, and evictions.
- Contestant search or team filter.
- Quick point buttons such as +10 and -10.
- Reset Demo button with explicit confirmation.
- Small visual transitions for broadcasts and leaderboard changes.

## Completion and submission

Before finishing:

- Confirm every mandatory feature is functional.
- Preserve this specification. Add verified application run instructions and an implementation-status section to the README, or keep this full brief in `docs/AGENT_BRIEF.md` and link it from the final README.
- Summarize checks performed and disclose any incomplete features accurately.
- Prepare the project for a GitHub repository submission; ensure local scratch files and credentials are excluded.
- If repository access and authorization are available, push the completed code and provide the actual repository URL. Otherwise provide the precise remaining submission steps.
- Do not claim a repository was uploaded, the application was deployed, or checks passed unless those actions actually succeeded.

### Repository hygiene

- Include all source files needed to run the app.
- Use a sensible `.gitignore` for the actual stack: exclude credentials, `.env` files, dependencies, build caches, logs, editor metadata, and temporary work.
- Include a lockfile if the existing project has package dependencies.
- Do not add a lockfile or dependency directory to a dependency-free project without a reason.
- Keep actual screenshots in a documented assets directory.
- Ensure the repository root contains the entry page or a documented application directory.
- Do not upload unrelated files from the user's workspace.
- Use clear commits that describe the implemented dashboard and its rules.

### Optional static hosting

A deployed website is useful for review but is not one of the 12 mandatory features. The competition explicitly asks for a GitHub repository link. Complete repository preparation first.

For the default static application, there is no production build: the deployable assets are `index.html`, `styles.css`, `src/`, and any used local assets. Hosting must serve the modules correctly.

If GitHub Pages is chosen and publication is authorized:

1. Push the complete source to the selected repository.
2. Choose the repository's actual publishing source in Pages settings.
3. Ensure `index.html` is present in that source's root.
4. Use relative asset URLs so repository-path hosting works.
5. Open the published URL and verify all asset loads and the main workflow.
6. Provide the verified repository URL and, separately, the verified demo URL.

Consult the [official GitHub Pages setup documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site) for current account and repository requirements. Do not assume hosting is enabled or change repository visibility just to obtain a demo URL.

For an existing framework project, follow its actual build and hosting process; do not apply the no-build instructions to a project that needs a bundle.

### Final application README content

The coding agent's delivery documentation must include:

1. Product name and a short problem statement.
2. Actual technology stack and dependencies.
3. Verified prerequisites and installation instructions, if any.
4. Verified local run command and URL.
5. Test command, if a suite exists, and checks performed.
6. A checklist marking each of the 12 features as implemented or incomplete.
7. Core rules: immunity, captaincy, one-time task rewards, eviction, negative scores, and timer behavior.
8. Data persistence and recovery behavior.
9. Screenshot of the actual app, if captured.
10. Known limitations, including single-browser storage and no authenticated administration.
11. Actual repository and deployed-demo links, when available.
12. Any remaining manual submission steps.

### Final agent response

Report what was built, how to run it, which checks actually passed, and any remaining limitations or submission work. State unresolved failures plainly. Avoid presenting a plan as a completed implementation.

## Completion gate

- [ ] Eight or more seeded contestants show all required fields.
- [ ] Leaderboard updates with point changes and excludes evicted contestants.
- [ ] Tasks can be created, assigned, and completed with one-time rewards.
- [ ] Points can be added and deducted with validated input.
- [ ] Captain can be assigned and changed.
- [ ] Contestants can be nominated and removed from nomination.
- [ ] Immunity blocks nomination at both UI and domain levels.
- [ ] Danger zone reflects current nominees.
- [ ] Announcements can be broadcast and displayed.
- [ ] Timer starts, pauses, resumes, resets, expires, and restores correctly.
- [ ] Statistics derive accurately from current state.
- [ ] Eviction removes contestants from active views and preserves history.
- [ ] Browser refresh restores saved state.
- [ ] Responsive layout, labels, focus, and empty states are verified.
- [ ] No uncaught errors appear in the checked workflow.
- [ ] Run instructions are accurate and feature status is honest.
- [ ] Repository is ready for the competition's manual submission.

**Definition of done:** A reviewer can run the app, exercise all 12 mandatory features from the dashboard, observe correct immediate updates, refresh without losing saved state, and inspect the implementation in the repository.
