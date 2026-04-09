# Matrix Rust Crypto Migration

This branch starts replacing Eulesia's bespoke browser E2EE state with the
Matrix Rust crypto stack exposed through
`@matrix-org/matrix-sdk-crypto-wasm`.

## Why

The current client-side E2EE implementation owns too much protocol logic:

- custom X3DH/session establishment in `apps/web/src/lib/crypto/session.ts`
- custom pairwise message envelopes in
  `apps/web/src/lib/e2ee/messageEncryptor.ts`
- custom sender-key state and ratcheting in
  `apps/web/src/lib/crypto/senderKeys.ts`
- raw IndexedDB persistence for long-term secrets in
  `apps/web/src/lib/crypto/store.ts`

That is too much unaudited protocol surface area to keep extending.

## Chosen stack

We are standardizing on:

- Rust state machine: `matrix-sdk-crypto`
- Browser binding: `@matrix-org/matrix-sdk-crypto-wasm`
- Underlying Olm/Megolm implementation: `vodozemac`

The important property for Eulesia is that `OlmMachine` is a no-network-IO
state machine. It owns crypto state and produces explicit outgoing requests
which the application must transport and acknowledge.

## What this PR changes

- adds the Matrix WASM dependency to the web client
- introduces a runtime E2EE backend boundary (`legacy` vs `matrix`)
- initializes an `OlmMachine` for the authenticated local device when
  `VITE_E2EE_BACKEND=matrix`
- introduces stable ID mapping from Eulesia UUIDs to Matrix-style IDs

This is an intentional seam for deleting bespoke crypto code incrementally.

## ID mapping

The Matrix crypto engine requires Matrix-shaped identifiers even when used
outside a Matrix homeserver.

- user: `@<uuid>:eulesia.invalid`
- device: `<uuid-without-dashes-uppercase>`
- room: `!<conversation-uuid>:eulesia.invalid`

The mapping lives in `apps/web/src/lib/e2ee/matrixIds.ts`.

## Required adapter work

To fully replace the bespoke layers, Eulesia needs an application adapter
between `OlmMachine` and the current server API.

### 1. Keys upload

Current Eulesia endpoints:

- `POST /devices`
- `POST /devices/{id}/pre-keys`

Matrix machine output:

- `KeysUploadRequest`

Adapter task:

- translate Matrix account identity keys, device keys, signed one-time keys,
  and fallback keys into Eulesia device registration and pre-key uploads
- persist enough server metadata to reconnect the Matrix machine to the
  existing Eulesia `devices` table

### 2. Device queries

Current Eulesia endpoint:

- `GET /users/{id}/devices`

Matrix machine output:

- `KeysQueryRequest`

Adapter task:

- fetch Eulesia devices for tracked users
- synthesize a Matrix `/keys/query` response body for
  `markRequestAsSent(..., RequestType.KeysQuery, ...)`

### 3. One-time key claims / Olm session establishment

Current Eulesia endpoint:

- `GET /devices/{id}/pre-key-bundle?userId=<id>`

Matrix machine output:

- `KeysClaimRequest`

Adapter task:

- translate key claims into Eulesia pre-key bundle fetches
- synthesize a Matrix `/keys/claim` response body

### 4. To-device transport

Current Eulesia transport:

- queued per-device ciphertexts in `message_device_queue`
- websocket `new_message` invalidation

Matrix machine output:

- `ToDeviceRequest`

Adapter task:

- add a first-class server endpoint for encrypted to-device payload delivery,
  or
- encode Matrix to-device payloads into the existing device queue without
  losing request identity and replay semantics

### 5. Group encryption

Current Eulesia group protocol:

- bespoke sender-key distribution (`skd`)

Matrix machine output:

- `shareRoomKey(...)`
- `encryptRoomEvent(...)`
- `decryptRoomEvent(...)`

Adapter task:

- migrate group conversations from bespoke sender keys to Megolm room keys
- treat each Eulesia conversation as a Matrix-style room at the crypto layer

## Migration order

1. Keep the current server API stable and build a client-side adapter for
   `KeysUploadRequest`, `KeysQueryRequest`, and `KeysClaimRequest`.
2. Replace bespoke DM session establishment and message envelopes with
   `OlmMachine` to-device encryption.
3. Add first-class to-device transport on the server.
4. Replace bespoke group sender keys with Megolm room sessions.
5. Delete the legacy `apps/web/src/lib/crypto/*` protocol state gradually,
   keeping only app-level glue and persistence the Matrix machine still needs.
