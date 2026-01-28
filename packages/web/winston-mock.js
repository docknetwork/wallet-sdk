export default {
    createLogger: () => ({
        info: console.log,
        warn: console.warn,
        error: console.error,
        debug: console.debug,
    }),
    format: {
        simple: () => { },
    },
    transports: {
        Console: class { },
    },
};
