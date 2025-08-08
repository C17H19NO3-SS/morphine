import chalk from "chalk";
import { stringToStructureCoercions } from "elysia/schema";
import { readdir, readFile, stat, exists } from "fs/promises";
import { join, basename } from "path";
import vm from "vm";
import type { ExtensionManifest, LoadedExtension } from "../../types/types";
import type Elysia from "elysia";

class PluginTranspiler {
  private cache = new Map<string, string>();
  private options: any;

  constructor(options: any = {}) {
    this.options = {
      target: options.target || "bun",
      minifyWhitespace: options.minify || false,
      minifyIdentifiers: options.minify || false,
      treeShaking: options.treeShaking || false,
    };
  }

  private getLoaderForFile(filePath: string): string {
    const ext = filePath.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "ts":
        return "ts";
      case "tsx":
        return "tsx";
      case "js":
        return "js";
      case "jsx":
        return "jsx";
      default:
        return "js"; // fallback
    }
  }

  async transpileFile(filePath: string): Promise<string> {
    const file = Bun.file(filePath);
    const cacheKey = `${filePath}-${file.lastModified}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      const loader = this.getLoaderForFile(filePath);
      const transpiler = new Bun.Transpiler({
        loader: loader as any,
        ...this.options,
      });

      const sourceCode = await file.text();
      const jsCode = await transpiler.transform(sourceCode);

      this.cache.set(cacheKey, jsCode);
      return jsCode;
    } catch (error) {
      console.error(`Failed to transpile ${filePath}:`, error);
      throw error;
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export class ExtensionManager {
  private extensions = new Map<string, LoadedExtension>();
  private eventBus = new EventTarget();
  private transpiler: PluginTranspiler;
  private extensionsPath: string;
  private app: Elysia;

  constructor(app: Elysia, extensionsPath = "./extensions") {
    this.extensionsPath = extensionsPath;
    this.transpiler = new PluginTranspiler();
    this.app = app;
  }

  // Tüm eklentileri tarayıp yükle
  async loadAllExtensions(): Promise<{ success: string[]; failed: string[] }> {
    const results = { success: [] as string[], failed: [] as string[] };

    try {
      // Extensions klasörünün var olup olmadığını kontrol et
      if (!(await exists(this.extensionsPath))) {
        console.warn(`Extensions directory not found: ${this.extensionsPath}`);
        return results;
      }

      const entries = await readdir(this.extensionsPath, {
        withFileTypes: true,
      });
      const extensionDirs = entries.filter((entry) => entry.isDirectory());

      console.log(
        chalk.green(`Found ${extensionDirs.length} potential extensions`)
      );

      for (const dir of extensionDirs) {
        const extensionId = dir.name;
        const extensionPath = join(this.extensionsPath, extensionId);

        try {
          await this.loadExtension(extensionId, extensionPath);
          results.success.push(extensionId);
          console.log(chalk.green(`✓ Extension loaded: ${extensionId}`));
        } catch (error) {
          results.failed.push(extensionId);
          console.error(
            chalk.red(`✗ Failed to load extension ${extensionId}:`),
            error
          );
        }
      }

      console.log(
        chalk.green(
          `Extensions loaded: ${results.success.length} success, ${results.failed.length} failed`
        )
      );
      return results;
    } catch (error) {
      console.error("Error scanning extensions directory:", error);
      throw error;
    }
  }

  // Tek bir eklentiyi yükle
  async loadExtension(
    extensionId: string,
    extensionPath?: string
  ): Promise<boolean> {
    if (!extensionPath) {
      extensionPath = join(this.extensionsPath, extensionId);
    }

    try {
      // Manifest dosyasını oku
      const manifest = await this.readManifest(extensionPath);

      // Index dosyasının yolunu belirle
      const indexPath = join(extensionPath, manifest.index);

      // Index dosyasının var olup olmadığını kontrol et
      if (!(await exists(indexPath))) {
        throw new Error(`Index file not found: ${manifest.index}`);
      }

      // TypeScript dosyasını JavaScript'e çevir
      const jsCode = await this.transpileExtension(indexPath);

      // Sandbox oluştur ve eklentiyi yükle
      const context = this.createSandbox(extensionId, manifest, extensionPath);
      const plugin = await this.executeExtension(jsCode, context, extensionId);

      // Eklentiyi kaydet
      const loadedExtension: LoadedExtension = {
        id: extensionId,
        manifest,
        context,
        plugin,
        active: true,
        path: extensionPath,
        loadedAt: new Date(),
      };

      this.extensions.set(extensionId, loadedExtension);

      // Initialize et
      if (plugin.init && typeof plugin.init === "function") {
        await plugin.init();
      }

      // Event emit et
      this.eventBus.dispatchEvent(
        new CustomEvent("extensionLoaded", {
          detail: { extensionId, manifest },
        })
      );

      return true;
    } catch (error) {
      console.error(`Failed to load extension ${extensionId}:`, error);
      throw error;
    }
  }

  // Manifest.json dosyasını oku ve validate et
  private async readManifest(
    extensionPath: string
  ): Promise<ExtensionManifest> {
    const manifestPath = join(extensionPath, "manifest.json");

    try {
      const manifestContent = await readFile(manifestPath, "utf-8");
      const manifest: ExtensionManifest = JSON.parse(manifestContent);

      // Required alanları kontrol et
      if (!manifest.version) throw new Error("Missing required field: version");
      if (!manifest.author) throw new Error("Missing required field: author");
      if (!manifest.index) throw new Error("Missing required field: index");

      // Default değerler
      manifest.name = manifest.name || basename(extensionPath);
      manifest.description = manifest.description || "No description provided";
      manifest.dependencies = manifest.dependencies || [];
      manifest.permissions = manifest.permissions || [];

      return manifest;
    } catch (error) {
      if ((error as { code: string }).code === "ENOENT") {
        throw new Error("manifest.json not found");
      }
      throw new Error(`Invalid manifest.json: ${(error as Error).message}`);
    }
  }

  // Extension dosyasını transpile et
  private async transpileExtension(indexPath: string): Promise<string> {
    const ext = indexPath.split(".").pop()?.toLowerCase();

    if (ext === "ts" || ext === "tsx") {
      return await this.transpiler.transpileFile(indexPath);
    } else if (ext === "js") {
      const file = Bun.file(indexPath);
      return await file.text();
    } else {
      throw new Error(`Unsupported file type: ${ext}`);
    }
  }

  // Extension için sandbox oluştur
  private createSandbox(
    extensionId: string,
    manifest: ExtensionManifest,
    extensionPath: string
  ): vm.Context {
    const sandbox = {
      // Console wrapper
      console: {
        log: (...args: any[]) =>
          console.log(chalk.green(`[${extensionId}]`, ...args)),
        error: (...args: any[]) =>
          console.error(chalk.red(`[${extensionId}]`, ...args)),
        warn: (...args: any[]) =>
          console.warn(chalk.yellow(`[${extensionId}]`, ...args)),
        info: (...args: any[]) =>
          console.info(chalk.yellow(`[${extensionId}]`, ...args)),
      },

      // Extension API
      extension: {
        id: extensionId,
        manifest: manifest,
        path: extensionPath,

        // Event system
        emit: (event: string, data?: any) => {
          this.eventBus.dispatchEvent(
            new CustomEvent(`extension:${extensionId}:${event}`, {
              detail: data,
            })
          );
        },

        on: (event: string, handler: (event: CustomEvent) => void) => {
          this.eventBus.addEventListener(
            `extension:${extensionId}:${event}`,
            handler as EventListener
          );
        },

        // Global event listening
        onGlobal: (event: string, handler: (event: CustomEvent) => void) => {
          this.eventBus.addEventListener(event, handler as EventListener);
        },

        // Extension iletişimi
        sendToExtension: (targetId: string, event: string, data?: any) => {
          this.eventBus.dispatchEvent(
            new CustomEvent(`extension:${targetId}:${event}`, {
              detail: { from: extensionId, data },
            })
          );
        },
      },

      // Güvenli utility fonksiyonları
      utils: {
        delay: (ms: number) =>
          new Promise((resolve) => setTimeout(resolve, ms)),

        // Dosya okuma (sadece kendi dizininden)
        readFile: async (filePath: string) => {
          const fullPath = join(extensionPath, filePath);
          if (!fullPath.startsWith(extensionPath)) {
            throw new Error(
              "Access denied: Cannot read files outside extension directory"
            );
          }
          const file = Bun.file(fullPath);
          return await file.text();
        },

        // HTTP istekleri (izin kontrolü ile)
        fetch: async (url: string, options?: RequestInit) => {
          if (!manifest.permissions?.includes("network")) {
            throw new Error("Network permission required");
          }
          return fetch(url, options);
        },
      },
    };

    return vm.createContext(sandbox);
  }

  // Extension kodunu çalıştır
  private async executeExtension(
    jsCode: string,
    context: vm.Context,
    extensionId: string
  ): Promise<any> {
    try {
      const result = vm.runInContext(
        `
        (function() {
          ${jsCode}
          
          // Extension'ın export etmesi gereken yapı
          const exportedModule = typeof module !== 'undefined' && module.exports ? module.exports : {};
          
          // ES6 exports desteği
          if (typeof exports !== 'undefined') {
            Object.assign(exportedModule, exports);
          }
          
          // Default export kontrolü
          if (exportedModule.default) {
            Object.assign(exportedModule, exportedModule.default);
          }
          
          return exportedModule;
        })()
      `,
        context,
        {
          displayErrors: true,
        }
      );

      return result;
    } catch (error) {
      throw new Error(
        `Extension execution failed: ${(error as Error).message}`
      );
    }
  }

  // Eklentiyi kaldır
  async unloadExtension(extensionId: string): Promise<boolean> {
    const extension = this.extensions.get(extensionId);
    if (!extension) {
      return false;
    }

    try {
      // Cleanup fonksiyonu varsa çağır
      if (
        extension.plugin.cleanup &&
        typeof extension.plugin.cleanup === "function"
      ) {
        await extension.plugin.cleanup();
      }
    } catch (error) {
      console.error(`Error during extension cleanup:`, error);
    }

    // Extension'ı kaldır
    this.extensions.delete(extensionId);

    // Event emit et
    this.eventBus.dispatchEvent(
      new CustomEvent("extensionUnloaded", {
        detail: { extensionId },
      })
    );

    return true;
  }

  // Eklenti yeniden yükle
  async reloadExtension(extensionId: string): Promise<boolean> {
    const extension = this.extensions.get(extensionId);
    if (!extension) {
      throw new Error(`Extension not found: ${extensionId}`);
    }

    const extensionPath = extension.path;

    await this.unloadExtension(extensionId);
    this.transpiler.clearCache();

    return await this.loadExtension(extensionId, extensionPath);
  }

  // Yüklü eklentileri listele
  listExtensions(): Array<{
    id: string;
    manifest: ExtensionManifest;
    active: boolean;
    loadedAt: Date;
  }> {
    return Array.from(this.extensions.entries()).map(([id, ext]) => ({
      id,
      manifest: ext.manifest,
      active: ext.active,
      loadedAt: ext.loadedAt,
    }));
  }

  // Eklenti durumunu kontrol et
  getExtension(extensionId: string): LoadedExtension | undefined {
    return this.extensions.get(extensionId);
  }

  // Event bus'a erişim
  getEventBus(): EventTarget {
    return this.eventBus;
  }

  // Tüm eklentileri kaldır
  async unloadAllExtensions(): Promise<void> {
    const extensionIds = Array.from(this.extensions.keys());

    for (const id of extensionIds) {
      await this.unloadExtension(id);
    }
  }
}
