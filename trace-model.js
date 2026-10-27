/* Shared, renderer-neutral trace contract for AlgoScope.
 * Works in browsers and Node.js without a build step.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AlgoScopeTrace = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function createStep(step, context) {
    if (!step || !Array.isArray(step.a)) {
      throw new TypeError("A trace step must include an array snapshot in 'a'.");
    }
    const meta = context || {};
    const snapshot = step.a.map(Number);
    if (snapshot.some((value) => !Number.isFinite(value))) {
      throw new TypeError("Trace snapshots must contain only finite numbers.");
    }
    return {
      ...step,
      type: "algorithm-step",
      algorithm: String(meta.algorithm || "unknown"),
      index: Number.isInteger(meta.index) && meta.index >= 0 ? meta.index : 0,
      action: step.active && step.active.length > 1 ? "compare" : "update",
      line: null,
      variables: {
        comparisons: Number.isFinite(step.c) ? step.c : 0,
        writesOrSwaps: Number.isFinite(step.s) ? step.s : 0,
        activeIndices: Array.isArray(step.active) ? [...step.active] : [],
        searchRange: Array.isArray(step.range) ? [...step.range] : []
      },
      snapshot,
      explanation: String(step.msg || ""),
      metrics: {
        comparisons: Number.isFinite(step.c) ? step.c : 0,
        writesOrSwaps: Number.isFinite(step.s) ? step.s : 0
      }
    };
  }

  function validateTrace(trace) {
    if (!Array.isArray(trace)) return { valid: false, errors: ["Trace must be an array."] };
    const errors = [];
    trace.forEach((step, index) => {
      if (!step || step.type !== "algorithm-step") errors.push("Step " + index + " has an invalid type.");
      if (!step || !Array.isArray(step.snapshot)) errors.push("Step " + index + " is missing a snapshot.");
      if (!step || typeof step.explanation !== "string") errors.push("Step " + index + " is missing an explanation.");
      if (!step || !Number.isInteger(step.index) || step.index !== index) errors.push("Step " + index + " has a non-sequential index.");
    });
    return { valid: errors.length === 0, errors };
  }

  return { createStep, validateTrace };
});
