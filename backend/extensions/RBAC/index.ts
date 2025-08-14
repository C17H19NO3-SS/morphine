import type { ExtensionUtils } from "../../types/types";

declare const t: any;

export const init = (utils: ExtensionUtils) => {
  utils.log(`[${utils.name}] initializing...`);

  const RoleSchema = t.Object({
    name: t.String({ minLength: 1, maxLength: 64 }),
    description: t.Optional(t.String({ maxLength: 256 })),
  });
  const PermSchema = t.Object({
    name: t.String({ minLength: 1, maxLength: 64 }),
    description: t.Optional(t.String({ maxLength: 256 })),
  });
  const AssignRoleSchema = t.Object({
    user_id: t.Number(),
    role_id: t.Number(),
  });
  const GrantPermSchema = t.Object({
    role_id: t.Number(),
    permission_id: t.Number(),
  });

  // Simple guard utility
  const requirePerm =
    (perm: string) =>
    async ({ authUser, status }: any) => {
      if (!authUser || !(authUser.perms as string[])?.includes(perm))
        return status(403, { success: false });
    };

  // Roles CRUD
  utils.app
    .get(
      "/roles",
      async () => utils.db.query("SELECT * FROM roles ORDER BY id"),
      { tags: ["RBAC"] }
    )
    .post(
      "/roles",
      async ({ body, status }) => {
        try {
          const res = await utils.db.execute<{ insertId: number }>(
            "INSERT INTO roles (name, description) VALUES (?, ?)",
            (body as any).name,
            (body as any).description ?? null
          );
          return {
            success: true,
            id: (res as any).insertId ?? (res as any)?.insertId,
          };
        } catch {
          return status(409, { success: false });
        }
      },
      {
        body: RoleSchema,
        response: {
          200: t.Object({ success: t.Boolean(), id: t.Optional(t.Number()) }),
          409: t.Object({ success: t.Boolean() }),
        },
        tags: ["RBAC"],
        beforeHandle: requirePerm("roles:create"),
      }
    )
    .delete(
      "/roles/:id",
      async ({ params }) => {
        await utils.db.execute(
          "DELETE FROM roles WHERE id = ?",
          Number(params.id)
        );
        return { success: true };
      },
      {
        response: { 200: t.Object({ success: t.Boolean() }) },
        tags: ["RBAC"],
        beforeHandle: requirePerm("roles:delete"),
      }
    );

  // Permissions CRUD
  utils.app
    .get(
      "/permissions",
      async () => utils.db.query("SELECT * FROM permissions ORDER BY id"),
      { tags: ["RBAC"] }
    )
    .post(
      "/permissions",
      async ({ body, status }) => {
        try {
          const res = await utils.db.execute<{ insertId: number }>(
            "INSERT INTO permissions (name, description) VALUES (?, ?)",
            (body as any).name,
            (body as any).description ?? null
          );
          return {
            success: true,
            id: (res as any).insertId ?? (res as any)?.insertId,
          };
        } catch {
          return status(409, { success: false });
        }
      },
      {
        body: PermSchema,
        response: {
          200: t.Object({ success: t.Boolean(), id: t.Optional(t.Number()) }),
          409: t.Object({ success: t.Boolean() }),
        },
        tags: ["RBAC"],
        beforeHandle: requirePerm("perms:create"),
      }
    )
    .delete(
      "/permissions/:id",
      async ({ params }) => {
        await utils.db.execute(
          "DELETE FROM permissions WHERE id = ?",
          Number(params.id)
        );
        return { success: true };
      },
      {
        response: { 200: t.Object({ success: t.Boolean() }) },
        tags: ["RBAC"],
        beforeHandle: requirePerm("perms:delete"),
      }
    );

  // Role-Permission linkage
  utils.app.post(
    "/roles/grant",
    async ({ body, status }) => {
      try {
        await utils.db.execute(
          "INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)",
          (body as any).role_id,
          (body as any).permission_id
        );
        return { success: true };
      } catch {
        return status(409, { success: false });
      }
    },
    {
      body: GrantPermSchema,
      response: {
        200: t.Object({ success: t.Boolean() }),
        409: t.Object({ success: t.Boolean() }),
      },
      tags: ["RBAC"],
      beforeHandle: requirePerm("roles:grant"),
    }
  );

  // Assign role to user
  utils.app.post(
    "/users/assign",
    async ({ body, status }) => {
      try {
        await utils.db.execute(
          "INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)",
          (body as any).user_id,
          (body as any).role_id
        );
        return { success: true };
      } catch {
        return status(409, { success: false });
      }
    },
    {
      body: AssignRoleSchema,
      response: {
        200: t.Object({ success: t.Boolean() }),
        409: t.Object({ success: t.Boolean() }),
      },
      tags: ["RBAC"],
      beforeHandle: requirePerm("users:assign_role"),
    }
  );
};
