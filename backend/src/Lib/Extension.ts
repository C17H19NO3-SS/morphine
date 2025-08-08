import fs from "fs";
import path from "path";
import vm from "vm";
import type { Manifest } from "../../types/types";
import { version } from "os";

export class Extensions {
  constructor(extensionsFolder: string) {
    fs.readdirSync(extensionsFolder).forEach(async (folder: string) => {
      const manifest: Manifest = JSON.parse(
        fs
          .readFileSync(path.join(extensionsFolder, folder, "manifest.json"))
          .toString()
      );

      const context = vm.createContext({
        ...manifest,
      });
    });
  }
}
