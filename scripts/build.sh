#!/bin/bash
set -e

npm run build -w @docknetwork/wallet-sdk-data-store-typeorm
npm run build -w @docknetwork/wallet-sdk-data-store-web
npm run build -w @docknetwork/wallet-sdk-data-store
npm run build -w @docknetwork/wallet-sdk-wasm
npm run build -w @docknetwork/wallet-sdk-core
npm run build -w @docknetwork/wallet-sdk-dids
npm run build -w @docknetwork/wallet-sdk-relay-service
