
import { api } from "./client";
import type { Task } from "../../types";

export async function listTasks(): Promise<Task[]> {
  const res = await api.get("/tasks");
  return res.data as Task[];
}

export async function getTask(id: number): Promise<Task> {
  const res = await api.get(`/tasks/${id}`);
  return res.data as Task;
}

export async function generateTask(): Promise<any> {
  const res = await api.post("/tasks/generate", {});
  return res.data;
}

export async function resetTopic(topicId: number): Promise<void> {
  await api.post("/tasks/reset-topic", { topicId });
}

export async function saveDraft(id: number, code: string): Promise<void> {
  await api.post(`/tasks/${id}/save-draft`, { code });
}

export async function submitTask(id: number, code: string): Promise<any> {
  const res = await api.post(`/tasks/${id}/submit`, { code });
  return res.data;
}

export async function runTask(id: number, code: string): Promise<{ output: string; stderr?: string }> {
  const res = await api.post(`/tasks/${id}/run`, { code });
  return res.data as { output: string; stderr?: string };
}
