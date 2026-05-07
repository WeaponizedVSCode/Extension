import * as vscode from "vscode";
import type { Intent, IntentStatus, Goal } from "../../../core/domain/intent";

const QUEUE_KEY = "weaponized.intentQueue";
const GOAL_KEY = "weaponized.goal";
const MAX_ARCHIVED = 50;
const ARCHIVED_STATUSES: IntentStatus[] = ["completed", "dismissed", "elevated"];

let workspaceState: vscode.Memento | undefined;

export class IntentQueue {
  static init(state: vscode.Memento): void {
    workspaceState = state;
  }

  static getAll(): Intent[] {
    return workspaceState?.get<Intent[]>(QUEUE_KEY) ?? [];
  }

  static add(intent: Intent): void {
    const all = IntentQueue.getAll();
    all.push(intent);
    IntentQueue.saveAll(all);
    IntentQueue.pruneArchived();
  }

  static update(id: string, updates: Partial<Intent>): Intent | undefined {
    const all = IntentQueue.getAll();
    const idx = all.findIndex((i) => i.id === id);
    if (idx === -1) {
      return undefined;
    }
    all[idx] = { ...all[idx], ...updates, updated_at: new Date().toISOString() };
    IntentQueue.saveAll(all);
    return all[idx];
  }

  static getById(id: string): Intent | undefined {
    return IntentQueue.getAll().find((i) => i.id === id);
  }

  static getByStatus(status: IntentStatus): Intent[] {
    return IntentQueue.getAll().filter((i) => i.status === status);
  }

  static getGoal(): Goal | null {
    return workspaceState?.get<Goal | null>(GOAL_KEY) ?? null;
  }

  static setGoal(goal: Goal): void {
    workspaceState?.update(GOAL_KEY, goal);
  }

  private static saveAll(intents: Intent[]): void {
    workspaceState?.update(QUEUE_KEY, intents);
  }

  private static pruneArchived(): void {
    const all = IntentQueue.getAll();
    const archived = all
      .filter((i) => ARCHIVED_STATUSES.includes(i.status))
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    if (archived.length > MAX_ARCHIVED) {
      const idsToRemove = new Set(
        archived.slice(0, archived.length - MAX_ARCHIVED).map((i) => i.id)
      );
      IntentQueue.saveAll(all.filter((i) => !idsToRemove.has(i.id)));
    }
  }
}
