import { test } from "node:test";
import assert from "node:assert/strict";
import { ActiveTimeMeter } from "../apps/web/lib/active-time.ts";

test("opening a visible page alone never earns time", () => {
  const meter = new ActiveTimeMeter(0, true);
  for (let t = 1000; t <= 180000; t += 1000) meter.sample(t);
  assert.equal(meter.take(180000), 0);
});
test("counts interaction and stops exactly after sixty idle seconds", () => {
  const meter = new ActiveTimeMeter(0, true);
  meter.interact(0);
  let active = 0;
  for (let t = 1000; t <= 120000; t += 1000) {
    meter.sample(t);
    if (t % 15000 === 0) active += meter.take(t);
  }
  assert.equal(active, 60000);
  meter.interact(120000);
  assert.equal(meter.take(125000), 5000);
});
test("hiding or blurring pauses immediately and focus alone does not restart", () => {
  const meter = new ActiveTimeMeter(0, true);
  meter.interact(0);
  meter.setForeground(5000, false);
  for (let t = 6000; t <= 20000; t += 1000) meter.sample(t);
  meter.interact(20000); // input in a background tab is ignored
  meter.setForeground(25000, true);
  assert.equal(meter.take(30000), 5000);
  meter.interact(30000);
  assert.equal(meter.take(35000), 5000);
});
test("sleeping for days or throttling a timer does not create a backlog", () => {
  const meter = new ActiveTimeMeter(0, true);
  meter.interact(0);
  const days = 3 * 86400000;
  assert.equal(meter.take(days), 0);
  meter.interact(days);
  assert.equal(meter.take(days + 15000), 15000);
});
test("repeated inputs do not double count and pending reports are bounded", () => {
  const meter = new ActiveTimeMeter(0, true);
  for (let t = 0; t <= 90000; t += 1000) meter.interact(t);
  assert.equal(meter.totalMs, 90000);
  assert.equal(meter.take(90000), 30000);
  assert.equal(meter.take(90000), 0);
});
