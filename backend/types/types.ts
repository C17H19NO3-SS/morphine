import type { Context } from "vm";

export interface UserInterface {
  id?: number;
  username: string;
  email: string;
  password?: string;
}

export interface UserTokenInterface {
  token: string;
}

export interface ExtensionManifest {
  version: string;
  author: string;
  index: string;
  name?: string;
  description?: string;
  dependencies?: string[];
  permissions?: string[];
}

export interface LoadedExtension {
  id: string;
  manifest: ExtensionManifest;
  context: Context;
  plugin: any;
  active: boolean;
  path: string;
  loadedAt: Date;
}
