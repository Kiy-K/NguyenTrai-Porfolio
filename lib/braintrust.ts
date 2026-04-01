import { initLogger } from 'braintrust';

type TraceResultMetrics = Record<string, number | undefined>;

interface TraceLLMCallOptions<T> {
  name: string;
  provider: 'gemini' | 'mistral';
  model: string;
  input: unknown;
  metadata?: Record<string, unknown>;
  tags?: string[];
  call: () => Promise<T>;
  output?: (result: T) => unknown;
  metrics?: (result: T) => TraceResultMetrics;
}

let logger: ReturnType<typeof initLogger> | null | undefined;

function getBraintrustLogger() {
  if (logger !== undefined) return logger;

  const apiKey = process.env.BRAINTRUST_API_KEY;
  if (!apiKey) {
    logger = null;
    return logger;
  }

  logger = initLogger({
    apiKey,
    projectName: process.env.BRAINTRUST_PROJECT_NAME || 'nguyen-trai-portfolio',
  });

  return logger;
}

function compactMetrics(metrics?: TraceResultMetrics): Record<string, number> | undefined {
  if (!metrics) return undefined;

  const entries = Object.entries(metrics).filter(([, value]) => typeof value === 'number');
  if (entries.length === 0) return undefined;

  return Object.fromEntries(entries) as Record<string, number>;
}

export async function traceLLMCall<T>(options: TraceLLMCallOptions<T>): Promise<T> {
  const activeLogger = getBraintrustLogger();
  if (!activeLogger) {
    return options.call();
  }

  return activeLogger.traced(
    async (span) => {
      span.log({
        input: options.input,
        metadata: {
          provider: options.provider,
          model: options.model,
          ...options.metadata,
        },
        tags: ['llm-call', `provider:${options.provider}`, ...(options.tags || [])],
      });

      try {
        const result = await options.call();
        span.log({
          output: options.output ? options.output(result) : undefined,
          metrics: compactMetrics(options.metrics?.(result)),
        });
        return result;
      } catch (error) {
        span.log({
          metadata: {
            error: error instanceof Error ? error.message : String(error),
          },
        });
        throw error;
      }
    },
    { name: options.name, type: 'llm' }
  );
}
