import chalk from "chalk";
import { Database } from "./Database";

type AnyRecord = Record<string, unknown>;

const baseConsole = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

function toPlainString(value: unknown): string {
  if (value instanceof Error) return value.message;
  try {
    if (typeof value === "string") return value;
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function extractErrorParts(args: unknown[]): {
  stack: string;
  message: string;
  name: string;
  cause: string;
} {
  const firstError = args.find((a) => a instanceof Error) as Error | undefined;
  const message = args.map(toPlainString).join(" ");
  const stack = firstError?.stack ?? "";
  const name = firstError?.name ?? "Error";
  const causeValue = (firstError as AnyRecord)?.cause as unknown;
  const cause = toPlainString(causeValue ?? "");
  return { stack, message, name, cause };
}

export class Logger {
  static log(...args: unknown[]) {
    baseConsole.log(chalk.green(...(args as any[])));
  }

  static info(...args: unknown[]) {
    baseConsole.info(chalk.cyan(...(args as any[])));
  }

  static warn(...args: unknown[]) {
    baseConsole.warn(chalk.yellow(...(args as any[])));
  }

  static async error(...args: unknown[]) {
    baseConsole.error(chalk.red(...(args as any[])));
    try {
      const { stack, message, name, cause } = extractErrorParts(args);
      await Database.execute(
        "INSERT INTO errors (stack, message, name, cause) VALUES (?, ?, ?, ?)",
        stack.substring(0, 1024),
        message.substring(0, 1024),
        name.substring(0, 1024),
        cause.substring(0, 1024)
      );
    } catch (dbErr) {
      // Asla hatayı tekrar fırlatma; sessizce geç
      baseConsole.warn(
        chalk.yellow("[Logger] Failed to persist error to DB:"),
        dbErr
      );
    }
  }

  static async fromError(error: unknown) {
    const err =
      error instanceof Error ? error : new Error(toPlainString(error));
    return Logger.error(err);
  }
}
