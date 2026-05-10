import * as assert from "assert";
import type { Intent, IntentStatus, Goal } from "../../../../core/domain/intent";

suite("Intent domain types", () => {
  test("IntentStatus includes all expected values", () => {
    const statuses: IntentStatus[] = [
      "pending", "approved", "running", "completed", "dismissed", "elevated",
    ];
    assert.strictEqual(statuses.length, 6);
  });

  test("Intent has all required fields", () => {
    const intent: Intent = {
      id: "intent-1",
      hypothesis: "DC01 is Kerberoastable",
      reasoning: "Finding F-001 shows SPNs present",
      command: "impacket-GetUserSPNs corp.local/user:pass -dc-ip 10.0.0.1",
      expected_outcome: "SPN list returned with at least one entry",
      status: "pending",
      created_at: "2026-04-30T00:00:00.000Z",
      updated_at: "2026-04-30T00:00:00.000Z",
    };
    assert.strictEqual(intent.id, "intent-1");
    assert.strictEqual(intent.status, "pending");
    assert.strictEqual(intent.terminal_id, undefined);
    assert.strictEqual(intent.output, undefined);
    assert.strictEqual(intent.finding_id, undefined);
    assert.strictEqual(intent.dismissed_reason, undefined);
  });

  test("Goal has required fields and optional phase/constraints", () => {
    const goal: Goal = {
      description: "Get domain admin on corp.local",
      updated_at: "2026-04-30T00:00:00.000Z",
    };
    assert.strictEqual(goal.description, "Get domain admin on corp.local");
    assert.strictEqual(goal.phase, undefined);
    assert.strictEqual(goal.constraints, undefined);
  });
});
