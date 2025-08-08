import chalk from "chalk";
import dotenv from "dotenv";
import { Elysia } from "elysia";
1;
import { swagger } from "@elysiajs/swagger";
import { staticPlugin } from "@elysiajs/static";
import { HomeController } from "./Controllers/Home";
import { ApiController } from "./Controllers/api/api";
import { Database } from "./Lib/Database";
import { rateLimit } from "elysia-rate-limit";
import { ExtensionManager } from "./Lib/Extension";
dotenv.config({ quiet: true });

const app = new Elysia();

new ExtensionManager().loadAllExtensions();

app.use(
  swagger({
    documentation: {
      info: {
        version: "1.0.0",
        title: "Morphine API v1.0.0",
      },
      tags: [
        {
          name: "Authentication",
        },
      ],
    },
  })
);
app.use(
  rateLimit({
    duration: 60 * 10,
    max: 100,
  })
);
app.use(
  staticPlugin({
    indexHTML: true,
    prefix: "",
  })
);
app.use(HomeController);
app.use(ApiController);

app.listen(Number(process.env.EXPRESS_PORT), () => {
  console.log(
    chalk.green(`Server is running on port ${process.env.EXPRESS_PORT}`)
  );
});

process.on("uncaughtException", (err) => {
  Database.query(
    "INSERT INTO errors (stack, message, name, cause) VALUES (?, ?, ?, ?)",
    err.stack,
    err.message,
    err.name,
    err.cause || ""
  );
});
