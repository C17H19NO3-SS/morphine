import { Elysia, t } from "elysia";
import jwt from "@elysiajs/jwt";
import type { ExtensionUtils, UserInterface } from "../../types/types";

export const init = (utils: ExtensionUtils) => {
  utils.log(`[${utils.name}] initializing...`);

  utils.app
    .use(
      jwt({
        secret: process.env.JWT_SECRET as string,
        name: "jwt",
      })
    )
    .group("/auth", (app) =>
      app
        .post(
          "/login",
          async ({ body: { username, password }, jwt, status }) => {
            const rows = await utils.db.query<
              UserInterface & { password: string }
            >(
              "SELECT id, username, email, password FROM users WHERE username = ?",
              username
            );
            if (rows.length !== 1)
              return status(401, { message: "User not found", success: false });

            const user = rows[0]!;
            if (!utils.bcrypt.compare(password, user.password as string))
              return status(401, {
                success: false,
                message: "Invalid password",
              });

            return status(200, {
              token: await jwt.sign({
                id: user.id as number,
                username: user.username,
                email: user.email,
              }),
              success: true,
            });
          },
          {
            body: t.Object({
              username: t.String({ minLength: 8, maxLength: 32 }),
              password: t.String({ minLength: 8, maxLength: 128 }),
            }),
            response: {
              200: t.Object({
                token: t.String(),
                success: t.Boolean({ default: true }),
              }),
              401: t.Object({
                success: t.Boolean({ default: false }),
                message: t.String(),
              }),
            },
            tags: ["Authentication"],
          }
        )
        .post(
          "/register",
          async ({ body: { username, password, email }, jwt, status }) => {
            const exists = await utils.db.query(
              "SELECT id FROM users WHERE username = ?",
              username
            );
            if (exists.length) return status(409, { success: false });

            const hashed = utils.bcrypt.hash(password);
            const result = await utils.db.execute<{ insertId: number }>(
              "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
              username,
              email,
              hashed
            );
            const id = (result as any).insertId ?? result?.insertId;
            if (!id) return status(409, { success: false });

            return status(200, {
              token: await jwt.sign({ id, username, email }),
              success: true,
            });
          },
          {
            body: t.Object({
              username: t.String({ minLength: 8, maxLength: 32 }),
              password: t.String({ minLength: 8, maxLength: 128 }),
              email: t.String({ format: "email", maxLength: 64 }),
            }),
            response: {
              200: t.Object({
                token: t.String(),
                success: t.Boolean({ default: true }),
              }),
              409: t.Object({ success: t.Boolean({ default: false }) }),
            },
            tags: ["Authentication"],
          }
        )
    );
};
