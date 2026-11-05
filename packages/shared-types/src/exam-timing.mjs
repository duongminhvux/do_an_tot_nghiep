/** Shared by the exam preview and the server that creates the attempt. */
export function examTimeLimitSeconds(mode, parts, selectedParts, exam = {}) {
  const settings = exam.timingSettings;
  const configured =
    mode === "TEST"
      ? settings?.testDurationMinutes
      : settings?.practiceDurationMinutes;
  if (
    Number.isInteger(configured) &&
    configured >= (mode === "TEST" ? 1 : 0) &&
    configured <= 1440
  ) {
    return configured === 0 ? undefined : configured * 60;
  }
  if (mode !== "TEST") return undefined;
  if (selectedParts.length === 7 && exam.durationMinutes > 0)
    return exam.durationMinutes * 60;
  const seconds = parts
    .filter((p) => selectedParts.includes(p.part))
    .reduce(
      (sum, p) => sum + (p.totalQuestions ?? 1) * (p.part <= 4 ? 27 : 45),
      0,
    );
  return Math.max(60, Math.ceil(seconds / 60) * 60);
}
