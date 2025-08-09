import type { ExtensionUtils } from "../../types/types";

export const init = (utils: ExtensionUtils) => {
  utils.log(`[${utils.name}] initializing...`);

  // Mount static files (served under /extensions/<name>/)
  utils.mountStatic();

  // Simple API route for the extension
  utils.app.get("/", () => ({ message: `Hello from ${utils.name}` }));
  utils.app.get("/abc", () => ({ ok: true }));
};
