import { createRepositoryEvidenceCards } from "./evidence-kernel.mjs";

/** Index one pinned local repository revision and durably append its ECK cards. */
export async function persistRepositoryIndexEvidence({ indexer, repository, rootClaim, branch, actorId, occurredAt } = {}) {
  if (!indexer || typeof indexer.index !== "function" || !repository || typeof repository.append !== "function" ||
      rootClaim?.schemaVersion !== "kratt-root-claim/v1" || branch?.schemaVersion !== "kratt-evidence-branch/v1" ||
      branch.state !== "OPEN" || branch.rootId !== rootClaim.rootId || branch.rootRevision !== rootClaim.revision) {
    return Object.freeze({ ok: false, status: "REJECTED", reason: "REPOSITORY_EVIDENCE_PIPELINE_INPUT_INVALID", persistedCount: 0 });
  }

  let index;
  try {
    index = await indexer.index({ revision: rootClaim.revision });
  } catch {
    return Object.freeze({ ok: false, status: "REJECTED", reason: "REPOSITORY_INDEX_FAILED", persistedCount: 0 });
  }
  if (!index?.ok) return Object.freeze({ ok: false, status: "REJECTED", reason: index?.reason ?? "REPOSITORY_INDEX_FAILED", persistedCount: 0 });

  const created = createRepositoryEvidenceCards({ index, rootId: rootClaim.rootId, branchId: branch.branchId, actorId, occurredAt });
  if (!created.ok) return Object.freeze({ ...created, status: "REJECTED", persistedCount: 0 });

  const persisted = [];
  let duplicateCount = 0;
  for (const card of created.cards) {
    let result;
    try {
      result = await repository.append({ rootId: card.rootId, branchId: card.branchId, ...card.evidence });
    } catch {
      return Object.freeze({ ok: false, status: "PARTIAL", reason: "EVIDENCE_PERSISTENCE_FAILED", persistedCount: persisted.length,
        duplicateCount, failedCardId: card.cardId, retry: "REPEAT_WITH_IDENTICAL_ROOT_BRANCH_ACTOR_TIME_AND_REVISION", cards: Object.freeze(persisted) });
    }
    if (!result?.ok || result.card?.cardId !== card.cardId || result.card?.contentDigest !== card.contentDigest) return Object.freeze({ ok: false, status: persisted.length ? "PARTIAL" : "REJECTED",
      reason: result?.reason ?? "EVIDENCE_PERSISTENCE_FAILED", persistedCount: persisted.length,
      duplicateCount, failedCardId: card.cardId,
      retry: persisted.length ? "REPEAT_WITH_IDENTICAL_ROOT_BRANCH_ACTOR_TIME_AND_REVISION" : null,
      cards: Object.freeze(persisted) });
    if (result.duplicate) duplicateCount += 1;
    persisted.push(result.card);
  }

  return Object.freeze({ ok: true, status: "PERSISTED", revision: index.revision, indexedCount: index.files.length,
    persistedCount: persisted.length, duplicateCount, externalTransfer: false, cards: Object.freeze(persisted) });
}

