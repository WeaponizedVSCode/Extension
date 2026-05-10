export type IntentStatus =
  | "pending"
  | "approved"
  | "running"
  | "completed"
  | "dismissed"
  | "elevated";

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
