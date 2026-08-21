import { asc, desc, eq } from "drizzle-orm";
import * as schema from "../../db/schema.ts";
import { isSafeEvidenceRef } from "../evidence/reference.ts";
import type { RasterDatabase } from "./repository.ts";

export const HEALING_STAGES = [
  "healthy",
  "broken",
  "quarantined",
  "previewed",
  "approved",
  "rerun",
  "published",
] as const;

export type HealingStage = (typeof HEALING_STAGES)[number];

export type HealingEventInput = {
  sessionId: string;
  sourceSlug: string;
  collectorId: string;
  stage: HealingStage;
  occurredAt: string;
  evidenceRef: string;
  detail: string;
  acceptedCount?: number;
};

export type HealingEventView = HealingEventInput & { id: number };

export type HealingSession = {
  sessionId: string;
  sourceSlug: string;
  collectorId: string;
  events: readonly HealingEventView[];
  nextStage?: HealingStage;
  complete: boolean;
};

export class HealingEvidenceValidationError extends Error {}

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const sessionPattern = /^heal-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const collectorPattern = /^c_[A-Za-z0-9_-]{2,127}$/;

function requiredText(value: unknown, field: string, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > max || /[\r\n\0]/.test(value)) {
    throw new HealingEvidenceValidationError(`${field} is invalid`);
  }
  return value.trim();
}

export function validateHealingEvent(input: unknown, now = new Date()): HealingEventInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new HealingEvidenceValidationError("request body must be an object");
  }
  const body = input as Record<string, unknown>;
  const sessionId = requiredText(body.sessionId, "sessionId", 128);
  const sourceSlug = requiredText(body.sourceSlug, "sourceSlug", 64);
  const collectorId = requiredText(body.collectorId, "collectorId", 128);
  const stage = requiredText(body.stage, "stage", 16) as HealingStage;
  const occurredAt = requiredText(body.occurredAt, "occurredAt", 32);
  const evidenceRef = requiredText(body.evidenceRef, "evidenceRef", 264);
  const detail = requiredText(body.detail, "detail", 240);
  if (!sessionPattern.test(sessionId)) throw new HealingEvidenceValidationError("sessionId is invalid");
  if (!slugPattern.test(sourceSlug)) throw new HealingEvidenceValidationError("sourceSlug is invalid");
  if (!collectorPattern.test(collectorId)) throw new HealingEvidenceValidationError("collectorId is invalid");
  if (!HEALING_STAGES.includes(stage)) throw new HealingEvidenceValidationError("stage is invalid");
  if (!isSafeEvidenceRef(evidenceRef)) {
    throw new HealingEvidenceValidationError("evidenceRef is invalid");
  }
  const parsedTime = new Date(occurredAt);
  if (Number.isNaN(parsedTime.getTime()) || parsedTime.toISOString() !== occurredAt || parsedTime > now) {
    throw new HealingEvidenceValidationError("occurredAt is invalid");
  }
  const acceptedCount = body.acceptedCount;
  if (acceptedCount !== undefined && (!Number.isSafeInteger(acceptedCount) || (acceptedCount as number) < 0)) {
    throw new HealingEvidenceValidationError("acceptedCount is invalid");
  }
  if ((stage === "healthy" || stage === "rerun" || stage === "published") && (!(acceptedCount as number) || (acceptedCount as number) < 1)) {
    throw new HealingEvidenceValidationError("acceptedCount must prove at least one valid row for this stage");
  }
  return {
    sessionId,
    sourceSlug,
    collectorId,
    stage,
    occurredAt,
    evidenceRef,
    detail,
    ...(acceptedCount === undefined ? {} : { acceptedCount: acceptedCount as number }),
  };
}

export function nextHealingStage(stages: readonly string[]): HealingStage | undefined {
  for (let index = 0; index < stages.length; index += 1) {
    if (stages[index] !== HEALING_STAGES[index]) {
      throw new HealingEvidenceValidationError("healing events are duplicated or out of order");
    }
  }
  return HEALING_STAGES[stages.length];
}

function parseCollectorIds(value: string): readonly string[] {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return Object.values(parsed).filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

export async function recordHealingEvent(
  db: RasterDatabase,
  input: unknown,
  now = new Date(),
): Promise<{ sessionId: string; stage: HealingStage; nextStage?: HealingStage; complete: boolean }> {
  const event = validateHealingEvent(input, now);
  const source = await db.select({
    slug: schema.sources.slug,
    collectorIds: schema.sources.collectorIds,
    enabled: schema.sources.enabled,
    onboardingStatus: schema.sources.onboardingStatus,
  }).from(schema.sources).where(eq(schema.sources.slug, event.sourceSlug)).get();
  if (!source || !source.enabled || source.onboardingStatus !== "ready") {
    throw new HealingEvidenceValidationError("source must be ready before healing evidence can be recorded");
  }
  if (!parseCollectorIds(source.collectorIds).includes(event.collectorId)) {
    throw new HealingEvidenceValidationError("collectorId does not match the ready source");
  }

  const existing = await db.select({
    sourceSlug: schema.healingEvents.sourceSlug,
    collectorId: schema.healingEvents.collectorId,
    stage: schema.healingEvents.stage,
    occurredAt: schema.healingEvents.occurredAt,
  }).from(schema.healingEvents)
    .where(eq(schema.healingEvents.sessionId, event.sessionId))
    .orderBy(asc(schema.healingEvents.id)).all();
  if (existing.some((row) => row.sourceSlug !== event.sourceSlug || row.collectorId !== event.collectorId)) {
    throw new HealingEvidenceValidationError("a healing session must keep the same source and Collector ID");
  }
  const expected = nextHealingStage(existing.map((row) => row.stage));
  if (!expected) throw new HealingEvidenceValidationError("healing session is already complete");
  if (event.stage !== expected) throw new HealingEvidenceValidationError(`next healing stage must be ${expected}`);
  const previous = existing.at(-1);
  if (previous && event.occurredAt <= previous.occurredAt) {
    throw new HealingEvidenceValidationError("occurredAt must be later than the previous stage");
  }
  try {
    await db.insert(schema.healingEvents).values(event).run();
  } catch {
    throw new HealingEvidenceValidationError("healing event conflicts with an existing stage");
  }
  const nextStage = HEALING_STAGES[existing.length + 1];
  return { sessionId: event.sessionId, stage: event.stage, ...(nextStage ? { nextStage } : {}), complete: !nextStage };
}

export async function loadLatestHealingSession(db: RasterDatabase): Promise<HealingSession | undefined> {
  const latest = await db.select({ sessionId: schema.healingEvents.sessionId })
    .from(schema.healingEvents).orderBy(desc(schema.healingEvents.id)).limit(1).get();
  if (!latest) return undefined;
  const rows = await db.select({
    id: schema.healingEvents.id,
    sessionId: schema.healingEvents.sessionId,
    sourceSlug: schema.healingEvents.sourceSlug,
    collectorId: schema.healingEvents.collectorId,
    stage: schema.healingEvents.stage,
    occurredAt: schema.healingEvents.occurredAt,
    evidenceRef: schema.healingEvents.evidenceRef,
    detail: schema.healingEvents.detail,
    acceptedCount: schema.healingEvents.acceptedCount,
  }).from(schema.healingEvents)
    .where(eq(schema.healingEvents.sessionId, latest.sessionId))
    .orderBy(asc(schema.healingEvents.id)).all();
  if (rows.length === 0) return undefined;
  const stages = rows.map((row) => row.stage);
  const nextStage = nextHealingStage(stages);
  return {
    sessionId: latest.sessionId,
    sourceSlug: rows[0].sourceSlug,
    collectorId: rows[0].collectorId,
    events: rows.map((row) => ({
      id: row.id,
      sessionId: row.sessionId,
      sourceSlug: row.sourceSlug,
      collectorId: row.collectorId,
      stage: row.stage as HealingStage,
      occurredAt: row.occurredAt,
      evidenceRef: row.evidenceRef,
      detail: row.detail,
      ...(row.acceptedCount === null ? {} : { acceptedCount: row.acceptedCount }),
    })),
    ...(nextStage ? { nextStage } : {}),
    complete: !nextStage,
  };
}
