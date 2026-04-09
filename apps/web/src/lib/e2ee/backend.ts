import { E2EE_BACKEND } from "../runtimeConfig.ts";

export type E2eeBackend = "legacy" | "matrix";

export function getE2eeBackend(): E2eeBackend {
  return E2EE_BACKEND;
}

export function usingMatrixCrypto(): boolean {
  return getE2eeBackend() === "matrix";
}
