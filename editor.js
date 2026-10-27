(function () {
  "use strict";
  const $ = (selector) => document.querySelector(selector);
  const codeInput = $("#code-input");
  const exampleSelect = $("#example-select");
  const output = $("#console-output");
  const runStatus = $("#run-status");
  const runButton = $("#run-code");
  let activeFrame = null;
  let timeoutId = null;
  let runToken = 0;

  const examples = {
    hello: 'const greeting = "Hello, AlgoScope!";\nconsole.log(greeting);',
    loop: 'const values = [3, 5, 8, 2];\nlet total = 0;\nfor (const value of values) {\n  total += value;\n  console.log("Current value:", value, "total:", total);\n}\nconsole.log("Final total:", total);',
    bubble: 'function bubbleSort(values) {\n  const a = [...values];\n  let swaps = 0;\n  for (let end = a.length - 1; end > 0; end--) {\n    let changed = false;\n    for (let i = 0; i < end; i++) {\n      console.log("Compare", a[i], "and", a[i + 1]);\n      if (a[i] > a[i + 1]) {\n        [a[i], a[i + 1]] = [a[i + 1], a[i]];\n        swaps++; changed = true;\n        console.log("Swap:", a);\n      }\n    }\n    if (!changed) break;\n  }\n  return { sorted: a, swaps };\n}\nconsole.log("Result:", bubbleSort([5, 2, 4, 1, 3]));'
  };

  function loadExample() {
    codeInput.value = examples[exampleSelect.value] || examples.hello;
    output.textContent = "Example loaded. Run the code to see output.";
    output.classList.remove("error");
    runStatus.textContent = "Ready to run in an isolated browser sandbox.";
    if (exampleSelect.value === "bubble") buildTrace();
  }

  function serialize(value) {
    if (typeof value === "string") return value;
    try { return JSON.stringify(value); } catch (_) { return String(value); }
  }

  function stopCurrentRun() {
    runToken++;
    if (timeoutId !== null) clearTimeout(timeoutId);
    timeoutId = null;
    if (activeFrame) activeFrame.remove();
    activeFrame = null;
    runButton.disabled = false;
    runButton.textContent = "▶ Run code";
  }

  function runCode() {
    stopCurrentRun();
    const token = runToken;
    const lines = [];
    output.classList.remove("error");
    output.textContent = "Running…";
    runStatus.textContent = "Running in a disposable sandbox. The execution limit is 1.5 seconds.";
    runButton.disabled = true;
    runButton.textContent = "Running…";
    const frame = document.createElement("iframe");
    frame.title = "Isolated JavaScript execution";
    frame.setAttribute("sandbox", "allow-scripts");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:absolute;width:1px;height:1px;left:-10000px;border:0";
    activeFrame = frame;
    const source = codeInput.value;
    const child = `<!doctype html><meta charset="utf-8"><script>
      (() => {
        const send = (type, values) => parent.postMessage({ channel: "algoscope-js-playground", type, values }, "*");
        const format = value => {
          if (typeof value === "string") return value;
          try { return JSON.stringify(value); } catch (_) { return String(value); }
        };
        console.log = (...args) => send("log", args.map(format));
        console.info = (...args) => send("log", args.map(format));
        console.warn = (...args) => send("warn", args.map(format));
        console.error = (...args) => send("error", args.map(format));
        window.onerror = (message, source, line, column) => { send("runtime-error", [String(message) + " (line " + line + ")"]); return true; };
        try { (new Function(${JSON.stringify(source)}))(); send("done", []); }
        catch (error) { send("runtime-error", [error && error.stack ? error.stack : String(error)]); }
      })();
    </script>`;
    const receive = (event) => {
      if (event.source !== frame.contentWindow || !event.data || event.data.channel !== "algoscope-js-playground" || token !== runToken) return;
      const data = event.data;
      if (data.type === "done") {
        if (timeoutId !== null) clearTimeout(timeoutId);
        timeoutId = null;
        runButton.disabled = false;
        runButton.textContent = "▶ Run code";
        runStatus.textContent = "Execution finished.";
        if (!lines.length) output.textContent = "Finished without console output.";
        return;
      }
      const prefix = data.type === "warn" ? "Warning: " : data.type === "error" || data.type === "runtime-error" ? "Error: " : "";
      lines.push(prefix + (Array.isArray(data.values) ? data.values.join(" ") : ""));
      output.textContent = lines.join("\n");
      output.scrollTop = output.scrollHeight;
      if (data.type === "runtime-error") {
        output.classList.add("error");
        if (timeoutId !== null) clearTimeout(timeoutId);
        timeoutId = null;
        runButton.disabled = false;
        runButton.textContent = "▶ Run code";
        runStatus.textContent = "Execution stopped because of an error.";
      }
    };
    window.addEventListener("message", receive);
    frame.addEventListener("load", () => { frame.contentWindow.postMessage({ channel: "algoscope-start" }, "*"); });
    // srcdoc runs code itself; only messages from this specific sandboxed frame are accepted.
    frame.srcdoc = child;
    document.body.appendChild(frame);
    timeoutId = setTimeout(() => {
      if (token !== runToken) return;
      frame.remove();
      activeFrame = null;
      window.removeEventListener("message", receive);
      timeoutId = null;
      runButton.disabled = false;
      runButton.textContent = "▶ Run code";
      output.classList.add("error");
      output.textContent = lines.join("\n") + (lines.length ? "\n" : "") + "Execution stopped: time limit exceeded.";
      runStatus.textContent = "The sandbox was discarded after the time limit.";
    }, 1500);
    // Store cleanup on the frame so the message listener is removed when the run ends.
    frame.dataset.listener = "active";
    frame.addEventListener("remove", () => window.removeEventListener("message", receive));
  }

  let trace = [];
  let traceIndex = 0;
  const initial = [5, 2, 4, 1, 3];

  function buildTrace() {
    const values = [...initial];
    let comparisons = 0;
    let swaps = 0;
    trace = [{ a: [...values], active: [], sorted: [], comparisons, swaps, explanation: "Starting array. Bubble Sort compares neighboring values and swaps them when they are out of order." }];
    for (let end = values.length - 1; end > 0; end--) {
      let changed = false;
      for (let i = 0; i < end; i++) {
        comparisons++;
        trace.push({ a: [...values], active: [i, i + 1], sorted: [], comparisons, swaps, explanation: "Compare " + values[i] + " and " + values[i + 1] + "." });
        if (values[i] > values[i + 1]) {
          [values[i], values[i + 1]] = [values[i + 1], values[i]];
          swaps++;
          changed = true;
          trace.push({ a: [...values], active: [i, i + 1], sorted: [], comparisons, swaps, explanation: "They were out of order, so swap them. Total swaps: " + swaps + "." });
        }
      }
      trace.push({ a: [...values], active: [], sorted: values.map((_, index) => index).filter(index => index > end - 1), comparisons, swaps, explanation: "The largest remaining value is now at the end of the unsorted section." });
      if (!changed) break;
    }
    trace.push({ a: [...values], active: [], sorted: values.map((_, index) => index), comparisons, swaps, explanation: "Finished. The array is sorted in ascending order." });
    traceIndex = 0;
    renderTrace();
  }

  function renderTrace() {
    if (!trace.length) buildTrace();
    const step = trace[traceIndex];
    const stage = $("#trace-stage");
    stage.replaceChildren();
    const max = Math.max(...step.a, 1);
    step.a.forEach((value, index) => {
      const bar = document.createElement("div");
      bar.className = "trace-bar" + (step.active.includes(index) ? " active" : "") + (step.sorted.includes(index) ? " sorted" : "");
      bar.style.height = Math.max(28, Math.round(value / max * 150)) + "px";
      bar.textContent = String(value);
      bar.title = "Index " + index + ": " + value;
      stage.appendChild(bar);
    });
    $("#trace-explanation").textContent = step.explanation;
    $("#trace-step").textContent = "Step " + (traceIndex + 1) + " / " + trace.length;
    $("#trace-counts").textContent = "Comparisons: " + step.comparisons + " · Swaps: " + step.swaps;
    $("#trace-timeline").max = String(trace.length - 1);
    $("#trace-timeline").value = String(traceIndex);
    $("#trace-prev").disabled = traceIndex === 0;
    $("#trace-next").disabled = traceIndex === trace.length - 1;
  }

  $("#run-code").addEventListener("click", runCode);
  $("#reset-code").addEventListener("click", loadExample);
  $("#clear-output").addEventListener("click", () => { output.textContent = "Console cleared."; output.classList.remove("error"); });
  exampleSelect.addEventListener("change", loadExample);
  codeInput.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); runCode(); }
    if (event.key === "Tab") {
      event.preventDefault();
      const start = codeInput.selectionStart, end = codeInput.selectionEnd;
      codeInput.setRangeText("  ", start, end, "end");
    }
  });
  $("#trace-prev").addEventListener("click", () => { traceIndex = Math.max(0, traceIndex - 1); renderTrace(); });
  $("#trace-next").addEventListener("click", () => { traceIndex = Math.min(trace.length - 1, traceIndex + 1); renderTrace(); });
  $("#trace-reset").addEventListener("click", () => { traceIndex = 0; renderTrace(); });
  $("#trace-timeline").addEventListener("input", (event) => { traceIndex = Number(event.target.value); renderTrace(); });
  window.addEventListener("beforeunload", stopCurrentRun);
  const year = $("#year");
  if (year) year.textContent = String(new Date().getFullYear());
  buildTrace();
})();