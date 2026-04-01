import { registerOTel } from '@vercel/otel';

const defaultPropagationTargets: (string | RegExp)[] = [
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//,
  /^https:\/\/api\.mistral\.ai\//,
  /^https:\/\/generativelanguage\.googleapis\.com\//,
];

function parsePropagationTargets(value?: string): (string | RegExp)[] {
  if (!value) return defaultPropagationTargets;
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function register() {
  registerOTel({
    serviceName: 'nguyen-trai-portfolio',
    propagators: ['tracecontext', 'baggage'],
    instrumentationConfig: {
      fetch: {
        propagateContextUrls: parsePropagationTargets(
          process.env.OTEL_PROPAGATE_CONTEXT_URLS
        ),
      },
    },
  });
}
