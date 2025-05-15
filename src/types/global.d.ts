/**
 * Global TypeScript declarations
 */

declare global {
  namespace NodeJS {
    interface Global {
      projectSyncInProgress?: boolean;
    }
  }
}

export {};
