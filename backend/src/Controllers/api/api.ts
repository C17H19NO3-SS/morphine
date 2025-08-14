import Elysia from "elysia";

const elysia = new Elysia({
  prefix: "/api",
});

// User API moved into extension: /extensions/users/auth

export const ApiController = elysia;
