import assert from 'assert';
import {
  getRpcClient,
  initRpcClient,
} from '@docknetwork/wallet-sdk-wasm/src/rpc-client';

import {Logger} from '@docknetwork/wallet-sdk-wasm/src/core/logger';
import rnRpcServer from './rn-rpc-server';

export class MessageDispatcher {
  constructor(getWebView) {
    this.getWebView = getWebView;
    this.queue = [];
    this.intervalId = null;
    this.isProcessing = false;

    this._startProcessor();
  }

  dispatch(type, body) {
    const webView = this.getWebView(body);

    if (!webView) {
      this.queue.push({type, body});
      return;
    }

    this._send(webView, type, body);
  }

  _send(webView, type, body) {
    const {__isSandbox, ...cleanBody} = body;

    webView.injectJavaScript(`
      (function(){
        (navigator.appVersion.includes("Android") ? document : window).dispatchEvent(
          new MessageEvent('message', {data: ${JSON.stringify({type, body: cleanBody})}})
        );
      })();
    `);
  }

  _processQueue() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    const pending = [];

    while (this.queue.length > 0) {
      const {type, body} = this.queue.shift();

      try {
        const webView = this.getWebView(body);

        if (!webView) {
          pending.push({type, body});
          continue;
        }

        this._send(webView, type, body);
      } catch (err) {
        console.warn('Failed to process queued message, discarding:', err.message);
      }
    }

    if (pending.length > 0) {
      this.queue = pending;
    }

    this.isProcessing = false;
  }

  _startProcessor() {
    this.intervalId = setInterval(() => this._processQueue(), 5000);
  }

  destroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.queue = [];
  }
}

export class WebviewEventHandler {
  constructor({webViewRef, sandboxWebViewRef, onReady, debug}) {
    assert(!!webViewRef, 'webViewRef is required');

    this.webViewRef = webViewRef;
    this.sandboxWebViewRef = sandboxWebViewRef;
    this.onReady = onReady;
    this.debug = debug;

    Logger.info('WebviewEventHandler initialized with debug mode:', this.debug);

    this.dispatcher = new MessageDispatcher((body) => {
      const isSandbox = body?.__isSandbox;
      const ref = isSandbox ? this.sandboxWebViewRef : this.webViewRef;
      return ref.current;
    });
  }

  destroy() {
    this.dispatcher.destroy();
  }

  getEventMapping() {
    return {
      'json-rpc-ready': this._handleRpcReady,
      'json-rpc-response': this._handleRpcResponse,
      'json-rpc-request': this._handleRpcRequest,
      log: this._handleLog,
    };
  }

  handleSandboxEvent(event) {
    if (this.debug) {
      Logger.info('Received sandbox event:', event.nativeEvent.data);
    }

    const data = JSON.parse(event.nativeEvent.data);
    if (data.type === 'json-rpc-ready') {
      return;
    }

    const handler = this.getEventMapping()[data.type];

    handler.apply(this, [data]);
  }

  handleEvent(event) {
    if (this.debug) {
      Logger.info('Received event:', event.nativeEvent.data);
    }

    assert(!!event, 'event is required');
    const data = JSON.parse(event.nativeEvent.data);

    const handler = this.getEventMapping()[data.type];

    assert(!!handler, `handler not found for event ${data.type}`);

    handler.apply(this, [data]);
  }

  _dispatchEvent(type, body) {
    const isSandbox = body?.method?.startsWith('sandbox-');

    const processedBody = {
      ...body,
      __isSandbox: isSandbox,
    };

    if (isSandbox) {
      processedBody.method = body.method.replace('sandbox-', '');
    }

    if (this.debug) {
      Logger.info('Dispatching event:', {type, body: processedBody});
    }

    this.dispatcher.dispatch(type, processedBody);
  }

  _handleRpcReady() {
    initRpcClient(async jsonRPCRequest => {
      this._dispatchEvent('json-rpc-request', jsonRPCRequest);
      return jsonRPCRequest;
    });

    if (this.onReady) {
      this.onReady();
    }
  }

  /**
   * Handle data sent back from the webview layer
   * Its a response for a json-rpc-request event
   *
   * @param {*} data
   */
  _handleRpcResponse(data) {
    // console.log('', data);
    getRpcClient().receive(data.body);
  }

  /**
   * Handles a json rpc request from the webview
   * The react native rpc servier will handle it and dispatch a response event
   * @param {*} data
   */
  _handleRpcRequest(data) {
    console.log('response rpc request', data);

    rnRpcServer.receive(data.body).then(response => {
      this._dispatchEvent('json-rpc-response', response);
      return response;
    });
  }

  _handleLog(data) {
    Logger.info(data.body);
  }
}
