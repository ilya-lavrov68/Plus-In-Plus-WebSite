/**
 * Тестовый двойник `@/lib/db`: отдаёт фикстуры по форме SQL, не подключаясь к
 * файлу базы. Имена колонок — как в реальных таблицах (snake_case), фикстуры
 * удобнее держать в camelCase, поэтому здесь же идёт преобразование.
 */

function toServiceRow(service) {
  return {
    id: service.id,
    title: service.title,
    slug: service.slug,
    category: service.category ?? "small",
    short_desc: service.shortDesc ?? "",
    full_desc: service.fullDesc ?? "",
    result_text: service.resultText ?? "",
    cover_image: service.coverImage ?? null,
    base_price: service.basePrice ?? 0,
    price_type: service.priceType ?? "quote",
    currency: service.currency ?? "RUB",
    is_orderable: service.isOrderable ? 1 : 0,
    is_published: service.isPublished === false ? 0 : 1,
    is_active: service.isActive === false ? 0 : 1,
    sort_order: service.sortOrder ?? 0,
    created_at: service.createdAt ?? "2026-01-01T00:00:00.000Z",
    updated_at: service.updatedAt ?? "2026-01-02T00:00:00.000Z",
    cover_url: service.coverUrl ?? null,
  };
}

function toPostRow(post) {
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt ?? "",
    content: post.content ?? "",
    cover_image: post.coverImage ?? null,
    read_time: post.readTime ?? 5,
    source: post.source ?? "manual",
    source_url: post.sourceUrl ?? null,
    is_featured: post.isFeatured ? 1 : 0,
    is_published: post.isPublished === false ? 0 : 1,
    published_at: post.publishedAt ? new Date(post.publishedAt).toISOString() : null,
    created_at: post.createdAt ? new Date(post.createdAt).toISOString() : "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
    cover_url: post.coverUrl ?? null,
  };
}

function createSqlRowsMock(fixtures = {}) {
  const queries = [];
  let services = fixtures.services ?? [];
  let posts = fixtures.posts ?? [];

  const rows = async (sql, args = []) => {
    const query = String(sql).replace(/\s+/g, " ");
    queries.push({ sql: query, args });
    if (query.includes("from services s")) {
      let list = services.slice();
      if (query.includes("s.is_active = 1")) list = list.filter((row) => row.is_active === 1);
      if (query.includes("s.is_published = 1")) list = list.filter((row) => row.is_published === 1);
      if (query.includes("s.slug in")) {
        const slugs = args.slice(0, -1).map(String);
        const id = String(args[args.length - 1]);
        list = list.filter((row) => slugs.includes(row.slug) || row.id === id);
      }
      if (query.includes("s.id = ?")) list = list.filter((row) => row.id === String(args[0]));
      if (query.includes("limit ?")) list = list.slice(0, Number(args[args.length - 1]));
      return list;
    }
    if (query.includes("from posts p")) {
      let list = posts.slice();
      if (query.includes("p.is_featured = 1")) list = list.filter((row) => row.is_featured === 1);
      if (query.includes("p.slug = ?")) list = list.filter((row) => row.slug === String(args[0]));
      if (query.includes("p.is_published = 1")) {
        const now = String(args.find((value) => typeof value === "string" && value.includes("T")) ?? "");
        list = list.filter((row) => row.is_published === 1 && (!row.published_at || row.published_at <= now));
      }
      if (query.includes("limit ?")) list = list.slice(0, Number(args[args.length - 1]));
      return list;
    }
    if (query.includes("from services_includes")) return fixtures.includes ?? [];
    if (query.includes("from services_shapes")) return fixtures.shapes ?? [];
    if (query.includes("from services_option_groups_options")) return fixtures.options ?? [];
    if (query.includes("from services_option_groups")) return fixtures.groups ?? [];
    if (query.includes("from posts_rels")) return fixtures.gallery ?? [];
    return [];
  };

  return {
    queries,
    rows,
    setServices(list) {
      services = list.map((item) => (item.short_desc === undefined ? toServiceRow(item) : item));
    },
    setPosts(list) {
      posts = list.map((item) => (item.published_at === undefined && item.is_published === undefined ? toPostRow(item) : item));
    },
    toServiceRow,
    toPostRow,
  };
}

/** Подменяет только `rows`, оставляя настоящие `sqlValue`, `run` и прочее. */
function dbModuleWith(realDb, mock) {
  return { ...realDb, rows: mock.rows };
}

module.exports = { createSqlRowsMock, dbModuleWith, toPostRow, toServiceRow };
