import {
  addContestant,
  adjustPoints,
  assignCaptain,
  broadcastAnnouncement,
  clearAnnouncement,
  completeTask,
  createTask,
  evictContestant,
  getActiveContestants,
  getDangerZone,
  getEvictedContestants,
  getHouseStatistics,
  getLeaderboard,
  getRemainingSeconds,
  getTaskAssignees,
  getTimerMode,
  grantImmunity,
  nominateContestant,
  pauseTimer,
  reconcileTimer,
  removeNomination,
  resetTimer,
  revokeImmunity,
  setTimerDuration,
  startTimer,
} from './domain.js';
import { loadState, saveState, SAVE_FAILED_MESSAGE } from './storage.js';

const TIMER_TICK_MS = 250;
const TOAST_DURATION_MS = 4500;
const DEFAULT_POINT_STEP = '10';
const TIMER_MODE_LABELS = { ready: 'Ready', running: 'Running', paused: 'Paused', expired: "Time's up!" };
// Display preference only; kept apart from the house state.
const THEME_KEY = 'big-boss-command-center:theme';

const $ = (id) => document.getElementById(id);
const numberFormat = new Intl.NumberFormat();
const timeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium' });

let dom;
let state;
let timerIntervalId = null;
let toastTimeoutId = null;
let pendingEvictionId = null;
let evictionTrigger = null;

// ---------- Small DOM helpers (user text is always inserted as text nodes) ----------

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'className') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children.flat()) {
    if (child !== null && child !== undefined && child !== false) node.append(child);
  }
  return node;
}

const formatPoints = (points) => `${numberFormat.format(points)} pts`;
const formatClock = (totalSeconds) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};
const formatTime = (timestamp) => timeFormat.format(new Date(timestamp));

function badge(text, kind) {
  return el('span', { className: `badge badge-${kind}`, text });
}

function contestantBadges(contestant, captainId) {
  return [
    contestant.id === captainId ? badge('Captain', 'captain') : null,
    contestant.isImmune ? badge('Immune', 'immune') : null,
    contestant.isNominated ? badge('Nominated', 'nominated') : null,
  ].filter(Boolean);
}

// Rebuilds a list container while keeping keyboard focus on the equivalent control.
function replaceChildrenKeepingFocus(container, children) {
  const active = document.activeElement;
  let focusKey = null;
  if (active && container.contains(active) && active.dataset.control) {
    focusKey = `${active.dataset.control}|${active.dataset.contestantId ?? ''}|${active.dataset.taskId ?? ''}`;
  }
  container.replaceChildren(...children);
  if (!focusKey) return;
  const [control, contestantId, taskId] = focusKey.split('|');
  const match = [...container.querySelectorAll('[data-control]')].find((node) =>
    node.dataset.control === control
    && (node.dataset.contestantId ?? '') === contestantId
    && (node.dataset.taskId ?? '') === taskId);
  if (match && !match.disabled) match.focus();
}

// ---------- Feedback ----------

function announce(message, kind = 'success') {
  if (!message) return;
  dom.status.textContent = message;
  dom.status.dataset.kind = kind;
  dom.status.classList.add('is-visible');
  clearTimeout(toastTimeoutId);
  toastTimeoutId = setTimeout(() => dom.status.classList.remove('is-visible'), TOAST_DURATION_MS);
}

function showStorageNotice(message) {
  dom.storageNoticeText.textContent = message;
  dom.storageNotice.hidden = false;
}

function setFieldError(input, message) {
  const errorEl = $(`${input.id}-error`);
  input.setAttribute('aria-invalid', 'true');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.hidden = false;
  }
}

function clearFieldErrors(scope) {
  scope.querySelectorAll('[aria-invalid]').forEach((node) => node.removeAttribute('aria-invalid'));
  scope.querySelectorAll('.field-error').forEach((node) => {
    node.textContent = '';
    node.hidden = true;
  });
}

// ---------- State commit ----------

function persist() {
  if (!saveState(state)) showStorageNotice(SAVE_FAILED_MESSAGE);
}

function commit(result) {
  if (!result.ok) {
    announce(result.error, 'error');
    return false;
  }
  if (result.state !== state) {
    state = result.state;
    persist();
    render();
  }
  announce(result.message, 'success');
  syncTimerTicker();
  return true;
}

// Commits a form action, mapping a failed field to its input.
function commitForm(result, form, fieldInputs) {
  clearFieldErrors(form);
  if (!result.ok && result.field && fieldInputs[result.field]) {
    const input = fieldInputs[result.field];
    setFieldError(input, result.error);
    input.focus();
  }
  return commit(result);
}

// ---------- Rendering ----------

function render() {
  renderHeader();
  renderStats();
  renderAnnouncement();
  renderContestants();
  renderTasks();
  renderLeaderboard();
  renderDangerZone();
  renderTimer(Date.now());
  renderEvicted();
}

function renderHeader() {
  const { captain } = getHouseStatistics(state);
  dom.headerCaptain.textContent = captain ? `${captain.name} (Team ${captain.team})` : 'No captain assigned';
}

function renderStats() {
  const stats = getHouseStatistics(state);
  const items = [
    ['Active contestants', String(stats.activeCount), `${stats.evictedCount} evicted`],
    ['Highest scorer', stats.highestScorer ? stats.highestScorer.name : '—',
      stats.highestScorer ? formatPoints(stats.highestScorer.points) : 'No active contestants'],
    ['Completed tasks', String(stats.completedTasks), `${stats.pendingTasks} pending`],
    ['Nominees', String(stats.nomineeCount), 'In the Danger Zone'],
    ['Immune', String(stats.immuneCount), 'Protected from nomination'],
    ['House Captain', stats.captain ? stats.captain.name : 'No captain assigned',
      stats.captain ? `Team ${stats.captain.team}` : 'Assign one from a card'],
  ];
  dom.stats.replaceChildren(...items.map(([label, value, detail]) => el('div', { className: 'stat' },
    el('dt', { text: label }),
    el('dd', {}, el('span', { className: 'stat-value', text: value }), el('span', { className: 'stat-detail', text: detail })),
  )));
}

function renderAnnouncement() {
  const announcement = state.announcement;
  if (!announcement) {
    dom.announcementDisplay.replaceChildren(el('p', { className: 'empty', text: 'No active announcement. Broadcast a message to the house below.' }));
    dom.announcementDisplay.classList.remove('is-live');
    return;
  }
  dom.announcementDisplay.classList.add('is-live');
  dom.announcementDisplay.replaceChildren(
    el('div', { className: 'announcement-body' },
      el('p', { className: 'announcement-label', text: 'Big Boss says' }),
      el('p', { className: 'announcement-message', text: announcement.message }),
      el('p', { className: 'announcement-time' }, 'Broadcast at ',
        el('time', { datetime: new Date(announcement.createdAt).toISOString(), text: formatTime(announcement.createdAt) })),
    ),
    el('button', { type: 'button', className: 'btn btn-small', dataset: { action: 'clear-announcement', control: 'clear-announcement' }, text: 'Dismiss' }),
  );
}

function renderContestantCard(contestant) {
  const id = contestant.id;
  const isCaptain = state.captainId === id;
  const amountId = `amount-${id}`;
  const noteId = `nominate-note-${id}`;
  const classes = ['contestant-card', isCaptain && 'is-captain', contestant.isNominated && 'is-nominated', contestant.isImmune && 'is-immune']
    .filter(Boolean).join(' ');

  const nominationButton = contestant.isNominated
    ? el('button', { type: 'button', className: 'btn btn-small', dataset: { action: 'remove-nomination', control: 'nomination', contestantId: id }, text: 'Remove Nomination' })
    : el('button', {
      type: 'button',
      className: 'btn btn-small btn-warning',
      dataset: { action: 'nominate', control: 'nomination', contestantId: id },
      disabled: contestant.isImmune,
      'aria-describedby': contestant.isImmune ? noteId : null,
      text: 'Nominate',
    });

  return el('article', { className: classes, dataset: { contestantId: id }, 'aria-labelledby': `name-${id}` },
    el('div', { className: 'card-head' },
      el('h3', { className: 'contestant-name', id: `name-${id}`, text: contestant.name }),
      el('p', { className: 'card-points' }, el('strong', { text: numberFormat.format(contestant.points) }), ' pts'),
    ),
    el('p', { className: 'card-meta' },
      el('span', { text: `Team ${contestant.team}` }),
      el('span', { className: 'status status-active', text: 'Active' }),
    ),
    el('div', { className: 'badges' }, contestantBadges(contestant, state.captainId)),
    el('div', { className: 'points-control' },
      el('label', { for: amountId, text: 'Points' }),
      el('input', {
        id: amountId,
        type: 'text',
        inputmode: 'numeric',
        value: DEFAULT_POINT_STEP,
        'aria-describedby': `${amountId}-error`,
        dataset: { control: 'amount', contestantId: id, amountFor: id },
      }),
      el('button', { type: 'button', className: 'btn btn-small btn-success', dataset: { action: 'add-points', control: 'add', contestantId: id }, text: 'Add Points' }),
      el('button', { type: 'button', className: 'btn btn-small', dataset: { action: 'deduct-points', control: 'deduct', contestantId: id }, text: 'Deduct Points' }),
    ),
    el('p', { id: `${amountId}-error`, className: 'field-error', hidden: true }),
    el('div', { className: 'card-actions' },
      el('button', {
        type: 'button',
        className: 'btn btn-small',
        dataset: { action: 'assign-captain', control: 'captain', contestantId: id },
        disabled: isCaptain,
        text: isCaptain ? 'Current Captain' : 'Make Captain',
      }),
      nominationButton,
      el('button', {
        type: 'button',
        className: 'btn btn-small btn-immune',
        dataset: { action: contestant.isImmune ? 'revoke-immunity' : 'grant-immunity', control: 'immunity', contestantId: id },
        text: contestant.isImmune ? 'Revoke Immunity' : 'Grant Immunity',
      }),
      el('button', { type: 'button', className: 'btn btn-small btn-danger', dataset: { action: 'evict', control: 'evict', contestantId: id }, text: 'Evict' }),
    ),
    contestant.isImmune ? el('p', { id: noteId, className: 'control-note', text: 'Immune contestants cannot be nominated.' }) : null,
  );
}

function renderContestants() {
  const active = getActiveContestants(state);
  // Keep typed point amounts across re-renders.
  const drafts = new Map();
  dom.contestantList.querySelectorAll('input[data-amount-for]').forEach((input) => drafts.set(input.dataset.amountFor, input.value));

  dom.activeCountLabel.textContent = `${active.length} active`;
  const cards = active.map(renderContestantCard);
  if (cards.length === 0) {
    cards.push(el('p', { className: 'empty', text: 'No active contestants. Add a contestant to assign tasks, captaincy and nominations.' }));
  }
  replaceChildrenKeepingFocus(dom.contestantList, cards);
  dom.contestantList.querySelectorAll('input[data-amount-for]').forEach((input) => {
    if (drafts.has(input.dataset.amountFor)) input.value = drafts.get(input.dataset.amountFor);
  });

  const teams = [...new Set(state.contestants.map((c) => c.team))].sort();
  dom.teamOptions.replaceChildren(...teams.map((team) => el('option', { value: team })));
}

function renderLeaderboard() {
  const ranked = getLeaderboard(state);
  if (ranked.length === 0) {
    dom.leaderboard.replaceChildren(el('p', { className: 'empty', text: 'No active contestants to rank.' }));
    return;
  }
  const rows = ranked.map((c, index) => el('tr', { className: index < 3 ? `top-${index + 1}` : null },
    el('td', { className: 'rank' }, el('span', { className: 'rank-chip', text: String(index + 1) })),
    el('th', { scope: 'row' }, c.name, state.captainId === c.id ? el('span', { className: 'mini-tag', text: 'Captain' }) : null),
    el('td', { text: c.team }),
    el('td', { className: 'num', text: numberFormat.format(c.points) }),
  ));
  dom.leaderboard.replaceChildren(el('table', { className: 'leaderboard-table' },
    el('caption', { className: 'visually-hidden', text: 'Active contestants ranked by points' }),
    el('thead', {}, el('tr', {},
      el('th', { scope: 'col', text: 'Rank' }),
      el('th', { scope: 'col', text: 'Name' }),
      el('th', { scope: 'col', text: 'Team' }),
      el('th', { scope: 'col', className: 'num', text: 'Points' }))),
    el('tbody', {}, rows),
  ));
}

function renderDangerZone() {
  const nominees = getDangerZone(state);
  if (nominees.length === 0) {
    replaceChildrenKeepingFocus(dom.dangerZone, [el('li', { className: 'empty', text: 'No contestants nominated' })]);
    return;
  }
  replaceChildrenKeepingFocus(dom.dangerZone, nominees.map((c) => el('li', { className: 'danger-item' },
    el('div', {},
      el('p', { className: 'danger-name', text: c.name }),
      el('p', { className: 'muted', text: `Team ${c.team} · ${formatPoints(c.points)}` }),
    ),
    el('div', { className: 'btn-row' },
      el('button', { type: 'button', className: 'btn btn-small', dataset: { action: 'remove-nomination', control: 'danger-remove', contestantId: c.id }, text: 'Remove Nomination' }),
      el('button', { type: 'button', className: 'btn btn-small btn-danger', dataset: { action: 'evict', control: 'danger-evict', contestantId: c.id }, text: 'Evict' }),
    ),
  )));
}

function renderTasks() {
  const contestantsById = new Map(state.contestants.map((c) => [c.id, c]));
  const assignees = getTaskAssignees(state);

  // Rebuild assignee options while keeping a still-valid selection.
  const previous = dom.taskAssignee.value;
  dom.taskAssignee.replaceChildren(
    el('option', { value: '', text: assignees.length ? 'Choose a contestant' : 'No active contestants' }),
    ...assignees.map((c) => el('option', { value: c.id, text: `${c.name} (Team ${c.team})` })),
  );
  if (assignees.some((c) => c.id === previous)) dom.taskAssignee.value = previous;
  const canAssign = assignees.length > 0;
  dom.taskForm.querySelectorAll('input, select, button').forEach((node) => { node.disabled = !canAssign; });
  dom.taskFormNote.hidden = canAssign;

  const stats = getHouseStatistics(state);
  dom.taskCountLabel.textContent = `${stats.pendingTasks} pending · ${stats.completedTasks} completed`;

  if (state.tasks.length === 0) {
    replaceChildrenKeepingFocus(dom.taskList, [el('li', { className: 'empty', text: 'No tasks yet. Assign the first task above.' })]);
    return;
  }
  const statusOrder = { pending: 0, completed: 1, cancelled: 2 };
  const tasks = [...state.tasks].sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || (b.createdAt ?? 0) - (a.createdAt ?? 0));
  replaceChildrenKeepingFocus(dom.taskList, tasks.map((task) => {
    const owner = contestantsById.get(task.assignedTo);
    const ownerLabel = owner ? `${owner.name} (Team ${owner.team})${owner.status === 'evicted' ? ' · evicted' : ''}` : 'Unknown contestant';
    return el('li', { className: `task-item task-${task.status}` },
      el('div', { className: 'task-main' },
        el('p', { className: 'task-title', text: task.title }),
        el('p', { className: 'muted', text: `Assigned to ${ownerLabel} · Reward ${formatPoints(task.rewardPoints)}` }),
      ),
      el('div', { className: 'task-side' },
        badge(task.status[0].toUpperCase() + task.status.slice(1), task.status),
        task.status === 'pending'
          ? el('button', { type: 'button', className: 'btn btn-small btn-success', dataset: { action: 'complete-task', control: 'complete', taskId: task.id }, text: 'Mark Complete' })
          : null,
      ),
    );
  }));
}

function renderTimer(now) {
  const timer = state.timer;
  const mode = getTimerMode(timer);
  const remaining = getRemainingSeconds(timer, now);
  dom.timerDisplay.textContent = mode === 'expired' ? '00:00' : formatClock(remaining);
  dom.timerState.textContent = TIMER_MODE_LABELS[mode];
  dom.timerPanel.dataset.mode = mode;
  dom.timerStart.textContent = mode === 'paused' ? 'Resume' : 'Start';
  dom.timerStart.disabled = mode === 'running' || mode === 'expired';
  dom.timerPause.disabled = mode !== 'running';

  const editable = mode === 'ready';
  dom.timerMinutes.disabled = !editable;
  dom.timerSeconds.disabled = !editable;
  dom.timerLockNote.hidden = editable;
  if (!editable) syncTimerInputs();
}

function syncTimerInputs() {
  dom.timerMinutes.value = String(Math.floor(state.timer.durationSeconds / 60));
  dom.timerSeconds.value = String(state.timer.durationSeconds % 60);
}

function renderEvicted() {
  const evicted = getEvictedContestants(state);
  if (evicted.length === 0) {
    dom.evictedList.replaceChildren(el('p', { className: 'empty', text: 'No one has been evicted yet.' }));
    return;
  }
  const completedByContestant = new Map();
  for (const task of state.tasks) {
    if (task.status === 'completed') completedByContestant.set(task.assignedTo, (completedByContestant.get(task.assignedTo) ?? 0) + 1);
  }
  dom.evictedList.replaceChildren(el('div', { className: 'table-scroll' }, el('table', { className: 'evicted-table' },
    el('thead', {}, el('tr', {},
      el('th', { scope: 'col', text: 'Name' }),
      el('th', { scope: 'col', text: 'Team' }),
      el('th', { scope: 'col', className: 'num', text: 'Final points' }),
      el('th', { scope: 'col', className: 'num', text: 'Tasks done' }),
      el('th', { scope: 'col', text: 'Status' }))),
    el('tbody', {}, evicted.map((c) => el('tr', {},
      el('th', { scope: 'row', text: c.name }),
      el('td', { text: c.team }),
      el('td', { className: 'num', text: numberFormat.format(c.points) }),
      el('td', { className: 'num', text: String(completedByContestant.get(c.id) ?? 0) }),
      el('td', {}, badge('Evicted', 'evicted'), c.evictedAt ? el('span', { className: 'muted evicted-time', text: formatTime(c.evictedAt) }) : null),
    ))),
  )));
}

// ---------- Timer runtime (interval is a display trigger only) ----------

function syncTimerTicker() {
  if (state.timer.isRunning && timerIntervalId === null) {
    timerIntervalId = setInterval(tickTimer, TIMER_TICK_MS);
  } else if (!state.timer.isRunning && timerIntervalId !== null) {
    clearInterval(timerIntervalId);
    timerIntervalId = null;
  }
}

function tickTimer() {
  const now = Date.now();
  const { state: next, expired } = reconcileTimer(state, now);
  if (expired) {
    state = next;
    persist();
    syncTimerTicker();
    renderTimer(now);
    announce("Time's up!", 'warning');
    return;
  }
  renderTimer(now);
}

// ---------- Eviction dialog ----------

function openEvictionDialog(contestantId, trigger) {
  const contestant = state.contestants.find((c) => c.id === contestantId);
  if (!contestant || contestant.status !== 'active') {
    announce('That contestant is no longer active.', 'error');
    return;
  }
  if (dom.evictDialog.open) return;
  pendingEvictionId = contestantId;
  evictionTrigger = trigger;
  dom.evictTitle.textContent = `Evict ${contestant.name}?`;
  dom.evictDescription.textContent = `${contestant.name} (Team ${contestant.team}) will leave the Tech House. They will be removed from the leaderboard, Danger Zone and task assignment, and any pending tasks will be cancelled. Their points and completed tasks stay in the history.`;
  dom.evictConfirm.textContent = `Evict ${contestant.name}`;
  dom.evictDialog.showModal();
  dom.evictCancel.focus();
}

// Decisions are handled synchronously from the buttons and Escape rather than the
// dialog's async `close` event, which background tabs can delay.
function finishEviction(confirmed) {
  if (pendingEvictionId === null) return;
  const contestantId = pendingEvictionId;
  pendingEvictionId = null;
  if (dom.evictDialog.open) dom.evictDialog.close();
  if (confirmed) {
    commit(evictContestant(state, contestantId, Date.now()));
  } else {
    announce('Eviction cancelled.', 'info');
  }
  // The trigger disappears after a successful eviction, so fall back to the section heading.
  if (evictionTrigger && evictionTrigger.isConnected) evictionTrigger.focus();
  else dom.contestantsHeading.focus();
  evictionTrigger = null;
}

// ---------- Theme ----------

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  dom.themeToggle.setAttribute('aria-checked', String(theme === 'dark'));
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  applyTheme(next);
  try {
    window.localStorage.setItem(THEME_KEY, next);
  } catch {
    // The theme still changes for this session.
  }
  announce(next === 'dark' ? 'Dark mode on.' : 'Light mode on.', 'info');
}

// ---------- Event wiring ----------

function handlePointAdjustment(contestantId, direction) {
  const input = [...dom.contestantList.querySelectorAll('input[data-amount-for]')]
    .find((node) => node.dataset.amountFor === contestantId);
  if (input) clearFieldErrors(input.closest('.contestant-card'));
  const result = adjustPoints(state, contestantId, direction, input ? input.value : '');
  if (!result.ok && result.field === 'amount' && input) {
    setFieldError(input, result.error);
    input.focus();
  }
  commit(result);
}

function handleDashboardClick(event) {
  const button = event.target.closest('button[data-action]');
  if (!button || button.disabled) return;
  const { action, contestantId, taskId } = button.dataset;
  switch (action) {
    case 'add-points': handlePointAdjustment(contestantId, 'add'); break;
    case 'deduct-points': handlePointAdjustment(contestantId, 'deduct'); break;
    case 'assign-captain': commit(assignCaptain(state, contestantId)); break;
    case 'nominate': commit(nominateContestant(state, contestantId)); break;
    case 'remove-nomination': commit(removeNomination(state, contestantId)); break;
    case 'grant-immunity': commit(grantImmunity(state, contestantId)); break;
    case 'revoke-immunity': commit(revokeImmunity(state, contestantId)); break;
    case 'evict': openEvictionDialog(contestantId, button); break;
    case 'complete-task': commit(completeTask(state, taskId, Date.now())); break;
    case 'clear-announcement': commit(clearAnnouncement(state)); break;
    default: break;
  }
}

function wireEvents() {
  dom.main.addEventListener('click', handleDashboardClick);

  // Enter in a card's points field adds points, matching the first button.
  dom.contestantList.addEventListener('keydown', (event) => {
    const input = event.target.closest('input[data-amount-for]');
    if (input && event.key === 'Enter') {
      event.preventDefault();
      handlePointAdjustment(input.dataset.amountFor, 'add');
    }
  });

  dom.contestantForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const result = addContestant(state, { name: dom.contestantName.value, team: dom.contestantTeam.value });
    if (commitForm(result, dom.contestantForm, { name: dom.contestantName, team: dom.contestantTeam })) {
      dom.contestantForm.reset();
      dom.contestantName.focus();
    }
  });

  dom.taskForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const result = createTask(state, {
      title: dom.taskTitle.value,
      assignedTo: dom.taskAssignee.value,
      reward: dom.taskReward.value,
    }, Date.now());
    if (commitForm(result, dom.taskForm, { title: dom.taskTitle, assignee: dom.taskAssignee, reward: dom.taskReward })) {
      dom.taskTitle.value = '';
      dom.taskTitle.focus();
    }
  });

  dom.announcementForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const result = broadcastAnnouncement(state, dom.announcementInput.value, Date.now());
    if (commitForm(result, dom.announcementForm, { message: dom.announcementInput })) {
      dom.announcementInput.value = '';
    }
  });

  dom.timerForm.addEventListener('submit', (event) => {
    event.preventDefault();
    clearFieldErrors(dom.timerForm);
    let base = state;
    if (getTimerMode(state.timer) === 'ready') {
      const configured = setTimerDuration(state, dom.timerMinutes.value, dom.timerSeconds.value);
      if (!configured.ok) {
        commitForm(configured, dom.timerForm, { minutes: dom.timerMinutes, seconds: dom.timerSeconds });
        return;
      }
      base = configured.state;
    }
    commit(startTimer(base, Date.now()));
  });

  dom.timerPause.addEventListener('click', () => commit(pauseTimer(state, Date.now())));
  dom.timerReset.addEventListener('click', () => {
    clearFieldErrors(dom.timerForm);
    commit(resetTimer(state));
    syncTimerInputs();
  });

  dom.evictConfirm.addEventListener('click', (event) => {
    event.preventDefault();
    finishEviction(true);
  });
  dom.evictCancel.addEventListener('click', (event) => {
    event.preventDefault();
    finishEviction(false);
  });
  dom.evictDialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    finishEviction(false);
  });
  // Any other way of closing the dialog counts as Cancel.
  dom.evictDialog.addEventListener('close', () => finishEviction(false));
  dom.storageNoticeDismiss.addEventListener('click', () => { dom.storageNotice.hidden = true; });
  dom.themeToggle.addEventListener('click', toggleTheme);

  // Background tabs throttle intervals; reconcile against the deadline on return.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.timer.isRunning) tickTimer();
  });
}

function collectDom() {
  return {
    main: $('main'),
    themeToggle: $('theme-toggle'),
    headerCaptain: $('header-captain'),
    storageNotice: $('storage-notice'),
    storageNoticeText: $('storage-notice-text'),
    storageNoticeDismiss: $('storage-notice-dismiss'),
    stats: $('stats'),
    announcementDisplay: $('announcement-display'),
    announcementForm: $('announcement-form'),
    announcementInput: $('announcement-input'),
    contestantsHeading: $('contestants-heading'),
    activeCountLabel: $('active-count-label'),
    contestantForm: $('contestant-form'),
    contestantName: $('contestant-name'),
    contestantTeam: $('contestant-team'),
    teamOptions: $('team-options'),
    contestantList: $('contestant-list'),
    taskForm: $('task-form'),
    taskTitle: $('task-title'),
    taskAssignee: $('task-assignee'),
    taskReward: $('task-reward'),
    taskFormNote: $('task-form-note'),
    taskCountLabel: $('task-count-label'),
    taskList: $('task-list'),
    leaderboard: $('leaderboard'),
    dangerZone: $('danger-zone'),
    timerPanel: $('timer-panel'),
    timerDisplay: $('timer-display'),
    timerState: $('timer-state'),
    timerForm: $('timer-form'),
    timerMinutes: $('timer-minutes'),
    timerSeconds: $('timer-seconds'),
    timerLockNote: $('timer-lock-note'),
    timerStart: $('timer-start'),
    timerPause: $('timer-pause'),
    timerReset: $('timer-reset'),
    evictedList: $('evicted-list'),
    status: $('action-status'),
    evictDialog: $('evict-dialog'),
    evictTitle: $('evict-title'),
    evictDescription: $('evict-description'),
    evictCancel: $('evict-cancel'),
    evictConfirm: $('evict-confirm'),
  };
}

function init() {
  dom = collectDom();
  applyTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
  const loaded = loadState();
  state = loaded.state;

  const { state: reconciled, expired } = reconcileTimer(state, Date.now());
  state = reconciled;
  if (loaded.isFirstLaunch || expired) persist();

  wireEvents();
  syncTimerInputs();
  render();
  syncTimerTicker();
  if (loaded.notice) showStorageNotice(loaded.notice);
  if (expired) announce("Time's up!", 'warning');
}

init();
