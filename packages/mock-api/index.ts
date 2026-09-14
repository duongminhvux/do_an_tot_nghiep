export type MockScenario = "success" | "empty" | "error" | "slow" | "permission" | "failed-tts" | "publish-validation";
export const mockDelay = (scenario: MockScenario = "success") => scenario === "slow" ? 1500 : 320;
export const requestId = (name: string) => `mock-${name}-request`;
