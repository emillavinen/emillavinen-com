import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * DISPATCH store. Every timestamp the scheduler compares is written from the
 * application clock, never from SQL `now()`, so a run can be replayed against
 * a mocked clock in tests.
 */

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export type WorkOrigin = "pinterest" | "drop" | "import";

export const works = pgTable(
  "works",
  {
    id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    caption: text("caption").notNull().default(""),
    client: text("client"),
    tools: text("tools").array().notNull().default([]),
    year: integer("year"),
    tags: text("tags").array().notNull().default([]),
    origin: text("origin").$type<WorkOrigin>().notNull(),
    sourceId: text("source_id"),
    sourceUrl: text("source_url"),
    /** "image" today; the column exists so video can be added without a migration of meaning. */
    mediaType: text("media_type").notNull().default("image"),
    visibleOnSite: boolean("visible_on_site").notNull().default(true),
    createdAt: ts("created_at").notNull(),
    updatedAt: ts("updated_at").notNull(),
    /** Set whenever the work is put in the dispatch queue; the summary goes out once its deliveries settle. */
    queuedAt: ts("queued_at"),
    summaryClaimedAt: ts("summary_claimed_at"),
    summarySentAt: ts("summary_sent_at"),
  },
  (t) => [
    uniqueIndex("works_slug_key").on(t.slug),
    uniqueIndex("works_origin_source_key").on(t.origin, t.sourceId),
    index("works_created_at_idx").on(t.createdAt),
  ]
);

export const assets = pgTable(
  "assets",
  {
    id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workId: uuid("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    kind: text("kind").notNull().default("image"),
    displayUrl: text("display_url").notNull(),
    thumbUrl: text("thumb_url").notNull(),
    socialUrl: text("social_url").notNull(),
    bskyUrl: text("bsky_url").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    alt: text("alt").notNull().default(""),
  },
  (t) => [uniqueIndex("assets_work_position_key").on(t.workId, t.position)]
);

export const DELIVERY_STATUSES = [
  "held",
  "pending",
  "posting",
  "posted",
  "failed",
  "skipped",
  "unknown",
] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const deliveries = pgTable(
  "deliveries",
  {
    id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workId: uuid("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
    status: text("status").$type<DeliveryStatus>().notNull(),
    notBefore: ts("not_before"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    /** Why a delivery is `skipped`: disabled, deselected, dry_run, hidden, manual, too_many_images… */
    skipReason: text("skip_reason"),
    /** The text that went out, or would have in dry run. */
    text: text("text"),
    remoteId: text("remote_id"),
    remoteUrl: text("remote_url"),
    claimedAt: ts("claimed_at"),
    postedAt: ts("posted_at"),
    createdAt: ts("created_at").notNull(),
    updatedAt: ts("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("deliveries_work_platform_key").on(t.workId, t.platform),
    index("deliveries_status_not_before_idx").on(t.status, t.notBefore),
  ]
);

export type PlatformStatus = "ok" | "needs_attention" | "disabled";

export const platformState = pgTable("platform_state", {
  platform: text("platform").primaryKey(),
  status: text("status").$type<PlatformStatus>().notNull().default("disabled"),
  /** Rotating credentials (OAuth tokens), AES-256-GCM encrypted with DISPATCH_ENCRYPTION_KEY. */
  credentials: text("credentials"),
  account: text("account"),
  tokenExpiresAt: ts("token_expires_at"),
  tokenRefreshedAt: ts("token_refreshed_at"),
  lastOkAt: ts("last_ok_at"),
  lastCheckAt: ts("last_check_at"),
  note: text("note"),
  /** Lease used as a lock while a rotating refresh token is exchanged. */
  lockUntil: ts("lock_until"),
  updatedAt: ts("updated_at").notNull(),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: ts("updated_at").notNull(),
});

/** Small named counters claimed with a conditional update (e.g. the daily backlog drip). */
export const counters = pgTable("counters", {
  key: text("key").primaryKey(),
  value: integer("value").notNull().default(0),
  updatedAt: ts("updated_at").notNull(),
});

export const events = pgTable(
  "events",
  {
    id: serial("id").primaryKey(),
    at: ts("at").notNull(),
    type: text("type").notNull(),
    platform: text("platform"),
    workId: uuid("work_id"),
    message: text("message").notNull().default(""),
    data: jsonb("data"),
  },
  (t) => [index("events_at_idx").on(t.at), index("events_type_at_idx").on(t.type, t.at)]
);

export const alerts = pgTable("alerts", {
  key: text("key").primaryKey(),
  message: text("message").notNull(),
  active: boolean("active").notNull().default(true),
  firstAt: ts("first_at").notNull(),
  lastSentAt: ts("last_sent_at"),
  resolvedAt: ts("resolved_at"),
});

export const pinterestBoards = pgTable("pinterest_boards", {
  url: text("url").primaryKey(),
  title: text("title"),
  /** First successful read. Pins seen on that read are the baseline and are never dispatched. */
  baselinedAt: ts("baselined_at"),
  lastOkAt: ts("last_ok_at"),
  lastError: text("last_error"),
  updatedAt: ts("updated_at").notNull(),
});

export const feedItems = pgTable(
  "feed_items",
  {
    pinId: text("pin_id").primaryKey(),
    boardUrl: text("board_url").notNull(),
    isBaseline: boolean("is_baseline").notNull(),
    title: text("title").notNull().default(""),
    description: text("description").notNull().default(""),
    imageUrl: text("image_url").notNull(),
    link: text("link").notNull(),
    boardTitle: text("board_title"),
    pubDate: ts("pub_date"),
    firstSeenAt: ts("first_seen_at").notNull(),
    attempts: integer("attempts").notNull().default(0),
    claimedAt: ts("claimed_at"),
    processedAt: ts("processed_at"),
    workId: uuid("work_id"),
    lastError: text("last_error"),
  },
  (t) => [index("feed_items_processed_idx").on(t.processedAt)]
);

export type Work = typeof works.$inferSelect;
export type NewWork = typeof works.$inferInsert;
export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;
export type Delivery = typeof deliveries.$inferSelect;
export type PlatformStateRow = typeof platformState.$inferSelect;
export type FeedItem = typeof feedItems.$inferSelect;
