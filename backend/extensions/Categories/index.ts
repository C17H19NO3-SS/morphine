import type { ExtensionUtils } from "../../types/types";

declare const t: any;

export const init = (utils: ExtensionUtils) => {
  utils.log(`[${utils.name}] initializing...`);

  const TranslationSchema = t.Object({
    locale: t.String({ minLength: 2, maxLength: 10 }),
    name: t.String({ minLength: 1, maxLength: 128 }),
    description: t.Optional(t.String({ maxLength: 2048 })),
  });

  const CategoryCreateSchema = t.Object({
    parent_id: t.Optional(t.Number()),
    slug: t.String({ minLength: 1, maxLength: 64 }),
    name: t.String({ minLength: 1, maxLength: 128 }),
    description: t.Optional(t.String({ maxLength: 2048 })),
    sort_order: t.Optional(t.Number()),
    active: t.Optional(t.Boolean()),
    translations: t.Optional(t.Array(TranslationSchema)),
  });

  const CategorySchema = t.Intersect([
    CategoryCreateSchema,
    t.Object({
      id: t.Number(),
      created_at: t.Optional(t.String()),
      updated_at: t.Optional(t.String()),
    }),
  ]);

  // List categories (optionally by parent_id) and optional locale translation
  utils.app.get(
    "/",
    async ({ query }) => {
      const parentId = (query as any)?.parent_id as string | undefined;
      const locale = (query as any)?.locale as string | undefined;
      if (!locale) {
        const rows = await utils.db.query(
          parentId
            ? "SELECT * FROM categories WHERE active = 1 AND (parent_id <=> ?) ORDER BY sort_order, id"
            : "SELECT * FROM categories WHERE active = 1 ORDER BY sort_order, id",
          parentId ? Number(parentId) : undefined
        );
        return rows;
      }
      const rows = await utils.db.query(
        `SELECT c.*, i.locale as _tr_locale, i.name as _tr_name, i.description as _tr_description
         FROM categories c
         LEFT JOIN categories_i18n i ON i.category_id = c.id AND i.locale = ?
         ${
           parentId
             ? "WHERE c.active = 1 AND (c.parent_id <=> ?)"
             : "WHERE c.active = 1"
         }
         ORDER BY c.sort_order, c.id`,
        ...(parentId ? [locale, Number(parentId)] : [locale])
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
        parent_id: t.Optional(t.String()),
        locale: t.Optional(t.String()),
      }),
      response: {
        200: t.Array(
          t.Intersect([
            CategorySchema,
            t.Object({ translation: t.Optional(TranslationSchema) }),
          ])
        ),
      },
      tags: ["Categories"],
    }
  );

  // Create category
  utils.app.post(
    "/",
    async ({ body, status }) => {
      const {
        parent_id = null,
        slug,
        name,
        description = null,
        sort_order = 0,
        active = true,
        translations,
      } = body as Record<string, any>;

      try {
        const result = await utils.db.execute<{ insertId: number }>(
          "INSERT INTO categories (parent_id, slug, name, description, sort_order, active) VALUES (?, ?, ?, ?, ?, ?)",
          parent_id,
          slug,
          name,
          description,
          sort_order,
          active ? 1 : 0
        );
        const categoryId = (result as any).insertId ?? result?.insertId;
        if (categoryId && Array.isArray(translations)) {
          for (const tr of translations) {
            await utils.db.execute(
              "INSERT INTO categories_i18n (category_id, locale, name, description) VALUES (?, ?, ?, ?)",
              categoryId,
              tr.locale,
              tr.name,
              tr.description ?? null
            );
          }
        }
        return { success: true, id: categoryId };
      } catch (e: any) {
        return status(409, { success: false, message: "Slug must be unique" });
      }
    },
    {
      body: CategoryCreateSchema,
      response: {
        200: t.Object({ success: t.Boolean(), id: t.Optional(t.Number()) }),
        409: t.Object({ success: t.Boolean(), message: t.String() }),
      },
      tags: ["Categories"],
    }
  );

  // Read category
  utils.app.get(
    "/:id",
    async ({ params, query, status }) => {
      const id = Number(params.id);
      const rows = await utils.db.query(
        "SELECT * FROM categories WHERE id = ?",
        id
      );
      if (rows.length !== 1) return status(404, { success: false });
      const locale = (query as any)?.locale as string | undefined;
      if (!locale) return rows[0];
      const tr = await utils.db.query(
        "SELECT locale, name, description FROM categories_i18n WHERE category_id = ? AND locale = ?",
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
          CategorySchema,
          t.Object({ translation: t.Optional(TranslationSchema) }),
        ]),
        404: t.Object({ success: t.Boolean() }),
      },
      tags: ["Categories"],
    }
  );

  // Update category (and translations if provided)
  utils.app.put(
    "/:id",
    async ({ params, body, status }) => {
      const id = Number(params.id);
      const patch = body as Record<string, any>;
      const allowed = [
        "parent_id",
        "slug",
        "name",
        "description",
        "sort_order",
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
        `UPDATE categories SET ${setSql} WHERE id = ?`,
        ...values
      );

      if (Array.isArray((body as any).translations)) {
        for (const tr of (body as any).translations) {
          await utils.db.execute(
            "INSERT INTO categories_i18n (category_id, locale, name, description) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description)",
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
          CategoryCreateSchema,
          t.Object({ translations: t.Optional(t.Array(TranslationSchema)) }),
        ])
      ),
      response: { 200: t.Object({ success: t.Boolean() }) },
      tags: ["Categories"],
    }
  );

  // Delete category
  utils.app.delete(
    "/:id",
    async ({ params }) => {
      await utils.db.execute(
        "DELETE FROM categories WHERE id = ?",
        Number(params.id)
      );
      return { success: true };
    },
    {
      response: { 200: t.Object({ success: t.Boolean() }) },
      tags: ["Categories"],
    }
  );
};
