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
    const child = `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; worker-src blob:"><script>
      (() => {
        const send = (type, values) => parent.postMessage({ channel: "algoscope-js-playground", type, values }, "*");
        const userCode = ${JSON.stringify(source)};
        const workerSource = \`
          const send = (type, values) => postMessage({ type, values });
          const format = value => {
            if (typeof value === "string") return value;
            try { return JSON.stringify(value); } catch (_) { return String(value); }
          };
          console.log = (...args) => send("log", args.map(format));
          console.info = (...args) => send("log", args.map(format));
          console.warn = (...args) => send("warn", args.map(format));
          console.error = (...args) => send("error", args.map(format));
          self.onerror = (event) => { send("runtime-error", [String(event.message || "Runtime error")]); return true; };
          try { (new Function(${JSON.stringify(source)}))(); send("done", []); }
          catch (error) { send("runtime-error", [error && error.stack ? error.stack : String(error)]); }
        \`;
        try {
          const blobUrl = URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" }));
          const worker = new Worker(blobUrl);
          worker.onmessage = event => send(event.data.type, event.data.values || []);
          worker.onerror = event => send("runtime-error", [String(event.message || "Worker error")]);
          setTimeout(() => { worker.terminate(); URL.revokeObjectURL(blobUrl); send("timeout", ["Execution stopped: time limit exceeded."]); }, 1200);
        } catch (error) {
          send("runtime-error", ["Sandbox worker could not start: " + String(error)]);
        }
      })();
    <\/script>`;
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
        frame.remove();
        activeFrame = null;
        window.removeEventListener("message", receive);
        return;
      }
      if (data.type === "timeout") {
        if (timeoutId !== null) clearTimeout(timeoutId);
        timeoutId = null;
        runButton.disabled = false;
        runButton.textContent = "▶ Run code";
        output.classList.add("error");
        output.textContent = lines.join("\n") + (lines.length ? "\n" : "") + "Execution stopped: time limit exceeded.";
        runStatus.textContent = "The sandbox worker was terminated after the time limit.";
        frame.remove();
        activeFrame = null;
        window.removeEventListener("message", receive);
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
        frame.remove();
        activeFrame = null;
        window.removeEventListener("message", receive);
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
  let initial = [5, 2, 4, 1, 3];

  const traceCodeLines = [
    "function bubbleSort(values) {",
    "  const a = [...values];",
    "  let swaps = 0;",
    "  for (let end = a.length - 1; end > 0; end--) {",
    "    let changed = false;",
    "    for (let i = 0; i < end; i++) {",
    "      // Compare neighboring values",
    "      if (a[i] > a[i + 1]) {",
    "        [a[i], a[i + 1]] = [a[i + 1], a[i]];",
    "        swaps++; changed = true;",
    "      }",
    "    }",
    "    if (!changed) break;",
    "  }",
    "  return { sorted: a, swaps };",
    "}"
  ];

  function buildTrace() {
    const values = [...initial];
    let comparisons = 0;
    let swaps = 0;
    trace = [{ a: [...values], active: [], sorted: [], comparisons, swaps, line: 1, explanation: "Start here: the function receives an array and will sort a copy." }];
    trace.push({ a: [...values], active: [], sorted: [], comparisons, swaps, line: 2, explanation: "Create a copy so the original input array is not modified." });
    trace.push({ a: [...values], active: [], sorted: [], comparisons, swaps, line: 3, explanation: "Initialize the swap counter to zero." });
    for (let end = values.length - 1; end > 0; end--) {
      trace.push({ a: [...values], active: [], sorted: [], comparisons, swaps, line: 4, explanation: "Start a pass. The unsorted section ends at index " + end + "." });
      let changed = false;
      trace.push({ a: [...values], active: [], sorted: [], comparisons, swaps, line: 5, explanation: "Assume this pass will not need a swap. If no swap happens, the array is already sorted." });
      for (let i = 0; i < end; i++) {
        comparisons++;
        trace.push({ a: [...values], active: [i, i + 1], sorted: [], comparisons, swaps, line: 6, explanation: "Select adjacent positions " + i + " and " + (i + 1) + " for comparison." });
        trace.push({ a: [...values], active: [i, i + 1], sorted: [], comparisons, swaps, line: 7, explanation: "Compare " + values[i] + " with " + values[i + 1] + "." });
        if (values[i] > values[i + 1]) {
          trace.push({ a: [...values], active: [i, i + 1], sorted: [], comparisons, swaps, line: 8, explanation: values[i] + " is greater than " + values[i + 1] + ", so the condition is true." });
          [values[i], values[i + 1]] = [values[i + 1], values[i]];
          swaps++;
          changed = true;
          trace.push({ a: [...values], active: [i, i + 1], sorted: [], comparisons, swaps, line: 9, explanation: "Swap the two neighboring values. The array is now " + values.join(", ") + "." });
          trace.push({ a: [...values], active: [i, i + 1], sorted: [], comparisons, swaps, line: 10, explanation: "Record the swap and mark that this pass changed the array." });
        } else {
          trace.push({ a: [...values], active: [i, i + 1], sorted: [], comparisons, swaps, line: 8, explanation: values[i] + " is not greater than " + values[i + 1] + ", so no swap is needed." });
        }
      }
      trace.push({ a: [...values], active: [], sorted: values.map((_, index) => index).filter(index => index >= end), comparisons, swaps, line: 12, explanation: "The pass is complete. The largest value from the unsorted section has reached index " + end + "." });
      if (!changed) {
        trace.push({ a: [...values], active: [], sorted: values.map((_, index) => index), comparisons, swaps, line: 13, explanation: "No swaps occurred in this pass, so stop early: the array is sorted." });
        break;
      }
    }
    trace.push({ a: [...values], active: [], sorted: values.map((_, index) => index), comparisons, swaps, line: 15, explanation: "Return the sorted copy and the total number of swaps." });
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
    const codeStage = $("#trace-code");
    if (codeStage) {
      codeStage.replaceChildren();
      traceCodeLines.forEach((line, index) => {
        const row = document.createElement("div");
        row.className = "trace-code-line" + (index + 1 === step.line ? " current" : "");
        const number = document.createElement("span");
        number.className = "trace-line-number";
        number.textContent = String(index + 1);
        const content = document.createElement("code");
        content.textContent = line;
        row.append(number, content);
        codeStage.appendChild(row);
      });
      const current = codeStage.querySelector(".current");
      if (current) current.scrollIntoView({ block: "nearest" });
    }
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
  $("#apply-array").addEventListener("click", () => {
    const raw = $("#custom-array").value.trim();
    const parts = raw.split(/[\s,;]+/).filter(Boolean);
    const values = parts.map(Number);
    const status = $("#array-status");
    if (parts.length < 2 || parts.length > 12 || values.some(value => !Number.isInteger(value) || value < 1 || value > 999)) {
      status.textContent = "Enter 2–12 positive integers from 1 to 999, separated by commas or spaces.";
      status.classList.add("error");
      return;
    }
    initial = values;
    buildTrace();
    status.textContent = "Trace updated for " + values.length + " values.";
    status.classList.remove("error");
    if (exampleSelect.value === "bubble") {
      codeInput.value = [
        "function bubbleSort(values) {",
        "  const a = [...values];",
        "  let swaps = 0;",
        "  for (let end = a.length - 1; end > 0; end--) {",
        "    let changed = false;",
        "    for (let i = 0; i < end; i++) {",
        "      console.log(\"Compare\", a[i], a[i + 1]);",
        "      if (a[i] > a[i + 1]) {",
        "        [a[i], a[i + 1]] = [a[i + 1], a[i]];",
        "        swaps++; changed = true;",
        "      }",
        "    }",
        "    if (!changed) break;",
        "  }",
        "  console.log(\"Sorted:\", a, \"Swaps:\", swaps);",
        "}",
        "bubbleSort([" + values.join(", ") + "]);"
      ].join("\n");
    }
  });
    $("#trace-prev").addEventListener("click", () => { traceIndex = Math.max(0, traceIndex - 1); renderTrace(); });
  $("#trace-next").addEventListener("click", () => { traceIndex = Math.min(trace.length - 1, traceIndex + 1); renderTrace(); });
  $("#trace-reset").addEventListener("click", () => { traceIndex = 0; renderTrace(); });
  $("#trace-timeline").addEventListener("input", (event) => { traceIndex = Number(event.target.value); renderTrace(); });

  const exerciseQuestions = [
    { question: "Why does Bubble Sort compare neighboring values?", options: ["To move out-of-order values toward the end", "To find the middle element", "To remove duplicate values"], answer: 0, explanation: "Adjacent comparisons move larger values rightward during each pass." },
    { question: "When should the algorithm swap a[i] and a[i + 1]?", options: ["Whenever i is even", "When a[i] is greater than a[i + 1]", "When both values are equal"], answer: 1, explanation: "For ascending order, swap only when the left value is greater than the right value." },
    { question: "What does changed = false help detect?", options: ["Whether the array contains strings", "Whether a pass made no swaps", "How many values are in the array"], answer: 1, explanation: "If a complete pass makes no swaps, the array is already sorted and the algorithm can stop early." }
  ];
  function renderExercises() {
    const root = $("#exercise-list");
    if (!root) return;
    root.replaceChildren();
    exerciseQuestions.forEach((item, index) => {
      const card = document.createElement("fieldset");
      card.className = "exercise-question";
      const legend = document.createElement("legend");
      legend.textContent = (index + 1) + ". " + item.question;
      card.appendChild(legend);
      item.options.forEach((option, optionIndex) => {
        const label = document.createElement("label");
        label.className = "exercise-option";
        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = "exercise-" + index;
        radio.value = String(optionIndex);
        label.append(radio, document.createTextNode(option));
        card.appendChild(label);
      });
      const feedback = document.createElement("p");
      feedback.className = "exercise-feedback";
      feedback.id = "exercise-feedback-" + index;
      feedback.setAttribute("aria-live", "polite");
      card.appendChild(feedback);
      root.appendChild(card);
    });
  }
  $("#check-exercises").addEventListener("click", () => {
    let answered = 0, correct = 0;
    exerciseQuestions.forEach((item, index) => {
      const selected = document.querySelector('input[name="exercise-' + index + '"]:checked');
      const feedback = $("#exercise-feedback-" + index);
      feedback.classList.remove("correct", "incorrect");
      if (!selected) {
        feedback.textContent = "Choose an answer. " + item.explanation;
        feedback.classList.add("incorrect");
        return;
      }
      answered++;
      if (Number(selected.value) === item.answer) {
        correct++;
        feedback.textContent = "Correct. " + item.explanation;
        feedback.classList.add("correct");
      } else {
        feedback.textContent = "Not quite. Correct answer: " + item.options[item.answer] + ". " + item.explanation;
        feedback.classList.add("incorrect");
      }
    });
    $("#exercise-score").textContent = "Score: " + correct + " / " + exerciseQuestions.length + " · Answered: " + answered + " / " + exerciseQuestions.length;
  });
  $("#reset-exercises").addEventListener("click", () => {
    document.querySelectorAll('#exercise-list input[type="radio"]').forEach(input => { input.checked = false; });
    document.querySelectorAll(".exercise-feedback").forEach(feedback => { feedback.textContent = ""; feedback.classList.remove("correct", "incorrect"); });
    $("#exercise-score").textContent = "Answer the questions, then check your work.";
  });
  window.addEventListener("beforeunload", stopCurrentRun);
  const year = $("#year");
  if (year) year.textContent = String(new Date().getFullYear());
  buildTrace();
  renderExercises();
})();