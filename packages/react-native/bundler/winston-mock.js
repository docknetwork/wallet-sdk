const noop = () => {};

const loggerInstance = {
  info: console.log,
  warn: console.warn,
  error: console.error,
  debug: console.debug,
  log: console.log,
  add: noop,
  remove: noop,
  clear: noop,
  close: noop,
};

const winston = {
  createLogger: () => loggerInstance,
  format: {
    simple: () => ({}),
    combine: () => ({}),
    timestamp: () => ({}),
    printf: () => ({}),
    colorize: () => ({}),
    json: () => ({}),
    label: () => ({}),
    prettyPrint: () => ({}),
  },
  transports: {
    Console: class {},
    File: class {},
  },
  addColors: noop,
};

export default winston;
export const createLogger = winston.createLogger;
export const format = winston.format;
export const transports = winston.transports;
export const addColors = noop;
