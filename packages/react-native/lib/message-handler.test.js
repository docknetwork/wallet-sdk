import {getRpcClient} from '@docknetwork/wallet-sdk-wasm/src/rpc-client';
import {WebviewEventHandler, MessageDispatcher} from './message-handler';
import rnRpcServer from './rn-rpc-server';

const testData = {test: true};

function createTestEvent(type, data = testData) {
  return {
    nativeEvent: {
      data: JSON.stringify({
        body: data,
        type,
      }),
    },
  };
}

describe('MessageDispatcher', () => {
  let mockWebView;
  let getWebView;
  let dispatcher;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockWebView = {
      injectJavaScript: jest.fn(),
    };

    getWebView = jest.fn(() => mockWebView);
    dispatcher = new MessageDispatcher(getWebView);
  });

  afterEach(() => {
    dispatcher.destroy();
    jest.useRealTimers();
  });

  describe('dispatch', () => {
    it('should send message immediately when WebView is available', () => {
      const type = 'test-type';
      const body = {data: 'test-data'};

      dispatcher.dispatch(type, body);

      expect(getWebView).toHaveBeenCalledWith(body);
      expect(mockWebView.injectJavaScript).toHaveBeenCalledTimes(1);
      expect(mockWebView.injectJavaScript.mock.calls[0][0]).toContain(
        JSON.stringify({type, body})
      );
    });

    it('should queue message when WebView is unavailable', () => {
      getWebView.mockReturnValue(null);
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();

      const type = 'test-type';
      const body = {data: 'test-data'};

      dispatcher.dispatch(type, body);

      expect(mockWebView.injectJavaScript).not.toHaveBeenCalled();
      expect(dispatcher.queue).toHaveLength(1);
      expect(dispatcher.queue[0]).toEqual({type, body});
      expect(consoleWarn).toHaveBeenCalledWith('WebView unavailable, queuing message');

      consoleWarn.mockRestore();
    });
  });

  describe('queue processing', () => {
    it('should process queued messages when WebView becomes available', () => {
      getWebView.mockReturnValue(null);
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();

      // Queue some messages
      dispatcher.dispatch('type1', {data: 'message1'});
      dispatcher.dispatch('type2', {data: 'message2'});

      expect(dispatcher.queue).toHaveLength(2);

      // Make WebView available
      getWebView.mockReturnValue(mockWebView);

      // Fast-forward time to trigger queue processing
      jest.advanceTimersByTime(5000);

      expect(mockWebView.injectJavaScript).toHaveBeenCalledTimes(2);
      expect(dispatcher.queue).toHaveLength(0);

      consoleWarn.mockRestore();
    });

    it('should keep messages queued if WebView is still unavailable', () => {
      getWebView.mockReturnValue(null);
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();

      dispatcher.dispatch('type1', {data: 'message1'});
      dispatcher.dispatch('type2', {data: 'message2'});

      expect(dispatcher.queue).toHaveLength(2);

      // Trigger queue processing but WebView still unavailable
      jest.advanceTimersByTime(5000);

      expect(mockWebView.injectJavaScript).not.toHaveBeenCalled();
      expect(dispatcher.queue).toHaveLength(2);
      expect(consoleWarn).toHaveBeenCalledWith('2 message(s) still queued');

      consoleWarn.mockRestore();
    });

    it('should not process queue concurrently', () => {
      getWebView.mockReturnValue(null);
      jest.spyOn(console, 'warn').mockImplementation();

      dispatcher.dispatch('type1', {data: 'message1'});

      dispatcher.isProcessing = true;

      jest.advanceTimersByTime(5000);

      // Should not process because isProcessing is true
      expect(dispatcher.queue).toHaveLength(1);
    });
  });

  describe('destroy', () => {
    it('should clear interval and queue', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      // Queue a message when WebView is unavailable
      getWebView.mockReturnValue(null);
      jest.spyOn(console, 'warn').mockImplementation();

      dispatcher.dispatch('type1', {data: 'message1'});
      expect(dispatcher.queue).toHaveLength(1);

      dispatcher.destroy();

      expect(clearIntervalSpy).toHaveBeenCalled();
      expect(dispatcher.intervalId).toBeNull();
      expect(dispatcher.queue).toHaveLength(0);
    });
  });
});

describe('WebviewEventHandler', () => {
  const webViewRef = {
    current: {
      injectJavaScript: jest.fn(),
    },
  };
  const sandboxWebViewRef = {
    current: {
      injectJavaScript: jest.fn(),
    },
  };
  const onReady = jest.fn();
  let eventHandler: WebviewEventHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    if (eventHandler) {
      eventHandler.destroy();
    }
    jest.useRealTimers();
  });

  beforeAll(() => {
    eventHandler = new WebviewEventHandler({
      onReady,
      webViewRef,
      sandboxWebViewRef,
    });

    jest.spyOn(eventHandler, '_handleRpcResponse');
    jest.spyOn(eventHandler, '_handleRpcRequest');
    jest.spyOn(eventHandler, '_handleRpcReady');
    jest.spyOn(eventHandler, '_handleLog');
    jest
      .spyOn(rnRpcServer, 'receive')
      .mockImplementation(data => Promise.resolve(data));
    jest
      .spyOn(getRpcClient(), 'receive')
      .mockImplementation(data => Promise.resolve(data));
  });

  it('expect to create message handler', () => {
    expect(eventHandler.webViewRef).toBe(webViewRef);
    expect(eventHandler.sandboxWebViewRef).toBe(sandboxWebViewRef);
    expect(eventHandler.onReady).toBe(onReady);
    expect(eventHandler.dispatcher).toBeDefined();
  });

  it('expect to handle json-rpc-ready event', async () => {
    const event = createTestEvent('json-rpc-ready');

    await eventHandler.handleEvent(event);

    expect(eventHandler._handleRpcReady).toBeCalled();
    expect(onReady).toBeCalled();
  });

  it('expect to handle json-rpc-response event', async () => {
    const event = createTestEvent('json-rpc-response');
    await eventHandler.handleEvent(event);
    expect(eventHandler._handleRpcResponse).toBeCalled();
  });

  it('expect to handle json-rpc-request event', async () => {
    const event = createTestEvent('json-rpc-request');
    await eventHandler.handleEvent(event);
    expect(eventHandler._handleRpcRequest).toBeCalled();
    expect(rnRpcServer.receive).toBeCalled();
  });

  it('expect to handle log event', async () => {
    const event = createTestEvent('log');
    await eventHandler.handleEvent(event);
    expect(eventHandler._handleLog).toBeCalled();
  });

  it('expect to dispatchEvent to webview', async () => {
    const body = {test: true};
    await eventHandler._dispatchEvent('test', body);
    expect(webViewRef.current.injectJavaScript).toBeCalled();
  });

  it('should use sandbox webview for sandbox messages', () => {
    const freshWebViewRef = {
      current: {
        injectJavaScript: jest.fn(),
      },
    };
    const freshSandboxWebViewRef = {
      current: {
        injectJavaScript: jest.fn(),
      },
    };

    const handler = new WebviewEventHandler({
      onReady: jest.fn(),
      webViewRef: freshWebViewRef,
      sandboxWebViewRef: freshSandboxWebViewRef,
    });

    const body = {method: 'sandbox-testMethod', data: 'test'};

    handler._dispatchEvent('test', body);

    expect(freshSandboxWebViewRef.current.injectJavaScript).toHaveBeenCalled();
    expect(freshWebViewRef.current.injectJavaScript).not.toHaveBeenCalled();

    handler.destroy();
  });

  it('should strip sandbox- prefix from method name', () => {
    const freshWebViewRef = {
      current: {
        injectJavaScript: jest.fn(),
      },
    };
    const freshSandboxWebViewRef = {
      current: {
        injectJavaScript: jest.fn(),
      },
    };

    const handler = new WebviewEventHandler({
      onReady: jest.fn(),
      webViewRef: freshWebViewRef,
      sandboxWebViewRef: freshSandboxWebViewRef,
    });

    const body = {method: 'sandbox-testMethod', data: 'test'};

    handler._dispatchEvent('test', body);

    const injectedScript = freshSandboxWebViewRef.current.injectJavaScript.mock.calls[0][0];
    expect(injectedScript).toContain('"method":"testMethod"');
    expect(injectedScript).not.toContain('sandbox-');

    handler.destroy();
  });

  it('should queue messages when webview is unavailable', () => {
    const handler = new WebviewEventHandler({
      onReady: jest.fn(),
      webViewRef: {current: null},
      sandboxWebViewRef: {current: null},
    });

    const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();

    handler._dispatchEvent('test', {data: 'test'});

    expect(handler.dispatcher.queue).toHaveLength(1);
    expect(consoleWarn).toHaveBeenCalledWith('WebView unavailable, queuing message');

    handler.destroy();
    consoleWarn.mockRestore();
  });

  it('should cleanup on destroy', () => {
    const handler = new WebviewEventHandler({
      onReady: jest.fn(),
      webViewRef,
      sandboxWebViewRef,
    });

    const destroySpy = jest.spyOn(handler.dispatcher, 'destroy');

    handler.destroy();

    expect(destroySpy).toHaveBeenCalled();
  });
});
