import type { Intent, IntentStatus, Goal } from "../../../core/domain/intent";
import { Context } from "../../../platform/vscode/context";

const QUEUE_KEY = "weaponized.intentQueue";
const GOAL_KEY = "weaponized.goal";
const ARCHIVED_STATUSES: IntentStatus[] = ["completed", "dismissed", "elevated"];
const MAX_ARCHIVED = 50;

export class IntentQueue {
  static getAll(): Intent[] {
    return Context.context.workspaceState.get<Intent[]>(QUEUE_KEY) ?? [];
  }

  static getByStatus(status: IntentStatus): Intent[] {
    return IntentQueue.getAll().filter((i) => i.status === status);
  }

  static getById(id: string): Intent | undefined {
    return IntentQueue.getAll().find((i) => i.id === id);
  }

  static add(intent: Intent): void {
    const all = IntentQueue.getAll();
    all.push(intent);
    IntentQueue.saveAll(all);
    IntentQueue.pruneArchived();
  }

  static update(id: string, updates: Partial<Intent>): void {
    const all = IntentQueue.getAll();
    const idx = all.findIndex((i) => i.id === id);
    if (idx === -1) return;
    all[idx] = { ...all[idx], ...updates, updated_at: new Date().toISOString() };
    IntentQueue.saveAll(all);
  }

  static getGoal(): Goal | null {
    return Context.context.workspaceState.get<Goal>(GOAL_KEY) ?? null;
  }

  static setGoal(goal: Goal): Thenable<void> {
    return Context.context.workspaceState.update(GOAL_KEY, goal);
  }

  private static saveAll(intents: Intent[]): Thenable<void> {
    return Context.context.workspaceState.update(QUEUE_KEY, intents);
  }

  private static pruneArchived(): void {
    const all = IntentQueue.getAll();
    const archived = all
      .filter((i) => ARCHIVED_STATUSES.includes(i.status))
      .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
    if (archived.length > MAX_ARCHIVED) {
      const toRemove = new Set(
        archived.slice(0, archived.length - MAX_ARCHIVED).map((i) => i.id)
      );
      IntentQueue.saveAll(all.filter((i) => !toRemove.has(i.id)));
    }
  }
}
