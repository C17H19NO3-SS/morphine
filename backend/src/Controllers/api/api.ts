import Elysia from "elysia";
import { UserApiController } from "./User";

const elysia = new Elysia({
  prefix: "/api",
});

elysia.use(UserApiController);

export const ApiController = elysia;
