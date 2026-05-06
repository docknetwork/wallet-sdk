import {blockchainService} from './blockchain/service';
import {walletService} from './wallet/service';
import {utilCryptoService} from './util-crypto/service';
import {storageService} from './storage/service';
import {didService} from './dids/service';
import {credentialService} from './credential/service';
import {relayService} from './relay-service/service';
import {pexService} from './pex/service';
import {edvService} from './edv/service';
import {delegationService} from './delegation/service';

export default [
  blockchainService,
  walletService,
  utilCryptoService,
  storageService,
  didService,
  credentialService,
  relayService,
  pexService,
  edvService,
  delegationService,
];
