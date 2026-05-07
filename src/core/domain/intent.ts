export type IntentStatus =
  | "pending"
  | "approved"
  | "running"
  | "completed"
  | "dismissed"
  | "elevated";

export const INTENT_STATUSES: IntentStatus[] = [
  "pending",
  "approved",
  "running",
  "completed",
  "dismissed",
  "elevated",
];

export function isValidIntentStatus(value: string): value is IntentStatus {
  return INTENT_STATUSES.includes(value as IntentStatus);
}

export interface Intent {
  id: string;
  hypothesis: string;
  reasoning: string;
  command: string;
  expected_outcome: string;
  status: IntentStatus;
  terminal_id?: string;
  output?: string;
  finding_id?: string;
  dismissed_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface Goal {
  description: string;
  phase?: string;
  constraints?: string;
  updated_at: string;
}

let intentCounter = 0;

export interface CreateIntentInput {
  hypothesis: string;
  reasoning: string;
  command: string;
  expected_outcome: string;
  terminal_id?: string;
}

export function createIntent(input: CreateIntentInput): Intent {
  const now = new Date().toISOString();
  return {
    id: `intent-${Date.now()}-${++intentCounter}`,
    hypothesis: input.hypothesis,
    reasoning: input.reasoning,
    command: input.command,
    expected_outcome: input.expected_outcome,
    status: "pending",
    terminal_id: input.terminal_id,
    output: undefined,
    finding_id: undefined,
    dismissed_reason: undefined,
    created_at: now,
    updated_at: now,
  };
}

export interface CreateGoalInput {
  description: string;
  phase?: string;
  constraints?: string;
}

export function createGoal(input: CreateGoalInput): Goal {
  return {
    description: input.description,
    phase: input.phase,
    constraints: input.constraints,
    updated_at: new Date().toISOString(),
  };
}
