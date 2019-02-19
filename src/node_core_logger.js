const LOG_LEVELS = {
  NONE: 0,
  ERROR: 1,
  NORMAL: 2,
  DEBUG: 3,
};

let logLevel = LOG_LEVELS.NORMAL;

const setLogLevel = type => {
  if (typeof type !== 'number') return;
  logLevel = type;
};

const logTime = () => {
  let nowDate = new Date();
  return nowDate.toLocaleDateString() + ' ' + nowDate.toLocaleTimeString([], { hour12: false });
};

const log = (...args) => {
  if (logLevel < LOG_LEVELS.NORMAL) return;
  console.log(logTime(), process.pid, '[INFO]', ...args);
};

const error = (...args) => {
  if (logLevel < LOG_LEVELS.ERROR) return;
  console.error(logTime(), process.pid, '[ERROR]', ...args);
};

const debug = (...args) => {
  if (logLevel < LOG_LEVELS.DEBUG) return;
  console.log(logTime(), process.pid, '[DEBUG]', ...args);
};

module.exports = {
  LOG_LEVELS,
  setLogLevel,
  log,
  error,
  debug,
};
