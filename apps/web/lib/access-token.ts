export function isAccessTokenValid(token: string | null): token is string {
  if (!token) return false;

  try {
    const encodedPayload = token.split(".")[1];
    if (!encodedPayload) return false;
    const base64 = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(
      atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")),
    );
    return (
      typeof payload.exp === "number" && payload.exp * 1000 > Date.now() + 5000
    );
  } catch {
    return false;
  }
}
