/** Stop autosaves before discarding, including writes already awaiting local acceptance. */
export class WorkoutWriteGate {
  private blocked = false;
  private pending = new Set<Promise<unknown>>();
  get stopped() { return this.blocked; }
  async write<T>(operation: () => Promise<T>): Promise<T | null> {
    if (this.blocked) return null;
    const pending = Promise.resolve().then(operation); this.pending.add(pending);
    try { return await pending; } finally { this.pending.delete(pending); }
  }
  async discard(operation: () => Promise<void>): Promise<boolean> {
    if (this.blocked) return false;
    this.blocked = true;
    try {
      await Promise.allSettled([...this.pending]);
      await operation(); return true;
    } catch { this.blocked = false; return false; }
  }
}
