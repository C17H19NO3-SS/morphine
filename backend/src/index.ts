import chalk from "chalk";
import dotenv from "dotenv";
import Elysia from "elysia";
import { swagger } from "@elysiajs/swagger";
import { staticPlugin } from "@elysiajs/static";
import { HomeController } from "./Controllers/Home";
import { ApiController } from "./Controllers/api/api";
import { Database } from "./Lib/Database";
import { Logger } from "./Lib/Logger";
import { rateLimit } from "elysia-rate-limit";
import { ExtensionManager } from "./Lib/Extension";
dotenv.config({ quiet: true });

// Redirect console.error to persistent logger
{
  const originalError = console.error.bind(console);
  console.error = (...args: any[]) => {
    void Logger.error(...args);
    // Also print to stderr for visibility
    originalError(...args);
  };
}

const app = new Elysia();

const extensionManager = new ExtensionManager(true, () => {
  app.use(extensionManager.app).use(
    swagger({
      documentation: {
        info: { version: "1.0.0", title: "Morphine API v1.0.0" },
        tags: [{ name: "Authentication" }],
      },
    })
  );

  app.listen(3000, () => {
    console.log(chalk.green("Server started on port 3000"));
  });
});

app
  .use(
    rateLimit({
      duration: 60 * 10,
      max: 100,
    })
  )
  // .use(
  //   staticPlugin({
  //     indexHTML: true,
  //     prefix: "",
  //   })
  // )
  .use(HomeController)
  .use(ApiController);

// Global error capture
process.on("uncaughtException", (err) => {
  void Logger.fromError(err);
});

process.on("unhandledRejection", (reason) => {
  void Logger.fromError(reason as any);
});

app.onError(({ error }) => {
  void Logger.fromError(error);
});
