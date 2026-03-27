// Minimal diagnostics_channel shim for browser environments
function channel() {
  return {
    subscribe: function () {},
    unsubscribe: function () {},
    publish: function () {},
    hasSubscribers: false,
  };
}

module.exports = {channel: channel};
