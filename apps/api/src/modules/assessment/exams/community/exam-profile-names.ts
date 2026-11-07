import { serviceUrl } from '../../../../postgres/ownership.js';
export async function resolveExamNames(
  ids: (string | null)[],
): Promise<Record<string, string | null>> {
  const unique = [...new Set(ids.filter((id): id is string => !!id))];
  const token = process.env.INTERNAL_SERVICE_TOKEN;
  if (!unique.length || !token || token.length < 24) return {};
  try {
    const response = await fetch(
      `${serviceUrl('identity')}/api/_internal/exam-community/profiles`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-internal-token': token,
        },
        body: JSON.stringify({ ids: unique }),
        signal: AbortSignal.timeout(3000),
      },
    );
    if (!response.ok) return {};
    const body = await response.json();
    return body.data ?? body;
  } catch {
    return {};
  }
}
