import { createHash } from "node:crypto";

/**
 * In-memory reference adapter for tests/local simulation only.
 * It is not durable storage, a vector database, or a production memory service.
 */
export class MemoryLedger {
  #entries = [];
  #ids = new Set();

  append(record) {
    if (!record || typeof record !== "object" || typeof record.id !== "string" ||
        typeof record.kind !== "string" || typeof record.createdAt !== "string" ||
        !Number.isFinite(Date.parse(record.createdAt)) || !("payload" in record)) {
      return {ok:false, reason:"INVALID_MEMORY_RECORD"};
    }
    if (this.#ids.has(record.id)) return {ok:false, reason:"DUPLICATE_MEMORY_ID"};
    const canonical = JSON.stringify(record);
    const hash = createHash("sha256").update(canonical).digest("hex");
    const entry = Object.freeze({ sequence:this.#entries.length+1, record:structuredClone(record), hash });
    this.#entries.push(entry);
    this.#ids.add(record.id);
    return {ok:true, entry:structuredClone(entry)};
  }

  list({kind, afterSequence=0}={}) {
    return this.#entries.filter(e => e.sequence > afterSequence && (!kind || e.record.kind === kind))
      .map(e => structuredClone(e));
  }

  verify() {
    let previous = null;
    for (const entry of this.#entries) {
      const actual = createHash("sha256").update(JSON.stringify(entry.record)).digest("hex");
      if (actual !== entry.hash || entry.sequence !== (previous ? previous.sequence + 1 : 1))
        return {ok:false, sequence:entry.sequence};
      previous = entry;
    }
    return {ok:true, count:this.#entries.length};
  }

  get size() { return this.#entries.length; }
}
