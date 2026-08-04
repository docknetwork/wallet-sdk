// Helper to setup the RPC client and server for Node.js environment when running unit tests
import {getRpcClient, initRpcClient} from './rpc-client';
import rpcServer from './rpc-server';

initRpcClient(req => {
  return rpcServer.receive(req).then(result => {
    getRpcClient().receive(result);

    return result;
  });
});
