import { createDomainStore } from "@/lib/stores/core";

export interface Credential {
  hash: string;
  changedAt: string;
}

/**
 * Per-user password hashes. A user with no entry signs in with the demo password.
 * Hashes are never exported with "Export all data".
 */
export interface CredentialState {
  credentials: Record<string, Credential>;
  set: (staffId: string, credential: Credential) => void;
  clear: (staffId: string) => void;
  reset: () => void;
}

export const useCredentialStore = createDomainStore<CredentialState>("credentials", (set) => ({
  credentials: {},
  set: (staffId, credential) =>
    set((s) => {
      s.credentials[staffId] = credential;
    }),
  clear: (staffId) =>
    set((s) => {
      delete s.credentials[staffId];
    }),
  reset: () =>
    set((s) => {
      s.credentials = {};
    }),
}));
