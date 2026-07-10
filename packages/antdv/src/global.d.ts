/* eslint-disable @typescript-eslint/no-explicit-any */
declare const window: Window &
  typeof globalThis & {
    console: {
      log: (...args: any[]) => void;
    };
  };
