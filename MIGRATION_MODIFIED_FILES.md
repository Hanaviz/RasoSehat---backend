RasoSehat Backend — MySQL → PostgreSQL Migration

This manifest lists the files modified during the migration and short notes about each change.

Config
- `config/db.js` — replaced adapter; exports native `pg` Pool using `DATABASE_URL` and NODE_ENV-aware SSL.

Models
- `models/RestaurantModel.js` — SQL placeholders -> $n, INSERT uses RETURNING, JSON parsing preserved.
- `models/MenuModel.js` — placeholders -> $n, RETURNING for inserts, rating aggregation uses COALESCE.
- `models/UserModel.js` — dynamic INSERTs converted to RETURNING, res.rows handling.
- `models/NotificationModel.js` — INSERT RETURNING id, data JSON handling.
- `models/ReviewModel.js` — placeholders -> $n, rowCount checks.
- `models/AdminUserModel.js` — transactions converted to pg client usage.

Controllers
- `controllers/AdminController.js` — queries converted to $n placeholders; uses res.rows/res.rowCount; preserves legacy verifikasi fallbacks.
- `controllers/RestaurantController.js` — converted to db.query with $ placeholders.
- `controllers/SellerController.js` — replaced IFNULL with COALESCE, $ placeholders and res.rows.
- `controllers/MenuController.js` / `controllers/MenuCreateController.js` — adapted to converted models and res.rows handling.
- `controllers/NotificationsController.js` / `controllers/AuthController.js` — updated to pg result shapes.

Scripts
- `scripts/add_slug_column.js` — converted to pg queries.
- `scripts/insert_demo_menu_demo1.js` — RETURNING id and res.rows.
- `scripts/seed_demo_data.js` — converted queries, RETURNING where applicable.
- `scripts/create_admin.js` — uses RETURNING for user insert.
- `scripts/inspect_menu_columns.js` — uses res.rows (information_schema query).
- `scripts/inspect_restaurants.js` — fixed to read `res.rows` (was MySQL-style destructuring).

Top-level utilities & tests support
- `check_menus.js`, `check_users.js`, `test_query.js`, `test_user_management.js`, `test_delete_user.js` — updated to use `res.rows` and pg query results.

Tests
- `tests/admin-approval.test.js`, `tests/admin-verify-put.test.js` — updated to expect pg results and use $ placeholders.

Docs
- `ARCHITECTURE_SUMMARY.md` — updated to reflect PostgreSQL + `pg` usage.

Notes on remaining runtime validation
- Ensure `DATABASE_URL` is set and points to a Postgres instance with compatible schema.
- Confirm timestamp defaults, JSON column types, and any legacy schema differences (e.g., old `verifikasi` table column names) are present or adjust queries.
- SMTP/EMAIL env vars still required for email sending flows.

If you want a git-format patch, run locally after committing:
  git format-patch -1 HEAD --stdout > postgres-migration.patch
