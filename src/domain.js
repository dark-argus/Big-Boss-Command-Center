// Pure house rules: seed data, validation, actions, selectors and timer maths.
// Nothing in this module touches the DOM or browser storage.

export const STORAGE_KEY = 'big-boss-command-center:v1';
export const RECOVERY_KEY = 'big-boss-command-center:recovery';
export const STATE_VERSION = 1;
export const DEFAULT_TIMER_SECONDS = 300;
export const DEFAULT_TASK_REWARD = 50;

export const LIMITS = Object.freeze({
  nameMax: 50,
  teamMax: 40,
  taskTitleMax: 100,
  announcementMax: 500,
  adjustMin: 1,
  adjustMax: 10000,
  rewardMin: 0,
  rewardMax: 10000,
  minutesMax: 99,
  secondsMax: 59,
  durationMin: 1,
  durationMax: 5999,
});

const SEED_CONTESTANTS = [
  ['Aarav', 'Phoenix', 120],
  ['Diya', 'Titans', 95],
  ['Kabir', 'Phoenix', 110],
  ['Meera', 'Titans', 80],
  ['Rohan', 'Phoenix', 70],
  ['Ananya', 'Titans', 105],
  ['Vikram', 'Phoenix', 60],
  ['Isha', 'Titans', 90],
];

export function createSeedState() {
  return {
    version: STATE_VERSION,
    contestants: SEED_CONTESTANTS.map(([name, team, points], index) => ({
      id: `c${index + 1}`,
      name,
      team,
      points,
      status: 'active',
      isImmune: false,
      isNominated: false,
    })),
    tasks: [],
    captainId: null,
    announcement: null,
    timer: {
      durationSeconds: DEFAULT_TIMER_SECONDS,
      remainingSeconds: DEFAULT_TIMER_SECONDS,
      isRunning: false,
      endsAt: null,
    },
  };
}

// ---------- Parsing helpers ----------

export function createId(prefix, takenIds) {
  const taken = new Set(takenIds);
  let id;
  do {
    id = globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function'
      ? `${prefix}-${globalThis.crypto.randomUUID()}`
      : `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  } while (taken.has(id));
  return id;
}

// Whole-string integer parsing: rejects "", "2.5", "10abc" and "1e3" instead of truncating.
export function parseInteger(raw, min, max) {
  const text = String(raw ?? '').trim();
  if (!/^[+-]?\d+$/.test(text)) return null;
  const value = Number(text);
  if (!Number.isSafeInteger(value) || value < min || value > max) return null;
  return value;
}

export function parseText(raw, maxLength) {
  const text = String(raw ?? '').trim();
  if (text.length === 0 || text.length > maxLength) return null;
  return text;
}

const clone = (value) => JSON.parse(JSON.stringify(value));
const ok = (state, message = '') => ({ ok: true, state, message });
const fail = (error, field = null) => ({ ok: false, error, field });

function requireActive(state, contestantId) {
  const contestant = state.contestants.find((c) => c.id === contestantId);
  if (!contestant) return { error: 'That contestant could not be found.' };
  if (contestant.status !== 'active') {
    return { error: `${contestant.name} has been evicted and cannot be managed.` };
  }
  return { contestant };
}

// Runs `apply` against a cloned state containing the active contestant.
function withActiveContestant(state, contestantId, apply) {
  const check = requireActive(state, contestantId);
  if (check.error) return fail(check.error);
  const next = clone(state);
  return apply(next, next.contestants.find((c) => c.id === contestantId), check.contestant);
}

// ---------- Contestant actions ----------

export function addContestant(state, { name, team }) {
  const cleanName = parseText(name, LIMITS.nameMax);
  if (!cleanName) return fail(`Enter a name of 1–${LIMITS.nameMax} characters.`, 'name');
  const cleanTeam = parseText(team, LIMITS.teamMax);
  if (!cleanTeam) return fail(`Enter a team of 1–${LIMITS.teamMax} characters.`, 'team');

  const next = clone(state);
  next.contestants.push({
    id: createId('c', state.contestants.map((c) => c.id)),
    name: cleanName,
    team: cleanTeam,
    points: 0,
    status: 'active',
    isImmune: false,
    isNominated: false,
  });
  return ok(next, `Added ${cleanName} (Team ${cleanTeam}) to the house.`);
}

export function adjustPoints(state, contestantId, direction, rawAmount) {
  if (direction !== 'add' && direction !== 'deduct') return fail('Unknown point adjustment.');
  const check = requireActive(state, contestantId);
  if (check.error) return fail(check.error);
  const amount = parseInteger(rawAmount, LIMITS.adjustMin, LIMITS.adjustMax);
  if (amount === null) {
    return fail(`Enter a whole number from ${LIMITS.adjustMin} to ${LIMITS.adjustMax.toLocaleString('en')}.`, 'amount');
  }
  const nextPoints = check.contestant.points + (direction === 'add' ? amount : -amount);
  if (!Number.isSafeInteger(nextPoints)) return fail('That adjustment would make the score too large.', 'amount');

  const next = clone(state);
  next.contestants.find((c) => c.id === contestantId).points = nextPoints;
  const name = check.contestant.name;
  return ok(next, direction === 'add'
    ? `Added ${amount} points to ${name}.`
    : `Deducted ${amount} points from ${name}.`);
}

export function assignCaptain(state, contestantId) {
  return withActiveContestant(state, contestantId, (next, contestant) => {
    if (state.captainId === contestantId) return ok(state, `${contestant.name} is already the House Captain.`);
    next.captainId = contestantId;
    return ok(next, `${contestant.name} is now the House Captain.`);
  });
}

export function nominateContestant(state, contestantId) {
  return withActiveContestant(state, contestantId, (next, contestant) => {
    if (contestant.isImmune) return fail(`${contestant.name} has immunity and cannot be nominated.`);
    if (contestant.isNominated) return ok(state, `${contestant.name} is already nominated.`);
    contestant.isNominated = true;
    return ok(next, `${contestant.name} has been nominated and is in the Danger Zone.`);
  });
}

export function removeNomination(state, contestantId) {
  return withActiveContestant(state, contestantId, (next, contestant) => {
    if (!contestant.isNominated) return ok(state, `${contestant.name} is not nominated.`);
    contestant.isNominated = false;
    return ok(next, `${contestant.name}'s nomination was removed.`);
  });
}

export function grantImmunity(state, contestantId) {
  return withActiveContestant(state, contestantId, (next, contestant) => {
    if (contestant.isImmune) return ok(state, `${contestant.name} already has immunity.`);
    const wasNominated = contestant.isNominated;
    // Immunity and nomination are mutually exclusive, so both change in one transition.
    contestant.isImmune = true;
    contestant.isNominated = false;
    return ok(next, wasNominated
      ? `${contestant.name} is now immune; their nomination was removed.`
      : `${contestant.name} is now immune.`);
  });
}

export function revokeImmunity(state, contestantId) {
  return withActiveContestant(state, contestantId, (next, contestant) => {
    if (!contestant.isImmune) return ok(state, `${contestant.name} does not have immunity.`);
    contestant.isImmune = false;
    return ok(next, `${contestant.name}'s immunity was revoked.`);
  });
}

export function evictContestant(state, contestantId, now) {
  const contestant = state.contestants.find((c) => c.id === contestantId);
  if (!contestant) return fail('That contestant could not be found.');
  if (contestant.status === 'evicted') return ok(state, `${contestant.name} is already evicted.`);

  const next = clone(state);
  const target = next.contestants.find((c) => c.id === contestantId);
  target.status = 'evicted';
  target.isImmune = false;
  target.isNominated = false;
  target.evictedAt = now;
  if (next.captainId === contestantId) next.captainId = null;

  // Pending work is cancelled; completed tasks and the points they earned stay in history.
  let cancelled = 0;
  for (const task of next.tasks) {
    if (task.assignedTo === contestantId && task.status === 'pending') {
      task.status = 'cancelled';
      cancelled += 1;
    }
  }
  const taskNote = cancelled ? ` ${cancelled} pending task${cancelled === 1 ? ' was' : 's were'} cancelled.` : '';
  return ok(next, `${target.name} has been evicted from the house.${taskNote}`);
}

// ---------- Task actions ----------

export function createTask(state, { title, assignedTo, reward }, now) {
  const cleanTitle = parseText(title, LIMITS.taskTitleMax);
  if (!cleanTitle) return fail(`Enter a task title of 1–${LIMITS.taskTitleMax} characters.`, 'title');
  const check = requireActive(state, assignedTo);
  if (check.error) return fail('Choose an active contestant to assign this task to.', 'assignee');
  const rewardPoints = parseInteger(reward, LIMITS.rewardMin, LIMITS.rewardMax);
  if (rewardPoints === null) {
    return fail(`Enter a reward from ${LIMITS.rewardMin} to ${LIMITS.rewardMax.toLocaleString('en')} points.`, 'reward');
  }

  const next = clone(state);
  next.tasks.push({
    id: createId('t', state.tasks.map((t) => t.id)),
    title: cleanTitle,
    assignedTo,
    rewardPoints,
    status: 'pending',
    createdAt: now,
  });
  return ok(next, `Assigned "${cleanTitle}" to ${check.contestant.name} for ${rewardPoints} points.`);
}

export function completeTask(state, taskId, now) {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) return fail('That task could not be found.');
  // The status guard is what makes the reward one-time.
  if (task.status === 'completed') return fail('This task is already completed; its reward was awarded once.');
  if (task.status === 'cancelled') return fail('Cancelled tasks cannot be completed.');
  const check = requireActive(state, task.assignedTo);
  if (check.error) return fail(check.error);
  const nextPoints = check.contestant.points + task.rewardPoints;
  if (!Number.isSafeInteger(nextPoints)) return fail('That reward would make the score too large.');

  const next = clone(state);
  const nextTask = next.tasks.find((t) => t.id === taskId);
  nextTask.status = 'completed';
  nextTask.completedAt = now;
  next.contestants.find((c) => c.id === task.assignedTo).points = nextPoints;
  return ok(next, `"${task.title}" completed. ${check.contestant.name} earned ${task.rewardPoints} points.`);
}

// ---------- Announcements ----------

export function broadcastAnnouncement(state, rawMessage, now) {
  const message = parseText(rawMessage, LIMITS.announcementMax);
  if (!message) return fail(`Enter an announcement of 1–${LIMITS.announcementMax} characters.`, 'message');
  const next = clone(state);
  next.announcement = { message, createdAt: now };
  return ok(next, 'Announcement broadcast to the house.');
}

export function clearAnnouncement(state) {
  if (state.announcement === null) return ok(state, 'There is no announcement to clear.');
  const next = clone(state);
  next.announcement = null;
  return ok(next, 'Announcement dismissed.');
}

// ---------- Timer ----------

export function getRemainingSeconds(timer, now) {
  if (!timer.isRunning) return timer.remainingSeconds;
  return Math.min(timer.durationSeconds, Math.max(0, Math.ceil((timer.endsAt - now) / 1000)));
}

// Mode is derived from stored fields rather than stored separately.
export function getTimerMode(timer) {
  if (timer.isRunning) return 'running';
  if (timer.remainingSeconds === 0) return 'expired';
  if (timer.remainingSeconds < timer.durationSeconds) return 'paused';
  return 'ready';
}

export function setTimerDuration(state, rawMinutes, rawSeconds) {
  if (getTimerMode(state.timer) !== 'ready') return fail('Reset the timer before changing its duration.', 'minutes');
  const minutes = parseInteger(rawMinutes, 0, LIMITS.minutesMax);
  if (minutes === null) return fail(`Minutes must be a whole number from 0 to ${LIMITS.minutesMax}.`, 'minutes');
  const seconds = parseInteger(rawSeconds, 0, LIMITS.secondsMax);
  if (seconds === null) return fail(`Seconds must be a whole number from 0 to ${LIMITS.secondsMax}.`, 'seconds');
  const total = minutes * 60 + seconds;
  if (total < LIMITS.durationMin || total > LIMITS.durationMax) return fail('The timer must run for at least 1 second.', 'minutes');
  if (total === state.timer.durationSeconds && total === state.timer.remainingSeconds) return ok(state);

  const next = clone(state);
  next.timer = { durationSeconds: total, remainingSeconds: total, isRunning: false, endsAt: null };
  return ok(next);
}

export function startTimer(state, now) {
  const mode = getTimerMode(state.timer);
  if (mode === 'running') return ok(state, 'The timer is already running.');
  if (mode === 'expired') return fail("Time's up. Reset the timer to run it again.");
  const next = clone(state);
  next.timer.isRunning = true;
  next.timer.endsAt = now + state.timer.remainingSeconds * 1000;
  return ok(next, mode === 'paused' ? 'Timer resumed.' : 'Timer started.');
}

function expiredTimer(timer) {
  return { ...timer, remainingSeconds: 0, isRunning: false, endsAt: null };
}

export function pauseTimer(state, now) {
  if (!state.timer.isRunning) return ok(state, 'The timer is not running.');
  const remaining = getRemainingSeconds(state.timer, now);
  const next = clone(state);
  if (remaining <= 0) {
    next.timer = expiredTimer(state.timer);
    return ok(next, "Time's up!");
  }
  next.timer = { ...state.timer, remainingSeconds: remaining, isRunning: false, endsAt: null };
  return ok(next, 'Timer paused.');
}

export function resetTimer(state) {
  const { durationSeconds } = state.timer;
  const next = clone(state);
  next.timer = { durationSeconds, remainingSeconds: durationSeconds, isRunning: false, endsAt: null };
  return ok(next, 'Timer reset.');
}

// Converts a running timer whose deadline has passed into the Expired state.
export function reconcileTimer(state, now) {
  if (!state.timer.isRunning || getRemainingSeconds(state.timer, now) > 0) return { state, expired: false };
  return { state: { ...state, timer: expiredTimer(state.timer) }, expired: true };
}

// ---------- Selectors ----------

export function compareByRank(a, b) {
  if (a.points !== b.points) return b.points - a.points;
  const byName = a.name.localeCompare(b.name, 'en');
  if (byName !== 0) return byName;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export const getActiveContestants = (state) => state.contestants.filter((c) => c.status === 'active');
export const getEvictedContestants = (state) => state.contestants.filter((c) => c.status === 'evicted');
export const getLeaderboard = (state) => [...getActiveContestants(state)].sort(compareByRank);
export const getDangerZone = (state) => getActiveContestants(state).filter((c) => c.isNominated).sort(compareByRank);
export const getCaptain = (state) => state.contestants.find((c) => c.id === state.captainId && c.status === 'active') ?? null;
export const getTaskAssignees = (state) => [...getActiveContestants(state)]
  .sort((a, b) => a.name.localeCompare(b.name, 'en') || a.team.localeCompare(b.team, 'en'));

export function getHouseStatistics(state) {
  const active = getActiveContestants(state);
  return {
    activeCount: active.length,
    evictedCount: state.contestants.length - active.length,
    highestScorer: getLeaderboard(state)[0] ?? null,
    completedTasks: state.tasks.filter((t) => t.status === 'completed').length,
    pendingTasks: state.tasks.filter((t) => t.status === 'pending').length,
    nomineeCount: active.filter((c) => c.isNominated).length,
    immuneCount: active.filter((c) => c.isImmune).length,
    captain: getCaptain(state),
  };
}

// ---------- Restored-state validation ----------

const isCleanText = (value, max) => typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= max;
const isOptionalTimestamp = (value) => value === undefined || Number.isFinite(value);

export function isValidState(s) {
  if (!s || typeof s !== 'object' || s.version !== STATE_VERSION) return false;
  if (!Array.isArray(s.contestants) || !Array.isArray(s.tasks)) return false;

  const contestants = new Map();
  for (const c of s.contestants) {
    if (!c || typeof c.id !== 'string' || !c.id || contestants.has(c.id)) return false;
    if (!isCleanText(c.name, LIMITS.nameMax) || !isCleanText(c.team, LIMITS.teamMax)) return false;
    if (!Number.isSafeInteger(c.points)) return false;
    if (c.status !== 'active' && c.status !== 'evicted') return false;
    if (typeof c.isImmune !== 'boolean' || typeof c.isNominated !== 'boolean') return false;
    if (c.isImmune && c.isNominated) return false;
    if (c.status === 'evicted' && (c.isImmune || c.isNominated)) return false;
    if (!isOptionalTimestamp(c.evictedAt)) return false;
    contestants.set(c.id, c);
  }

  const taskIds = new Set();
  for (const t of s.tasks) {
    if (!t || typeof t.id !== 'string' || !t.id || taskIds.has(t.id)) return false;
    taskIds.add(t.id);
    if (!isCleanText(t.title, LIMITS.taskTitleMax)) return false;
    if (!Number.isSafeInteger(t.rewardPoints) || t.rewardPoints < LIMITS.rewardMin || t.rewardPoints > LIMITS.rewardMax) return false;
    if (!['pending', 'completed', 'cancelled'].includes(t.status)) return false;
    const owner = contestants.get(t.assignedTo);
    if (!owner || (t.status === 'pending' && owner.status !== 'active')) return false;
    if (!isOptionalTimestamp(t.createdAt) || !isOptionalTimestamp(t.completedAt)) return false;
  }

  if (s.captainId !== null) {
    const captain = contestants.get(s.captainId);
    if (!captain || captain.status !== 'active') return false;
  }

  if (s.announcement !== null) {
    const a = s.announcement;
    if (!a || !isCleanText(a.message, LIMITS.announcementMax) || !Number.isFinite(a.createdAt)) return false;
  }

  const timer = s.timer;
  if (!timer || typeof timer !== 'object') return false;
  if (!Number.isSafeInteger(timer.durationSeconds) || timer.durationSeconds < LIMITS.durationMin || timer.durationSeconds > LIMITS.durationMax) return false;
  if (!Number.isSafeInteger(timer.remainingSeconds) || timer.remainingSeconds < 0 || timer.remainingSeconds > timer.durationSeconds) return false;
  if (typeof timer.isRunning !== 'boolean') return false;
  if (timer.isRunning ? !Number.isFinite(timer.endsAt) : timer.endsAt !== null) return false;

  return true;
}
