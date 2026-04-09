# Matrix Rust Crypto Migration

This branch replaces Eulesia's bespoke browser E2EE state with the
Matrix Rust crypto stack exposed through
`@matrix-org/matrix-sdk-crypto-wasm`.

## Why

The removed client-side E2EE implementation owned too much protocol logic:

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
- initializes an `OlmMachine` for the authenticated local device
- introduces stable ID mapping from Eulesia UUIDs to Matrix-style IDs
- routes DM Olm, hidden to-device protocol traffic, and group Megolm payloads
  through the Matrix Rust state machine
- removes the bespoke browser message/session/sender-key implementation from
  the active frontend crypto surface

This leaves only device registration compatibility glue around the existing
server-side device lifecycle.

## Current status on this branch

Implemented now:

- Matrix-shaped `/devices/{id}/matrix/keys/upload`,
  `/devices/matrix/keys/query`, and `/devices/matrix/keys/claim`
  endpoints backed by the existing `devices` table plus Matrix-specific key
  columns
- a browser-side adapter that drains `OlmMachine.outgoingRequests()` through
  those endpoints and acknowledges responses with `markRequestAsSent(...)`
- DM payloads encrypted through Matrix Olm to-device events and carried over
  the existing `device_ciphertexts` transport
- group room-key distribution carried through hidden Matrix to-device payloads
  over the existing per-device queue
- group message bodies encrypted as Megolm room events instead of the bespoke
  sender-key protocol

Still intentionally compatibility-only:

- device registration still goes through Eulesia's existing `POST /devices`
  lifecycle so pairing, revocation, and browser identity continuity stay
  stable while the crypto engine changes underneath

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

## Migration order

1. Keep the current server API stable and build a client-side adapter for
   `KeysUploadRequest`, `KeysQueryRequest`, and `KeysClaimRequest`.
2. Replace bespoke DM session establishment and message envelopes with
   `OlmMachine` to-device encryption.
3. Add first-class to-device transport on the server.
4. Replace bespoke group sender keys with Megolm room sessions.
5. Trim remaining compatibility-only device-registration glue once the server
   no longer needs legacy pre-key fields.
