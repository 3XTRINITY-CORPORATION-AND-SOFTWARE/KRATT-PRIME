import { createHash } from "node:crypto";
import { createBranchManager, reflectEvidence } from "./evidence-kernel.mjs";

const SHA = /^[0-9a-f]{40}$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const digest = value => `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;

const invariant = (id, passed, evidenceRefs = []) => Object.freeze({ id, passed, evidenceRefs: Object.freeze([...evidenceRefs]) });

function rejection(reason, invariants = []) {
  return Object.freeze({ ok: false, status: "REJECTED", reason, invariants: Object.freeze(invariants), snapshot: null });
}

/**
 * Rebuild a reflection snapshot exclusively from verified durable ECK records.
 * Invariants are calculated here; callers cannot mark an invariant as passed.
 */
export async function reflectPersistedEvidence({ repository, rootClaim, branchDefinitions, maxEvents = 10_000 } = {}) {
  if (!repository || typeof repository.verify !== "function" || typeof repository.list !== "function" ||
      rootClaim?.schemaVersion !== "kratt-root-claim/v1" || !ID.test(rootClaim.rootId ?? "") || !SHA.test(rootClaim.revision ?? "") ||
      typeof rootClaim.statement !== "string" || !Array.isArray(branchDefinitions) || branchDefinitions.length === 0 ||
      branchDefinitions.length > 256 || !Number.isInteger(maxEvents) || maxEvents < 1 || maxEvents > 100_000) {
    return rejection("REFLECTION_INPUT_INVALID");
  }

  let initial;
  try { initial = await repository.verify(); } catch { return rejection("JOURNAL_VERIFICATION_FAILED"); }
  if (initial?.ok !== true || !Number.isSafeInteger(initial.eventCount) || initial.eventCount > maxEvents ||
      typeof initial.evidenceHeadHash !== "string" || typeof initial.journalHeadHash !== "string") {
    return rejection("JOURNAL_VERIFICATION_FAILED", [invariant("JOURNAL_VERIFIED", false)]);
  }

  const branchManager = createBranchManager(rootClaim);
  const branchIds = new Set();
  for (const definition of branchDefinitions) {
    if (!definition || !ID.test(definition.branchId ?? "") || branchIds.has(definition.branchId)) {
      return rejection("BRANCH_DEFINITIONS_INVALID", [invariant("BRANCH_DEFINITIONS_VALID", false)]);
    }
    const created = branchManager.create({ branchId: definition.branchId, parentBranchId: definition.parentBranchId ?? null, question: definition.question });
    if (!created.ok) return rejection("BRANCH_DEFINITIONS_INVALID", [invariant("BRANCH_DEFINITIONS_VALID", false)]);
    branchIds.add(definition.branchId);
  }

  const cards = [];
  let expectedCount = initial.eventCount;
  try {
    for (let offset = 0; offset < expectedCount; offset += 1000) {
      const page = await repository.list({ afterSequence: offset, limit: Math.min(1000, expectedCount - offset) });
      if (page?.ok !== true || !Array.isArray(page.cards) || page.count !== expectedCount || page.cards.length === 0) {
        return rejection("JOURNAL_PAGE_INVALID", [invariant("JOURNAL_VERIFIED", true), invariant("JOURNAL_PAGES_COMPLETE", false)]);
      }
      cards.push(...page.cards);
    }
  } catch {
    return rejection("JOURNAL_READ_FAILED", [invariant("JOURNAL_VERIFIED", true), invariant("JOURNAL_PAGES_COMPLETE", false)]);
  }

  let final;
  try { final = await repository.verify(); } catch { return rejection("JOURNAL_VERIFICATION_FAILED"); }
  const stable = final?.ok === true && final.eventCount === initial.eventCount &&
    final.evidenceHeadHash === initial.evidenceHeadHash && final.journalHeadHash === initial.journalHeadHash;
  const uniqueIds = new Set(cards.map(card => card?.cardId));
  const knownProvenance = cards.every(card => card?.schemaVersion === "kratt-eck-card/v1" && card.rootId === rootClaim.rootId && branchIds.has(card.branchId));
  const pinnedRepositorySources = cards.filter(card => card?.evidence?.eventType === "repository.file.indexed")
    .every(card => card.evidence.sourceRef?.provider === "local-git" && card.evidence.sourceRef.revision === rootClaim.revision);
  const invariantResults = [
    invariant("ROOT_REVISION_PINNED", SHA.test(rootClaim.revision)),
    invariant("BRANCH_DEFINITIONS_VALID", true),
    invariant("JOURNAL_VERIFIED", stable),
    invariant("JOURNAL_PAGES_COMPLETE", cards.length === expectedCount),
    invariant("CARD_IDS_UNIQUE", uniqueIds.size === cards.length, cards.map(card => card?.cardId ?? null)),
    invariant("CARD_PROVENANCE_VALID", knownProvenance, cards.map(card => card?.cardId ?? null)),
    invariant("REPOSITORY_REVISION_PINNED", pinnedRepositorySources,
      cards.filter(card => card?.evidence?.eventType === "repository.file.indexed").map(card => card.cardId))
  ];

  if (!stable) return rejection("JOURNAL_CHANGED_DURING_REFLECTION", invariantResults);
  if (cards.length !== expectedCount) return rejection("JOURNAL_PAGES_INCOMPLETE", invariantResults);
  if (uniqueIds.size !== cards.length) return rejection("DUPLICATE_CARD_ID", invariantResults);
  if (!knownProvenance) return rejection("CARD_PROVENANCE_INVALID", invariantResults);
  if (!pinnedRepositorySources) return rejection("REPOSITORY_REVISION_MISMATCH", invariantResults);

  for (const card of cards) {
    const added = branchManager.addFinding(card.branchId, card);
    if (!added.ok) return rejection("BRANCH_PROJECTION_FAILED", [...invariantResults, invariant("BRANCH_PROJECTION_VALID", false, [card.cardId])]);
  }
  const branches = branchManager.list();
  const reflected = reflectEvidence({ rootClaim, branches, requiredInvariants: invariantResults });
  const snapshotBody = { schemaVersion: "kratt-reflection-snapshot/v1", rootId: rootClaim.rootId,
    rootRevision: rootClaim.revision, evidenceHeadHash: final.evidenceHeadHash,
    journalHeadHash: final.journalHeadHash, eventCount: cards.length,
    invariants: invariantResults, branches, reflection: reflected };
  return Object.freeze({ ...reflected, status: reflected.state, invariants: Object.freeze(invariantResults),
    snapshot: Object.freeze({ ...snapshotBody, snapshotDigest: digest(snapshotBody) }) });
}

