import jwt from "@elysiajs/jwt";
import { Elysia, t } from "elysia";
import { User } from "../../Lib/User";
import bcrypt from "bcrypt";
import { Res } from "../../Lib/Response";
import type { UserInterface } from "../../../types/types";

export const UserApiController = new Elysia({
  prefix: "/user",
})
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
          const user = await User.findUserByUsername(username, true);

          if (!user) return Res.error("User not found", 401);

          if (bcrypt.compareSync(password, user.password as string))
            return status(200, {
              token: await jwt.sign({
                id: user.id as number,
                username: user.username,
                email: user.email,
              }),
              success: true,
            });

          return status(401, {
            success: false,
            message: "Invalid password",
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
              success: t.Boolean({
                default: true,
              }),
            }),
            401: t.Object({
              success: t.Boolean({
                default: false,
              }),
              message: t.String({
                default: "Invalid password",
              }),
            }),
          },
          tags: ["Authentication"],
        }
      )
      .post(
        "/register",
        async ({ body: { username, password, email }, jwt, status }) => {
          const user = await User.findUserByUsername(username, true);

          if (user)
            return status(409, {
              success: false,
            });

          const id = await User.createUser({
            username,
            password,
            email,
          } as UserInterface);

          if (!id)
            return status(409, {
              success: false,
            });
          return status(200, {
            token: await jwt.sign({ id, username, email }),
            success: true,
          });
        },
        {
          body: t.Object({
            username: t.String({ minLength: 8, maxLength: 32 }),
            password: t.String({ minLength: 8, maxLength: 128 }),
            email: t.String({
              format: "email",
              maxLength: 64,
            }),
          }),
          response: {
            200: t.Object({
              token: t.String(),
              success: t.Boolean({
                default: true,
              }),
            }),
            409: t.Object({
              success: t.Boolean({
                default: false,
              }),
            }),
          },
          tags: ["Authentication"],
        }
      )
  );
