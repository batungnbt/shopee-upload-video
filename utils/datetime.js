const moment = require('moment-timezone');

const APP_TIMEZONE = 'Asia/Ho_Chi_Minh';
const DEFAULT_PARSE_FORMATS = [
  'YYYY-MM-DD',
  'YYYY-MM-DDTHH:mm',
  'YYYY-MM-DDTHH:mm:ss',
  'YYYY-MM-DD HH:mm',
  'YYYY-MM-DD HH:mm:ss',
  moment.ISO_8601
];

function toMomentInAppTimezone(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (moment.isMoment(value)) {
    return value.clone().tz(APP_TIMEZONE);
  }

  if (value instanceof Date || typeof value === 'number') {
    const parsed = moment(value).tz(APP_TIMEZONE);
    return parsed.isValid() ? parsed : null;
  }

  const raw = String(value).trim();
  if (!raw) {
    return null;
  }

  let parsed = moment.tz(raw, DEFAULT_PARSE_FORMATS, true, APP_TIMEZONE);
  if (!parsed.isValid()) {
    parsed = moment(raw).tz(APP_TIMEZONE);
  }

  return parsed.isValid() ? parsed : null;
}

function nowMoment() {
  return moment.tz(APP_TIMEZONE);
}

function nowDate() {
  return nowMoment().toDate();
}

function parseDateInAppTimezone(value) {
  const parsed = toMomentInAppTimezone(value);
  return parsed ? parsed.toDate() : null;
}

function startOfDayInAppTimezone(value) {
  const parsed = value === undefined ? nowMoment() : toMomentInAppTimezone(value);
  return parsed ? parsed.startOf('day').toDate() : null;
}

function endOfDayInAppTimezone(value) {
  const parsed = value === undefined ? nowMoment() : toMomentInAppTimezone(value);
  return parsed ? parsed.endOf('day').toDate() : null;
}

function startOfTodayInAppTimezone() {
  return startOfDayInAppTimezone();
}

function startOfYesterdayInAppTimezone() {
  return nowMoment().subtract(1, 'day').startOf('day').toDate();
}

function addDaysInAppTimezone(value, days) {
  const parsed = toMomentInAppTimezone(value);
  return parsed ? parsed.add(Number(days) || 0, 'days').toDate() : null;
}

function addHoursInAppTimezone(value, hours) {
  const parsed = toMomentInAppTimezone(value);
  return parsed ? parsed.add(Number(hours) || 0, 'hours').toDate() : null;
}

function subtractDaysInAppTimezone(value, days) {
  const parsed = toMomentInAppTimezone(value);
  return parsed ? parsed.subtract(Number(days) || 0, 'days').toDate() : null;
}

function isSameDayInAppTimezone(first, second) {
  const firstMoment = toMomentInAppTimezone(first);
  const secondMoment = toMomentInAppTimezone(second);
  return !!(firstMoment && secondMoment && firstMoment.isSame(secondMoment, 'day'));
}

function formatDateInAppTimezone(value, format = 'YYYY-MM-DD') {
  const parsed = value === undefined ? nowMoment() : toMomentInAppTimezone(value);
  return parsed ? parsed.format(format) : '';
}

function getUnixDayRangeInAppTimezone(value) {
  const parsed = toMomentInAppTimezone(value);
  if (!parsed) {
    return { start_time: 0, end_time: 0 };
  }

  return {
    start_time: parsed.clone().startOf('day').unix(),
    end_time: parsed.clone().endOf('day').unix()
  };
}

function getMonthInAppTimezone(value) {
  const parsed = value === undefined ? nowMoment() : toMomentInAppTimezone(value);
  return parsed ? parsed.month() + 1 : 0;
}

function getYearInAppTimezone(value) {
  const parsed = value === undefined ? nowMoment() : toMomentInAppTimezone(value);
  return parsed ? parsed.year() : 0;
}

function getDayOfMonthInAppTimezone(value) {
  const parsed = toMomentInAppTimezone(value);
  return parsed ? parsed.date() : 0;
}

function getDaysInMonthInAppTimezone(year, month) {
  return moment.tz([Number(year), Number(month) - 1, 1], APP_TIMEZONE).daysInMonth();
}

module.exports = {
  APP_TIMEZONE,
  nowDate,
  parseDateInAppTimezone,
  startOfDayInAppTimezone,
  endOfDayInAppTimezone,
  startOfTodayInAppTimezone,
  startOfYesterdayInAppTimezone,
  addDaysInAppTimezone,
  addHoursInAppTimezone,
  subtractDaysInAppTimezone,
  isSameDayInAppTimezone,
  formatDateInAppTimezone,
  getUnixDayRangeInAppTimezone,
  getMonthInAppTimezone,
  getYearInAppTimezone,
  getDayOfMonthInAppTimezone,
  getDaysInMonthInAppTimezone
};
