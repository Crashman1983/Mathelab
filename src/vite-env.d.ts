/// <reference types="vite/client" />

// Virtuelles Modul von vite-plugin-pwa — nur im PWA-Build vorhanden.
// Typdeklaration damit tsc im normalen Build nicht klagt.
declare module "virtual:pwa-register/vanilla" {
  export type RegisterSWOptions = {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegisteredSW?: (swUrl: string, r: ServiceWorkerRegistration | undefined) => void;
    onRegisterError?: (error: unknown) => void;
  };
  export function registerSW(
    options?: RegisterSWOptions,
  ): (reloadPage?: boolean) => Promise<void>;
}
