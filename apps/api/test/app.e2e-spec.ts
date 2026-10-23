import { describe, expect, it } from 'vitest';

// Runs against an actual Compose stack only when opted in. The old test
// booted the retired monolith AppModule and expected a deleted Hello World
// controller, so it could not test the deployed microservices.
const gateway = process.env.E2E_GATEWAY_URL?.replace(/\/$/, '');

describe.skipIf(!gateway)('Gateway microservices (live Compose e2e)', () => {
  it('answers its own health endpoint', async () => {
    const response = await fetch(`${gateway}/gateway/health`);
    expect(response.status).toBe(200);
  });
  it('forwards Identity health instead of returning a local 404', async () => {
    const response = await fetch(`${gateway}/gateway/identity-health`);
    expect(response.status).toBe(200);
  });
  it('routes learner dashboard to Learning, with auth required', async () => {
    const response = await fetch(`${gateway}/api/learning-activity/home`);
    expect([401, 403]).toContain(response.status);
  });
});
