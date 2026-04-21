const ConsoleTransport = {
  log: (message: string) => {
    console.log(message);
  },
  error: (message: string) => {
    console.error(message);
  },
  debug: (message: string) => {
    console.debug(message);
  },
  warn: (message: string) => {
    console.warn(message);
  },
  performance: (action: string, startTime: number) => {
    console.log(`[PERFORMANCE] ${action} in ${new Date().getTime() - startTime}ms`);
  },
};

export let logger = ConsoleTransport;

export function setLogger(impl: any) {
  logger = impl;
}

export const createLogger = (prefix: string) => {
  return {
    log: (message: string) => {
      logger.log(`[${prefix}] ${message}`);
    },
    error: (message: string) => {
      logger.error(`[${prefix}] ${message}`);
    },
    debug: (message: string) => {
      logger.debug(`[${prefix}] ${message}`);
    },
    warn: (message: string) => {
      logger.warn(`[${prefix}] ${message}`);
    },
    performance: (action: string, time: number) => {
      logger.log(`[PERFORMANCE] ${action} took ${time}ms`);
    }
  };
};
