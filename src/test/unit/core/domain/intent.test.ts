import * as assert from "assert";
import {
  INTENT_STATUSES,
  isValidIntentStatus,
  createIntent,
  createGoal,
  type IntentStatus,
  type Intent,
  type Goal,
} from "../../../../core/domain/intent";

suite("IntentStatus", () => {
  test("defines all 6 valid statuses", () => {
    assert.deepStrictEqual(INTENT_STATUSES, [
      "pending",
      "approved",
      "running",
      "completed",
      "dismissed",
      "elevated",
    ]);
  });

  test("isValidIntentStatus accepts valid statuses", () => {
    for (const s of INTENT_STATUSES) {
      assert.strictEqual(isValidIntentStatus(s), true);
    }
  });

  test("isValidIntentStatus rejects invalid strings", () => {
    assert.strictEqual(isValidIntentStatus("invalid"), false);
    assert.strictEqual(isValidIntentStatus(""), false);
    assert.strictEqual(isValidIntentStatus("PENDING"), false);
  });
});

suite("createIntent", () => {
  test("creates intent with required fields and defaults", () => {
    const intent = createIntent({
      hypothesis: "DC01 has Kerberoastable accounts",
      reasoning: "Finding F-003 shows SPN registered on svc_sql",
      command: "GetUserSPNs.py corp.local/user:pass -dc-ip 10.0.0.1",
      expected_outcome: "TGS ticket hashes in hashcat format",
    });
    assert.strictEqual(intent.hypothesis, "DC01 has Kerberoastable accounts");
    assert.strictEqual(intent.reasoning, "Finding F-003 shows SPN registered on svc_sql");
    assert.strictEqual(intent.command, "GetUserSPNs.py corp.local/user:pass -dc-ip 10.0.0.1");
    assert.strictEqual(intent.expected_outcome, "TGS ticket hashes in hashcat format");
    assert.strictEqual(intent.status, "pending");
    assert.ok(intent.id.startsWith("intent-"));
    assert.ok(intent.created_at.length > 0);
    assert.ok(intent.updated_at.length > 0);
    assert.strictEqual(intent.terminal_id, undefined);
    assert.strictEqual(intent.output, undefined);
    assert.strictEqual(intent.finding_id, undefined);
    assert.strictEqual(intent.dismissed_reason, undefined);
  });

  test("accepts optional terminal_id", () => {
    const intent = createIntent({
      hypothesis: "h",
      reasoning: "r",
      command: "c",
      expected_outcome: "e",
      terminal_id: "term-1",
    });
    assert.strictEqual(intent.terminal_id, "term-1");
  });

  test("generates unique IDs", () => {
    const a = createIntent({ hypothesis: "h", reasoning: "r", command: "c", expected_outcome: "e" });
    const b = createIntent({ hypothesis: "h", reasoning: "r", command: "c", expected_outcome: "e" });
    assert.notStrictEqual(a.id, b.id);
  });

  test("timestamps are valid ISO 8601", () => {
    const intent = createIntent({ hypothesis: "h", reasoning: "r", command: "c", expected_outcome: "e" });
    assert.ok(!isNaN(Date.parse(intent.created_at)));
    assert.ok(!isNaN(Date.parse(intent.updated_at)));
  });
});

suite("createGoal", () => {
  test("creates goal with required description", () => {
    const goal = createGoal({ description: "Get Domain Admin on corp.local" });
    assert.strictEqual(goal.description, "Get Domain Admin on corp.local");
    assert.strictEqual(goal.phase, undefined);
    assert.strictEqual(goal.constraints, undefined);
    assert.ok(goal.updated_at.length > 0);
  });

  test("accepts optional phase and constraints", () => {
    const goal = createGoal({
      description: "Pivot to DMZ",
      phase: "post-exploitation",
      constraints: "No noisy scans",
    });
    assert.strictEqual(goal.phase, "post-exploitation");
    assert.strictEqual(goal.constraints, "No noisy scans");
  });

  test("timestamp is valid ISO 8601", () => {
    const goal = createGoal({ description: "test" });
    assert.ok(!isNaN(Date.parse(goal.updated_at)));
  });
});
