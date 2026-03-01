import { z } from 'zod';

// ReAct step schema
export const ReActStepSchema = z.object({
  thought: z.string(),
  action: z.string(),
  actionInput: z.record(z.string(), z.any()),
  observation: z.string(),
  finalAnswer: z.string().optional(),
});

export type ReActStep = z.infer<typeof ReActStepSchema>;

// ReAct trace schema
export const ReActTraceSchema = z.object({
  traceId: z.string().uuid(),
  timestamp: z.number(),
  geohash: z.string().length(7),
  contributorId: z.string(),
  steps: z.array(ReActStepSchema),
});

export type ReActTrace = z.infer<typeof ReActTraceSchema>;
