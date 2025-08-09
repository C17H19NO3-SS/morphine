import chalk from "chalk";
import { readdir, stat, readFile } from "fs/promises";
import Elysia from "elysia";
import { staticPlugin } from "@elysiajs/static";
import path, { join } from "path";
import vm from "node:vm";
import type { ExtensionUtils as ExtUtils, Manifest } from "../../types/types";

export class ExtensionManager {
  public app: Elysia<any>;
  private onLoad: () => void;
  constructor(
    loadAllExtensions: boolean = true,
    onLoad: () => void = () => {}
  ) {
    this.onLoad = onLoad;
    this.app = new Elysia({ prefix: "/extensions" });

    if (loadAllExtensions) {
      this.loadAllExtensions().then(() => {
        if (this.onLoad) this.onLoad();
      });
    }
  }

  async loadAllExtensions() {
    const extensionsRoot = process.env.EXTENSION_DIR as string;
    const extensionEntries = await readdir(extensionsRoot);
    for await (const entry of extensionEntries) {
      const extensionRoot = join(extensionsRoot, entry);
      const stats = await stat(extensionRoot);
      if (!stats.isDirectory()) continue;

      const manifestPath = path.join(extensionRoot, "manifest.json");
      let manifest: Manifest | null = null;
      try {
        const raw = await readFile(manifestPath, "utf8");
        manifest = JSON.parse(raw) as Manifest;
      } catch (error) {
        console.error(
          chalk.red(`Failed to read manifest at ${manifestPath}`),
          error
        );
        continue;
      }
      if (!manifest?.name || !manifest?.index) {
        console.warn(
          chalk.yellow(
            `Skipping extension at ${extensionRoot}: 'name' and 'index' are required in manifest.json`
          )
        );
        continue;
      }

      await this.loadExtension({
        modulePath: path.join(extensionRoot, manifest.index),
        manifest,
        root: extensionRoot,
      });
    }
  }

  async loadExtension(args: {
    modulePath: string;
    manifest: Manifest;
    root: string;
  }) {
    const { modulePath, manifest, root } = args;
    // Read and transpile TS -> JS
    let code: string;
    try {
      code = await Bun.file(modulePath).text();
    } catch (error) {
      console.error(
        chalk.red(`Failed to read extension module: ${modulePath}`),
        error
      );
      return;
    }
    let transpiled = code;
    try {
      const transpiler = new Bun.Transpiler({ loader: "ts" });
      transpiled = transpiler.transformSync(code);
    } catch (error) {
      console.error(
        chalk.red(`Failed to transpile extension module: ${modulePath}`),
        error
      );
      return;
    }
    // Strip ESM exports to allow running in vm Script
    transpiled = transpiled
      .replace(/\bexport\s+default\s+/g, "const __default__ = ")
      .replace(/\bexport\s+(const|let|var|function|class)\s+/g, "$1 ")
      .replace(/\bexport\s*\{[^}]*\};?/g, "");

    const extensionPrefix = `/${manifest.name.toLowerCase()}`;
    const extensionApp = new Elysia({ prefix: extensionPrefix });

    const utils: ExtUtils = {
      log: (...text: any[]) => console.log(chalk.green(...text)),
      error: (...text: any[]) => console.error(chalk.red(...text)),
      info: (...text: any[]) => console.info(chalk.cyan(...text)),
      warn: (...text: any[]) => console.warn(chalk.yellow(...text)),
      app: extensionApp,
      name: manifest.name,
      prefix: `/extensions${extensionPrefix}`,
      root,
      mountStatic: (
        relativeDir = manifest.publicDir || "public",
        urlPrefix = "/static",
        indexHTML = true
      ) => {
        const assetsDir = join(root, relativeDir);
        extensionApp.use(
          staticPlugin({
            assets: assetsDir,
            prefix: urlPrefix,
            indexHTML,
          })
        );
      },
    };

    // Build sandbox based on permissions
    const allowedConsole = manifest.permissions?.console as
      | boolean
      | {
          log?: boolean;
          info?: boolean;
          warn?: boolean;
          error?: boolean;
        }
      | undefined;
    const allowMethod = (m: "log" | "info" | "warn" | "error") =>
      allowedConsole === true ||
      (typeof allowedConsole === "object" && (allowedConsole?.[m] ?? true));
    const consoleProxy = {
      log: (...args: any[]) =>
        allowMethod("log") && utils.log(`[${manifest.name}]`, ...args),
      info: (...args: any[]) =>
        allowMethod("info") && utils.info(`[${manifest.name}]`, ...args),
      warn: (...args: any[]) =>
        allowMethod("warn") && utils.warn(`[${manifest.name}]`, ...args),
      error: (...args: any[]) =>
        allowMethod("error") && utils.error(`[${manifest.name}]`, ...args),
    } as unknown as Console;

    const timersAllowed = manifest.permissions?.timers === true;
    const networkAllowed = manifest.permissions?.network === true;
    const sandboxEnvKeys = manifest.permissions?.env ?? [];
    const envProxy: Record<string, string | undefined> = {};
    for (const key of sandboxEnvKeys) envProxy[key] = process.env[key];

    const moduleExports: Record<string, any> = {};
    const moduleObj = { exports: moduleExports } as any;
    const requireShim = (specifier: string) => {
      throw new Error(`require is not available in sandbox: ${specifier}`);
    };

    const context = vm.createContext({
      console: consoleProxy,
      fetch: networkAllowed ? fetch : undefined,
      setTimeout: timersAllowed ? setTimeout : undefined,
      setInterval: timersAllowed ? setInterval : undefined,
      process: { env: envProxy },
      URL,
      module: moduleObj,
      exports: moduleExports,
      require: requireShim,
    });

    const wrapper = `(async () => { ${transpiled}\n;return (typeof init!=="undefined"?init:module?.exports?.init); })()`;
    let init: (utils: ExtUtils) => any;
    try {
      const script = new vm.Script(wrapper, { filename: modulePath });
      const result = await script.runInContext(context, { timeout: 2000 });
      init = result as any;
      if (typeof init !== "function") throw new Error("init export not found");
    } catch (error) {
      console.error(
        chalk.red(`Failed to evaluate extension module: ${modulePath}`),
        error
      );
      return;
    }

    await init(utils);
    this.app.use(extensionApp);
  }
}
