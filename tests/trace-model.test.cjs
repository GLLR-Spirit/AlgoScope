const test = require("node:test");
const assert = require("node:assert/strict");
const { createStep, validateTrace } = require("../trace-model.js");

test("createStep preserves renderer fields and adds a neutral trace schema", () => {
  const step = createStep(
    { a: [3, 1], active: [0, 1], sorted: [], c: 1, s: 1, msg: "Swap the pair." },
    { algorithm: "bubble-sort", index: 0 }
  );
  assert.deepEqual(step.a, [3, 1]);
  assert.deepEqual(step.snapshot, [3, 1]);
  assert.equal(step.algorithm, "bubble-sort");
  assert.equal(step.index, 0);
  assert.equal(step.action, "compare");
  assert.equal(step.explanation, "Swap the pair.");
  assert.equal(step.metrics.comparisons, 1);
  assert.deepEqual(validateTrace([step]), { valid: true, errors: [] });
});

test("createStep rejects missing and non-numeric snapshots", () => {
  assert.throws(() => createStep({ msg: "missing array" }), /snapshot/);
  assert.throws(() => createStep({ a: [1, NaN] }), /finite numbers/);
});

test("validateTrace reports malformed and out-of-order steps", () => {
  const result = validateTrace([
    { type: "algorithm-step", snapshot: [1], explanation: "ok", index: 2 },
    { type: "unknown", snapshot: null, index: 1 }
  ]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.length >= 4);
});

test("validateTrace rejects a non-array input", () => {
  assert.equal(validateTrace(null).valid, false);
});
