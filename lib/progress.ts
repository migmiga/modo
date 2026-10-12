import type { Task } from "./types";

// PRD 4.2 — completed / (completed + pending + cancelled) * 100
export function calcProgress(tasks: Task[]): number {
  const completed = tasks.filter((t) => t.status === "completed").length;
  const pending = tasks.filter((t) => t.status === "pending").length;
  const cancelled = tasks.filter((t) => t.status === "cancelled").length;
  const total = completed + pending + cancelled;
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}
