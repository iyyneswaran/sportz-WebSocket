import { pgEnum, pgTable, serial, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Enum: match_status (scheduled | live | finished)
export const matchStatusEnum = pgEnum("match_status", ["scheduled", "live", "finished"]);

// Table: matches
export const matches = pgTable("matches", {
	id: serial("id").primaryKey(),
	sport: text("sport").notNull(),
	homeTeam: text("home_team").notNull(),
	awayTeam: text("away_team").notNull(),
	status: matchStatusEnum("status").notNull().default("scheduled"),
	startTime: timestamp("start_time", { mode: "utc" }).notNull(),
	endTime: timestamp("end_time", { mode: "utc" }),
	homeScore: integer("home_score").notNull().default(0),
	awayScore: integer("away_score").notNull().default(0),
	createdAt: timestamp("created_at", { mode: "utc" }).defaultNow(),
});

// Table: commentary
export const commentary = pgTable("commentary", {
	id: serial("id").primaryKey(),
	matchId: integer("match_id").references(() => matches.id).notNull(),
	minute: integer("minute"),
	sequence: integer("sequence").notNull(),
	period: text("period"),
	eventType: text("event_type"),
	actor: text("actor"),
	team: text("team"),
	message: text("message"),
	metadata: jsonb("metadata"),
	tags: jsonb("tags"),
	createdAt: timestamp("created_at", { mode: "utc" }).defaultNow().notNull(),
});

