// Minimal AsyncResource shim for browser environments
class AsyncResource {
  constructor(type) {
    this.type = type;
  }
  runInAsyncScope(fn, thisArg, ...args) {
    return fn.apply(thisArg, args);
  }
  emitDestroy() {}
}

module.exports = {AsyncResource};
