import {JSONRPCServer} from 'json-rpc-2.0';
import {
  createRpcService,
  patchRpcServer,
} from '@docknetwork/wallet-sdk-wasm/src/rpc-util';
import {storageService} from './async-storage-service';
import {loggerService} from './logger';

const rpcServer = new JSONRPCServer();

patchRpcServer(rpcServer);

if (process.env.NODE_ENV !== 'test') {
  [storageService, loggerService].forEach(service => {
    const rpcService = createRpcService(service);
    rpcService.forEach(method => {
      rpcServer.addMethod(method.name, async params => {
        console.log(`Resolve method ${method.name} with params ${params}`);
        console.log(params);
        const result = await method.resolver(params);
        return result === undefined ? null : result;
      });
    });
  });
}

export default rpcServer;
