import type { ExtensionUtils } from "../../types/types";

declare const t: any;

export const init = (utils: ExtensionUtils) => {
  utils.log(`[${utils.name}] initializing...`);

  const RequestEmailSchema = t.Object({ email: t.String({ format: "email" }) });
  const PasswordResetRequestSchema = t.Object({
    email: t.String({ format: "email" }),
  });
  const PasswordResetConfirmSchema = t.Object({
    token: t.String(),
    password: t.String({ minLength: 8, maxLength: 128 }),
  });
  const VerifyEmailSchema = t.Object({ token: t.String() });

  // Helper to generate tokens
  const generateToken = () => crypto.randomBytes(32).toString("hex");

  utils.app
    // Middleware to inject user + roles + permissions when JWT present
    .derive(async ({ jwt, request }) => {
      const auth = request.headers.get("authorization");
      if (!auth?.toLowerCase().startsWith("bearer ")) return {};
      const token = auth.slice(7);
      const payload = await jwt.verify(token).catch(() => null);
      if (!payload?.id) return {};
      const userId = Number(payload.id);
      const roles = await utils.db.query(
        `SELECT r.name FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = ?`,
        userId
      );
      const perms = await utils.db.query(
        `SELECT p.name FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE rp.role_id IN (SELECT role_id FROM user_roles WHERE user_id = ?)`,
        userId
      );
      return {
        authUser: { id: userId, roles: roles.map((r: any) => r.name), perms: perms.map((p: any) => p.name) },
      };
    })
    // Request email verification token
    .post(
      "/verify-email/request",
      async ({ body, status }) => {
        const { email } = body as { email: string };
        const users = await utils.db.query(
          "SELECT id FROM users WHERE email = ?",
          email
        );
        if (!users.length) return status(404, { success: false });
        const userId = (users[0] as any).id as number;
        const token = generateToken();
        await utils.db.execute(
          "INSERT INTO email_verifications (user_id, token) VALUES (?, ?)",
          userId,
          token
        );
        return { success: true, token };
      },
      {
        body: RequestEmailSchema,
        response: {
          200: t.Object({ success: t.Boolean(), token: t.String() }),
          404: t.Object({ success: t.Boolean() }),
        },
        tags: ["Authentication"],
      }
    )
    // Confirm email verification
    .post(
      "/verify-email/confirm",
      async ({ body, status }) => {
        const { token } = body as { token: string };
        const rows = await utils.db.query(
          "SELECT id, user_id FROM email_verifications WHERE token = ? AND used_at IS NULL",
          token
        );
        if (!rows.length) return status(400, { success: false });
        const id = (rows[0] as any).id as number;
        await utils.db.execute(
          "UPDATE email_verifications SET used_at = CURRENT_TIMESTAMP WHERE id = ?",
          id
        );
        return { success: true };
      },
      {
        body: VerifyEmailSchema,
        response: {
          200: t.Object({ success: t.Boolean() }),
          400: t.Object({ success: t.Boolean() }),
        },
        tags: ["Authentication"],
      }
    )
    // Request password reset
    .post(
      "/password/reset/request",
      async ({ body, status }) => {
        const { email } = body as { email: string };
        const users = await utils.db.query(
          "SELECT id FROM users WHERE email = ?",
          email
        );
        if (!users.length) return status(404, { success: false });
        const userId = (users[0] as any).id as number;
        const token = generateToken();
        const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30 min
        await utils.db.execute(
          "INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)",
          userId,
          token,
          expiresAt
        );
        return { success: true, token };
      },
      {
        body: PasswordResetRequestSchema,
        response: {
          200: t.Object({ success: t.Boolean(), token: t.String() }),
          404: t.Object({ success: t.Boolean() }),
        },
        tags: ["Authentication"],
      }
    )
    // Confirm password reset
    .post(
      "/password/reset/confirm",
      async ({ body, status }) => {
        const { token, password } = body as { token: string; password: string };
        const rows = await utils.db.query(
          "SELECT id, user_id, expires_at, used_at FROM password_resets WHERE token = ?",
          token
        );
        if (!rows.length) return status(400, { success: false });
        const pr = rows[0] as any;
        if (pr.used_at || new Date(pr.expires_at).getTime() < Date.now())
          return status(400, { success: false });
        await utils.db.execute(
          "UPDATE users SET password = ? WHERE id = ?",
          utils.bcrypt.hash(password),
          pr.user_id
        );
        await utils.db.execute(
          "UPDATE password_resets SET used_at = CURRENT_TIMESTAMP WHERE id = ?",
          pr.id
        );
        return { success: true };
      },
      {
        body: PasswordResetConfirmSchema,
        response: {
          200: t.Object({ success: t.Boolean() }),
          400: t.Object({ success: t.Boolean() }),
        },
        tags: ["Authentication"],
      }
    );
};
