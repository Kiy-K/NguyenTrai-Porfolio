import { registerOTel } from '@vercel/otel';

export function register() {
  registerOTel({
    serviceName: 'nguyen-trai-portfolio',
  });
}
