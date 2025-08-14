import type Elysia from "elysia";
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

export interface Manifest {
  version: string;
  name: string;
  author: string;
  index: string;
  env?: string;
  publicDir?: string;
  permissions?: {
    console?:
      | boolean
      | {
          log?: boolean;
          info?: boolean;
          warn?: boolean;
          error?: boolean;
        };
    network?: boolean; // fetch / Request allowed
    timers?: boolean; // setTimeout/setInterval allowed
    env?: string[]; // whitelist of env vars accessible via sandboxed process.env
  };
}

export interface ExtensionUtils {
  log: (...text: any[]) => void;
  error: (...text: any[]) => void;
  info: (...text: any[]) => void;
  warn: (...text: any[]) => void;
  app: Elysia<any>;
  name: string;
  prefix: string;
  root: string;
  mountStatic: (
    relativeDir?: string,
    urlPrefix?: string,
    indexHTML?: boolean
  ) => void;
  db: {
    query: <T = any>(query: string, ...parameters: any[]) => Promise<T[]>;
    execute: <T = any>(query: string, ...parameters: any[]) => Promise<T>;
  };
  bcrypt: {
    hash: (password: string, rounds?: number) => string;
    compare: (plain: string, hashed: string) => boolean;
  };
}
