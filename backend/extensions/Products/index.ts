import type { ExtensionUtils } from "../../types/types";

// `t` is provided by the sandbox context; declare to satisfy TS
declare const t: any;

type ProductType = "one_time" | "subscription";

export const init = (utils: ExtensionUtils) => {
  utils.log(`[${utils.name}] initializing...`);

  const TranslationSchema = t.Object({
    locale: t.String({ minLength: 2, maxLength: 10 }),
    name: t.String({ minLength: 1, maxLength: 128 }),
    description: t.Optional(t.String({ maxLength: 2048 })),
  });

  const ProductCreateSchema = t.Object({
    sku: t.String({ minLength: 1, maxLength: 64 }),
    name: t.String({ minLength: 1, maxLength: 128 }),
    description: t.Optional(t.String({ maxLength: 2048 })),
    type: t.Union([t.Literal("one_time"), t.Literal("subscription")]),
    price_cents: t.Number({ minimum: 0 }),
    currency: t.String({ minLength: 3, maxLength: 3 }),
    interval: t.Optional(
      t.Union([
        t.Literal("day"),
        t.Literal("week"),
        t.Literal("month"),
        t.Literal("year"),
      ])
    ),
    interval_count: t.Optional(t.Number({ minimum: 1, maximum: 365 })),
    active: t.Optional(t.Boolean()),
    translations: t.Optional(t.Array(TranslationSchema)),
  });

  const ProductSchema = t.Intersect([
    ProductCreateSchema,
    t.Object({
      id: t.Number(),
      created_at: t.Optional(t.String()),
      updated_at: t.Optional(t.String()),
    }),
  ]);

  // List products with simple search and pagination
  utils.app.get(
    "/",
    async ({ query }) => {
      const {
        locale,
        q,
        page = "1",
        page_size = "20",
        sort_by = "id",
        sort_dir = "desc",
      } = (query as any) ?? {};
      const limit = Math.min(Math.max(parseInt(page_size) || 20, 1), 100);
      const offset = Math.max(((parseInt(page) || 1) - 1) * limit, 0);

      // allowlisted sort columns
      const sortColumn = ["id", "price_cents", "created_at"].includes(
        String(sort_by)
      )
        ? String(sort_by)
        : "id";
      const dir = String(sort_dir).toLowerCase() === "asc" ? "ASC" : "DESC";

      if (!locale) {
        const params: any[] = [];
        let where = "WHERE p.active = 1";
        if (q) {
          where +=
            " AND (p.sku LIKE ? OR p.name LIKE ? OR p.description LIKE ?)";
          params.push(`%${q}%`, `%${q}%`, `%${q}%`);
        }
        params.push(limit, offset);
        const rows = await utils.db.query(
          `SELECT p.* FROM products p ${where} ORDER BY p.${sortColumn} ${dir} LIMIT ? OFFSET ?`,
          ...params
        );
        return rows;
      }

      const params: any[] = [locale];
      let where = "WHERE p.active = 1";
      if (q) {
        where +=
          " AND (p.sku LIKE ? OR p.name LIKE ? OR p.description LIKE ? OR i.name LIKE ? OR i.description LIKE ?)";
        params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
      }
      params.push(limit, offset);
      const rows = await utils.db.query(
        `SELECT p.*, i.locale as _tr_locale, i.name as _tr_name, i.description as _tr_description
         FROM products p
         LEFT JOIN products_i18n i ON i.product_id = p.id AND i.locale = ?
         ${where}
         ORDER BY p.${sortColumn} ${dir}
         LIMIT ? OFFSET ?`,
        ...params
      );
      return (rows as any[]).map((r) => {
        if (r._tr_name || r._tr_description) {
          r.translation = {
            locale: r._tr_locale,
            name: r._tr_name,
            description: r._tr_description,
          };
        }
        delete r._tr_locale;
        delete r._tr_name;
        delete r._tr_description;
        return r;
      });
    },
    {
      query: t.Object({
        locale: t.Optional(t.String()),
        q: t.Optional(t.String()),
        page: t.Optional(t.String()),
        page_size: t.Optional(t.String()),
        sort_by: t.Optional(t.String()),
        sort_dir: t.Optional(t.String()),
      }),
      response: {
        200: t.Array(
          t.Intersect([
            ProductSchema,
            t.Object({ translation: t.Optional(TranslationSchema) }),
          ])
        ),
      },
      tags: ["Products"],
    }
  );

  // Create product
  utils.app.post(
    "/",
    async ({ body, status }) => {
      const {
        sku,
        name,
        description = null,
        type,
        price_cents,
        currency = "USD",
        interval = null,
        interval_count = null,
        active = true,
      } = body as Record<string, any>;

      if (type === "subscription" && (!interval || !interval_count))
        return status(400, {
          success: false,
          message: "Subscription requires interval and interval_count",
        });

      try {
        const result = await utils.db.execute<{ insertId: number }>(
          "INSERT INTO products (sku, name, description, type, price_cents, currency, interval, interval_count, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          sku,
          name,
          description,
          type,
          price_cents,
          currency,
          interval,
          interval_count,
          active ? 1 : 0
        );
        const productId = (result as any).insertId ?? result?.insertId;

        // Optional translations
        const translations = (body as any).translations as
          | Array<{ locale: string; name: string; description?: string }>
          | undefined;
        if (productId && Array.isArray(translations)) {
          for (const tr of translations) {
            await utils.db.execute(
              "INSERT INTO products_i18n (product_id, locale, name, description) VALUES (?, ?, ?, ?)",
              productId,
              tr.locale,
              tr.name,
              tr.description ?? null
            );
          }
        }

        return { success: true, id: productId };
      } catch (e: any) {
        return status(409, { success: false, message: "SKU must be unique" });
      }
    },
    {
      body: ProductCreateSchema,
      response: {
        200: t.Object({ success: t.Boolean(), id: t.Optional(t.Number()) }),
        409: t.Object({ success: t.Boolean(), message: t.String() }),
      },
      tags: ["Products"],
    }
  );

  // Read product
  utils.app.get(
    "/:id",
    async ({ params, status, query }) => {
      const id = Number(params.id);
      const rows = await utils.db.query(
        "SELECT * FROM products WHERE id = ?",
        id
      );
      if (rows.length !== 1) return status(404, { success: false });

      const locale = (query as any)?.locale as string | undefined;
      if (!locale) return rows[0];

      const tr = await utils.db.query(
        "SELECT locale, name, description FROM products_i18n WHERE product_id = ? AND locale = ?",
        id,
        locale
      );
      const base = rows[0] as any;
      if (tr.length) base.translation = tr[0];
      return base;
    },
    {
      query: t.Object({ locale: t.Optional(t.String()) }),
      response: {
        200: t.Intersect([
          ProductSchema,
          t.Object({ translation: t.Optional(TranslationSchema) }),
        ]),
        404: t.Object({ success: t.Boolean() }),
      },
      tags: ["Products"],
    }
  );

  // Update product
  utils.app.put(
    "/:id",
    async ({ params, body, status }) => {
      const id = Number(params.id);
      const patch = body as Record<string, any>;

      // Basic whitelist
      const allowed: string[] = [
        "sku",
        "name",
        "description",
        "type",
        "price_cents",
        "currency",
        "interval",
        "interval_count",
        "active",
      ];
      const fields = Object.keys(patch).filter((k) => allowed.includes(k));
      if (!fields.length)
        return status(400, { success: false, message: "No fields to update" });

      const setSql = fields.map((f) => `${f} = ?`).join(", ");
      const values = fields.map((f) =>
        f === "active" ? (patch[f] ? 1 : 0) : patch[f]
      );
      values.push(id);
      await utils.db.execute(
        `UPDATE products SET ${setSql} WHERE id = ?`,
        ...values
      );

      // Optional translations upsert
      const translations = (body as any).translations as
        | Array<{ locale: string; name: string; description?: string }>
        | undefined;
      if (Array.isArray(translations)) {
        for (const tr of translations) {
          await utils.db.execute(
            "INSERT INTO products_i18n (product_id, locale, name, description) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description)",
            id,
            tr.locale,
            tr.name,
            tr.description ?? null
          );
        }
      }

      return { success: true };
    },
    {
      body: t.Partial(
        t.Intersect([
          ProductCreateSchema,
          t.Object({ translations: t.Optional(t.Array(TranslationSchema)) }),
        ])
      ),
      response: { 200: t.Object({ success: t.Boolean() }) },
      tags: ["Products"],
    }
  );

  // Delete product
  utils.app.delete(
    "/:id",
    async ({ params }) => {
      await utils.db.execute(
        "DELETE FROM products WHERE id = ?",
        Number(params.id)
      );
      return { success: true };
    },
    {
      response: { 200: t.Object({ success: t.Boolean() }) },
      tags: ["Products"],
    }
  );
};
