import { JudgeClient } from "./JudgeClient";
import type { JudgeRequest, JudgeResponse } from "./types";
import { GlobalFileSemaphore } from "./Semaphore";

// Global semaphore: one judge execution on the whole machine.
const semaphore = GlobalFileSemaphore.fromEnv();
const client = new JudgeClient();

export async function judgeWithSemaphore(req: JudgeRequest): Promise<JudgeResponse> {
  const token = await semaphore.tryAcquire();
  try {
    return await client.judge(req);
  } finally {
    await token.release();
  }
}


