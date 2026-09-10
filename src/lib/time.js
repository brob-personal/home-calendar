/*
  Pure helpers for the timing row's minutes-since-midnight (0-1439) currency.
  Kept apart from lib/date.js because these operate on plain numbers, not
  Dates — the picker's 96 fifteen-minute slots and the free-text field both
  work in this unit before a Date is ever built.
*/

const TIME_RE = /^(\d{1,2})(?::?(\d{2}))?\s*(am|pm|a|p)?$/i;

/**
 * @param {string} text
 * @returns {number|null} minutes since midnight (0-1439), or null if `text`
 *   isn't a recognizable time.
 */
export function parseTimeText(text) {
  const m = TIME_RE.exec(String(text).trim());
  if (!m) return null;

  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  const suffix = m[3]?.toLowerCase();
  if (min > 59) return null;

  if (suffix) {
    if (h < 1 || h > 12) return null;
    h = h % 12;
    if (suffix[0] === "p") h += 12;
  } else if (h > 23) {
    return null;
  }

  return h * 60 + min;
}

/**
 * @param {number} minutes duration in minutes, > 0
 * @returns {string} "15 mins" / "1 hr" / "1 hr 30 mins"
 */
export function durationLabel(minutes) {
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"}`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hourPart = `${h} hr${h === 1 ? "" : "s"}`;
  return m ? `${hourPart} ${m} min${m === 1 ? "" : "s"}` : hourPart;
}

/**
 * Minutes from `startMin` to `endMin`, wrapping past midnight instead of
 * going negative. An identical pair is a full day, not zero — there is no
 * such thing as a zero-length event in this picker.
 *
 * @param {number} endMin
 * @param {number} startMin
 * @returns {number} 1-1440
 */
export function wrapDuration(endMin, startMin) {
  const diff = (endMin - startMin + 1440) % 1440;
  return diff === 0 ? 1440 : diff;
}
