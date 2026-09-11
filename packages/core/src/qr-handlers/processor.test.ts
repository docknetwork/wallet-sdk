import {DefaultQRCodeProcessor, createQRCodeProcessor} from './processor';
import {
  QRCodeContext,
  QRCodeHandler,
  QRCodeHandlerResult,
} from './types';

describe('DefaultQRCodeProcessor', () => {
  let processor: DefaultQRCodeProcessor;

  beforeEach(() => {
    processor = new DefaultQRCodeProcessor();
  });

  describe('Handler Registration', () => {
    it('should register a handler successfully', () => {
      const handler: QRCodeHandler = {
        id: 'test-handler',
        canHandle: () => true,
        handle: async () => ({success: true}),
      };

      processor.registerHandler(handler);
      expect(processor.getHandlers()).toHaveLength(1);
      expect(processor.getHandler('test-handler')).toBe(handler);
    });

    it('should throw error when registering handler with duplicate ID', () => {
      const handler1: QRCodeHandler = {
        id: 'test-handler',
        canHandle: () => true,
        handle: async () => ({success: true}),
      };

      const handler2: QRCodeHandler = {
        id: 'test-handler',
        canHandle: () => true,
        handle: async () => ({success: true}),
      };

      processor.registerHandler(handler1);
      expect(() => processor.registerHandler(handler2)).toThrow(
        'Handler with id "test-handler" is already registered',
      );
    });

    it('should unregister a handler successfully', () => {
      const handler: QRCodeHandler = {
        id: 'test-handler',
        canHandle: () => true,
        handle: async () => ({success: true}),
      };

      processor.registerHandler(handler);
      expect(processor.getHandlers()).toHaveLength(1);

      const removed = processor.unregisterHandler('test-handler');
      expect(removed).toBe(true);
      expect(processor.getHandlers()).toHaveLength(0);
    });

    it('should return false when unregistering non-existent handler', () => {
      const removed = processor.unregisterHandler('non-existent');
      expect(removed).toBe(false);
    });

    it('should clear all handlers', () => {
      processor.registerHandler({
        id: 'handler-1',
        canHandle: () => true,
        handle: async () => ({success: true}),
      });
      processor.registerHandler({
        id: 'handler-2',
        canHandle: () => true,
        handle: async () => ({success: true}),
      });

      expect(processor.getHandlers()).toHaveLength(2);
      processor.clearHandlers();
      expect(processor.getHandlers()).toHaveLength(0);
    });
  });

  describe('Handler Priority', () => {
    it('should sort handlers by priority', () => {
      const handler1: QRCodeHandler = {
        id: 'handler-1',
        priority: 50,
        canHandle: () => true,
        handle: async () => ({success: true}),
      };

      const handler2: QRCodeHandler = {
        id: 'handler-2',
        priority: 10,
        canHandle: () => true,
        handle: async () => ({success: true}),
      };

      const handler3: QRCodeHandler = {
        id: 'handler-3',
        priority: 30,
        canHandle: () => true,
        handle: async () => ({success: true}),
      };

      processor.registerHandler(handler1);
      processor.registerHandler(handler2);
      processor.registerHandler(handler3);

      const handlers = processor.getHandlers();
      expect(handlers[0].id).toBe('handler-2');
      expect(handlers[1].id).toBe('handler-3');
      expect(handlers[2].id).toBe('handler-1');
    });

    it('should use default priority of 100 if not specified', () => {
      const handler1: QRCodeHandler = {
        id: 'handler-1',
        canHandle: () => true,
        handle: async () => ({success: true}),
      };

      const handler2: QRCodeHandler = {
        id: 'handler-2',
        priority: 50,
        canHandle: () => true,
        handle: async () => ({success: true}),
      };

      processor.registerHandler(handler1);
      processor.registerHandler(handler2);

      const handlers = processor.getHandlers();
      expect(handlers[0].id).toBe('handler-2'); // priority 50
      expect(handlers[1].id).toBe('handler-1'); // default priority 100
    });
  });

  describe('QR Code Processing', () => {
    it('should process QR code with matching handler', async () => {
      const handler: QRCodeHandler = {
        id: 'test-handler',
        canHandle: (context) => context.data.startsWith('test://'),
        handle: async (context) => ({
          success: true,
          data: {processed: context.data},
        }),
      };

      processor.registerHandler(handler);
      const result = await processor.process('test://some-data');

      expect(result.success).toBe(true);
      expect(result.data).toEqual({processed: 'test://some-data'});
      expect(result.metadata?.handlerId).toBe('test-handler');
    });

    it('should fail when no handlers are registered', async () => {
      const result = await processor.process('test://data');

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('No handlers registered');
    });

    it('should fail when no handler can process the data', async () => {
      const handler: QRCodeHandler = {
        id: 'test-handler',
        canHandle: () => false,
        handle: async () => ({success: true}),
      };

      processor.registerHandler(handler);
      const result = await processor.process('test://data');

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('No handler could process');
    });

    it('should try handlers in priority order', async () => {
      const executionOrder: string[] = [];

      const handler1: QRCodeHandler = {
        id: 'handler-1',
        priority: 50,
        canHandle: () => true,
        handle: async () => {
          executionOrder.push('handler-1');
          return {success: false};
        },
      };

      const handler2: QRCodeHandler = {
        id: 'handler-2',
        priority: 10,
        canHandle: () => true,
        handle: async () => {
          executionOrder.push('handler-2');
          return {success: true};
        },
      };

      processor.registerHandler(handler1);
      processor.registerHandler(handler2);

      // handler2 (priority 10) succeeds and would stop execution by default,
      // so disable stopOnFirstSuccess to observe the full priority order.
      await processor.process('test://data', {stopOnFirstSuccess: false});

      expect(executionOrder).toEqual(['handler-2', 'handler-1']);
    });

    it('should stop on first successful handler by default', async () => {
      const executionOrder: string[] = [];

      const handler1: QRCodeHandler = {
        id: 'handler-1',
        priority: 10,
        canHandle: () => true,
        handle: async () => {
          executionOrder.push('handler-1');
          return {success: true};
        },
      };

      const handler2: QRCodeHandler = {
        id: 'handler-2',
        priority: 20,
        canHandle: () => true,
        handle: async () => {
          executionOrder.push('handler-2');
          return {success: true};
        },
      };

      processor.registerHandler(handler1);
      processor.registerHandler(handler2);

      await processor.process('test://data');

      expect(executionOrder).toEqual(['handler-1']);
    });

    it('should continue to other handlers when stopOnFirstSuccess is false', async () => {
      const executionOrder: string[] = [];

      const handler1: QRCodeHandler = {
        id: 'handler-1',
        priority: 10,
        canHandle: () => true,
        handle: async () => {
          executionOrder.push('handler-1');
          return {success: true};
        },
      };

      const handler2: QRCodeHandler = {
        id: 'handler-2',
        priority: 20,
        canHandle: () => true,
        handle: async () => {
          executionOrder.push('handler-2');
          return {success: true};
        },
      };

      processor.registerHandler(handler1);
      processor.registerHandler(handler2);

      await processor.process('test://data', {stopOnFirstSuccess: false});

      expect(executionOrder).toEqual(['handler-1', 'handler-2']);
    });

    it('should skip handlers that cannot handle the data', async () => {
      const executionOrder: string[] = [];

      const handler1: QRCodeHandler = {
        id: 'handler-1',
        priority: 10,
        canHandle: () => false,
        handle: async () => {
          executionOrder.push('handler-1');
          return {success: true};
        },
      };

      const handler2: QRCodeHandler = {
        id: 'handler-2',
        priority: 20,
        canHandle: () => true,
        handle: async () => {
          executionOrder.push('handler-2');
          return {success: true};
        },
      };

      processor.registerHandler(handler1);
      processor.registerHandler(handler2);

      await processor.process('test://data');

      expect(executionOrder).toEqual(['handler-2']);
    });

    it('should handle async canHandle method', async () => {
      const handler: QRCodeHandler = {
        id: 'test-handler',
        canHandle: async (context) => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return context.data.startsWith('test://');
        },
        handle: async () => ({success: true}),
      };

      processor.registerHandler(handler);
      const result = await processor.process('test://data');

      expect(result.success).toBe(true);
    });

    it('should continue to next handler when one throws error', async () => {
      const handler1: QRCodeHandler = {
        id: 'handler-1',
        priority: 10,
        canHandle: () => true,
        handle: async () => {
          throw new Error('Handler 1 error');
        },
      };

      const handler2: QRCodeHandler = {
        id: 'handler-2',
        priority: 20,
        canHandle: () => true,
        handle: async () => ({success: true, data: 'processed'}),
      };

      processor.registerHandler(handler1);
      processor.registerHandler(handler2);

      const result = await processor.process('test://data');

      expect(result.success).toBe(true);
      expect(result.data).toBe('processed');
    });
  });

  describe('Context Preparation', () => {
    it('should prepare context with JSON data', async () => {
      const jsonData = {type: 'credential', id: '123'};
      const handler: QRCodeHandler = {
        id: 'test-handler',
        canHandle: (context) => context.jsonData?.type === 'credential',
        handle: async (context) => ({success: true, data: context.jsonData}),
      };

      processor.registerHandler(handler);
      const result = await processor.process(JSON.stringify(jsonData));

      expect(result.success).toBe(true);
      expect(result.data).toEqual(jsonData);
    });

    it('should prepare context with URL', async () => {
      const handler: QRCodeHandler = {
        id: 'test-handler',
        canHandle: (context) => !!context.url,
        handle: async (context) => ({success: true, data: {url: context.url}}),
      };

      processor.registerHandler(handler);
      const result = await processor.process('https://example.com/credential');

      expect(result.success).toBe(true);
      expect(result.data.url).toBe('https://example.com/credential');
    });

    it('should use custom prepareContext function', async () => {
      const handler: QRCodeHandler = {
        id: 'test-handler',
        canHandle: (context) => context.metadata?.custom === true,
        handle: async (context) => ({success: true, data: context.metadata}),
      };

      processor.registerHandler(handler);

      const result = await processor.process('test://data', {
        prepareContext: async (data) => ({
          data,
          metadata: {custom: true, value: 'test'},
        }),
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({custom: true, value: 'test'});
    });
  });

  describe('Callbacks', () => {
    it('should call onSuccess callback when handler succeeds', async () => {
      const onSuccess = jest.fn();
      const handler: QRCodeHandler = {
        id: 'test-handler',
        canHandle: () => true,
        handle: async () => ({success: true, data: 'result'}),
      };

      processor.registerHandler(handler);
      await processor.process('test://data', {onSuccess});

      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({success: true, data: 'result'}),
        handler,
      );
    });

    it('should call onError callback when handler throws', async () => {
      const onError = jest.fn();
      const error = new Error('Handler error');
      const handler: QRCodeHandler = {
        id: 'test-handler',
        canHandle: () => true,
        handle: async () => {
          throw error;
        },
      };

      processor.registerHandler(handler);
      await processor.process('test://data', {onError});

      expect(onError).toHaveBeenCalledWith(error, handler);
    });

    it('should not fail if callback throws error', async () => {
      const onSuccess = jest.fn(() => {
        throw new Error('Callback error');
      });

      const handler: QRCodeHandler = {
        id: 'test-handler',
        canHandle: () => true,
        handle: async () => ({success: true}),
      };

      processor.registerHandler(handler);
      const result = await processor.process('test://data', {onSuccess});

      expect(result.success).toBe(true);
    });
  });

  describe('Timeout', () => {
    it('should timeout handler that takes too long', async () => {
      const handler: QRCodeHandler = {
        id: 'slow-handler',
        canHandle: () => true,
        handle: async () => {
          await new Promise(resolve => setTimeout(resolve, 1000));
          return {success: true};
        },
      };

      processor.registerHandler(handler);
      const result = await processor.process('test://data', {timeout: 100});

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('timed out');
    });

    it('should use default timeout of 30 seconds', async () => {
      const handler: QRCodeHandler = {
        id: 'test-handler',
        canHandle: () => true,
        handle: async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return {success: true};
        },
      };

      processor.registerHandler(handler);
      const result = await processor.process('test://data');

      expect(result.success).toBe(true);
    });
  });

  describe('Factory Function', () => {
    it('should create processor with handlers', () => {
      const handler1: QRCodeHandler = {
        id: 'handler-1',
        canHandle: () => true,
        handle: async () => ({success: true}),
      };

      const handler2: QRCodeHandler = {
        id: 'handler-2',
        canHandle: () => true,
        handle: async () => ({success: true}),
      };

      const proc = createQRCodeProcessor([handler1, handler2]);

      expect(proc.getHandlers()).toHaveLength(2);
      expect(proc.getHandler('handler-1')).toBeDefined();
      expect(proc.getHandler('handler-2')).toBeDefined();
    });

    it('should create processor without handlers', () => {
      const proc = createQRCodeProcessor();

      expect(proc.getHandlers()).toHaveLength(0);
    });
  });
});
