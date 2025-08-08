declare const extension: {
  id: string;
  manifest: ExtensionManifest;
  path: string;
  emit: (event: string, data?: any) => void;
  on: (event: string, handler: (event: CustomEvent) => void) => void;
  onGlobal: (event: string, handler: (event: CustomEvent) => void) => void;
  sendToExtension: (targetId: string, event: string, data?: any) => void;
};
