const form = document.querySelector("#conversion-form");
const statusNode = document.querySelector("#status");
const resultLabel = document.querySelector("#result-label");
const resultValue = document.querySelector("#result-value");
const resultUnit = document.querySelector("#result-unit");
const metricOneLabel = document.querySelector("#metric-one-label");
const metricTwoLabel = document.querySelector("#metric-two-label");
const molarMass = document.querySelector("#molar-mass");
const totalAtoms = document.querySelector("#total-atoms");
const compositionNode = document.querySelector("#composition");
const stepsNode = document.querySelector("#steps");
const formulaChip = document.querySelector("#formula-chip");
const submitButton = document.querySelector("#submit-button");
const conversionFields = document.querySelector(".conversion-fields");
const elementFields = document.querySelector(".element-fields");
const massPercentField = document.querySelector(".mass-percent-field");
const sampleFields = document.querySelector(".sample-fields");
const conversionVisual = document.querySelector("#conversion-visual");
const elementVisual = document.querySelector("#element-visual");
const formulaUnitsVisual = document.querySelector("#formula-units-visual");
const elementPercentFill = document.querySelector("#element-percent-fill");
const elementPercentLabel = document.querySelector("#element-percent-label");
const elementLegend = document.querySelector("#element-legend");
const sampleFlowValue = document.querySelector("#sample-flow-value");
const molesFlowValue = document.querySelector("#moles-flow-value");
const unitsFlowValue = document.querySelector("#units-flow-value");
const apiBase = window.location.protocol === "file:" ? "http://127.0.0.1:8000" : "";
let activeMode = "conversion";
let latestRequestId = 0;

const arrowByStep = {
  "Mass to moles": "mass-to-moles",
  "Moles to mass": "moles-to-mass",
  "Particles to moles": "particles-to-moles",
  "Moles to particles": "moles-to-particles",
};

form.addEventListener("submit", (event) => {
  event.preventDefault();
  updateCurrentMode();
});

// Recalculate as soon as a control changes so the visuals stay in sync.
for (const control of form.elements) {
  control.addEventListener("change", updateCurrentMode);
  if (control.tagName === "INPUT") {
    control.addEventListener("input", updateCurrentMode);
  }
}

document.querySelectorAll(".mode-switch button").forEach((button) => {
  button.addEventListener("click", () => {
    setMode(button.dataset.mode);
  });
});

document.querySelectorAll(".preset-row button").forEach((button) => {
  button.addEventListener("click", () => {
    setMode(button.dataset.mode, false);
    form.elements.namedItem("formula").value = button.dataset.formula;
    if (button.dataset.mode === "conversion") {
      form.elements.namedItem("value").value = button.dataset.value;
      form.elements.namedItem("fromUnit").value = button.dataset.fromUnit;
      form.elements.namedItem("toUnit").value = button.dataset.toUnit;
    } else {
      form.elements.namedItem("questionType").value = button.dataset.questionType;
      if (button.dataset.questionType === "massPercent") {
        form.elements.namedItem("element").value = button.dataset.element;
      } else {
        form.elements.namedItem("sampleValue").value = button.dataset.sampleValue;
        form.elements.namedItem("sampleUnit").value = button.dataset.sampleUnit;
      }
    }
    updateCurrentMode();
  });
});

applyInitialQueryValues();
setMode(activeMode, false);

function formatNumber(value) {
  if (value === 0) {
    return "0";
  }

  const absolute = Math.abs(value);
  if (absolute >= 1e6 || absolute < 0.001) {
    return value.toExponential(4);
  }

  return Number(value.toPrecision(6)).toString();
}

function formatPercent(value) {
  return `${Number(value.toPrecision(4)).toString()}%`;
}

async function updateCurrentMode() {
  if (activeMode === "element") {
    updateFocusedProblemFields();
    if (currentQuestionType() === "formulaUnits") {
      await updateFormulaUnits();
      return;
    }
    await updateElementAnalysis();
    return;
  }

  await updateConversion();
}

async function updateConversion() {
  statusNode.textContent = "";
  const requestId = ++latestRequestId;

  const params = new URLSearchParams(new FormData(form));
  let response;
  let payload;

  try {
    response = await fetch(`${apiBase}/api/convert?${params.toString()}`);
    payload = await response.json();
  } catch (error) {
    statusNode.textContent = "Start the Python server with python3 app.py, then refresh this page.";
    return;
  }

  if (requestId !== latestRequestId) {
    return;
  }

  if (!response.ok) {
    statusNode.textContent = payload.error || "Something went wrong.";
    return;
  }

  renderResult(payload);
}

function applyInitialQueryValues() {
  const params = new URLSearchParams(window.location.search);

  if (params.get("mode") === "element") {
    activeMode = "element";
  }

  if (params.has("questionType")) {
    activeMode = "element";
  }

  for (const [name, value] of params.entries()) {
    const field = form.elements.namedItem(name);
    if (field) {
      field.value = value;
    }
  }
}

function setMode(mode, shouldUpdate = true) {
  activeMode = mode === "element" ? "element" : "conversion";

  document.querySelectorAll(".mode-switch button").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === activeMode);
  });

  const isElementMode = activeMode === "element";
  conversionFields.classList.toggle("hidden", isElementMode);
  conversionVisual.classList.toggle("hidden", isElementMode);
  elementFields.classList.toggle("hidden", !isElementMode);
  elementVisual.classList.toggle("hidden", true);
  formulaUnitsVisual.classList.toggle("hidden", true);
  submitButton.textContent = isElementMode ? "Solve focused problem" : "Convert";

  if (
    isElementMode &&
    form.elements.namedItem("formula").value === "H2O" &&
    form.elements.namedItem("element").value === "Cl"
  ) {
    form.elements.namedItem("formula").value = "HCl";
  }

  updateFocusedProblemFields();

  if (shouldUpdate) {
    updateCurrentMode();
  }
}

function currentQuestionType() {
  return form.elements.namedItem("questionType").value;
}

function updateFocusedProblemFields() {
  const isFormulaUnits = currentQuestionType() === "formulaUnits";
  massPercentField.classList.toggle("hidden", isFormulaUnits);
  sampleFields.classList.toggle("hidden", !isFormulaUnits);
}

function renderResult(payload) {
  resultLabel.textContent = "Result";
  formulaChip.textContent = payload.formula;
  resultValue.textContent = formatNumber(payload.result);
  resultUnit.textContent = payload.resultUnit;
  metricOneLabel.textContent = "Molar mass";
  metricTwoLabel.textContent = "Total atoms";
  molarMass.textContent = `${formatNumber(payload.molarMass)} g/mol`;
  totalAtoms.textContent = formatNumber(payload.totalAtoms);

  renderComposition(payload.composition);
  renderSteps(payload.steps);
  highlightMap(payload);
  elementVisual.classList.add("hidden");
  formulaUnitsVisual.classList.add("hidden");
  updatePresetState({
    mode: "conversion",
    formula: payload.formula,
    fromUnit: payload.fromUnit,
    toUnit: payload.toUnit,
  });
}

async function updateElementAnalysis() {
  statusNode.textContent = "";
  const requestId = ++latestRequestId;

  const params = new URLSearchParams(new FormData(form));
  let response;
  let payload;

  try {
    response = await fetch(`${apiBase}/api/element?${params.toString()}`);
    payload = await response.json();
  } catch (error) {
    statusNode.textContent = "Start the Python server with python3 app.py, then refresh this page.";
    return;
  }

  if (requestId !== latestRequestId) {
    return;
  }

  if (!response.ok) {
    statusNode.textContent = payload.error || "Something went wrong.";
    return;
  }

  renderElementAnalysis(payload);
}

function renderElementAnalysis(payload) {
  resultLabel.textContent = "Mass percent";
  formulaChip.textContent = `${payload.element} in ${payload.formula}`;
  resultValue.textContent = formatPercent(payload.massPercent);
  resultUnit.textContent = "by mass";
  metricOneLabel.textContent = "Molar mass";
  metricTwoLabel.textContent = `${payload.element} mass`;
  molarMass.textContent = `${formatNumber(payload.molarMass)} g/mol`;
  totalAtoms.textContent = `${formatNumber(payload.elementMass)} g/mol`;

  renderComposition(payload.composition, payload.element);
  renderSteps(payload.steps);
  renderElementVisual(payload);
  elementVisual.classList.remove("hidden");
  formulaUnitsVisual.classList.add("hidden");
  updatePresetState({
    mode: "element",
    questionType: "massPercent",
    formula: payload.formula,
    element: payload.element,
  });
}

async function updateFormulaUnits() {
  statusNode.textContent = "";
  const requestId = ++latestRequestId;

  const params = new URLSearchParams(new FormData(form));
  let response;
  let payload;

  try {
    response = await fetch(`${apiBase}/api/formula-units?${params.toString()}`);
    payload = await response.json();
  } catch (error) {
    statusNode.textContent = "Start the Python server with python3 app.py, then refresh this page.";
    return;
  }

  if (requestId !== latestRequestId) {
    return;
  }

  if (!response.ok) {
    statusNode.textContent = payload.error || "Something went wrong.";
    return;
  }

  renderFormulaUnits(payload);
}

function renderFormulaUnits(payload) {
  resultLabel.textContent = "Formula units";
  formulaChip.textContent = payload.formula;
  resultValue.textContent = formatNumber(payload.formulaUnits);
  resultUnit.textContent = "formula units";
  metricOneLabel.textContent = "Sample moles";
  metricTwoLabel.textContent = "Molar mass";
  molarMass.textContent = `${formatNumber(payload.sampleMoles)} mol`;
  totalAtoms.textContent = `${formatNumber(payload.molarMass)} g/mol`;

  renderComposition(payload.composition);
  renderSteps(payload.steps);
  renderFormulaUnitsVisual(payload);
  elementVisual.classList.add("hidden");
  formulaUnitsVisual.classList.remove("hidden");
  updatePresetState({
    mode: "element",
    questionType: "formulaUnits",
    formula: payload.formula,
    sampleUnit: payload.sampleUnit,
  });
}

function renderComposition(composition, focusedElement = "") {
  compositionNode.replaceChildren();

  for (const [symbol, count] of Object.entries(composition).sort()) {
    const item = document.createElement("div");
    item.className = "composition-pill";
    item.classList.toggle("selected", symbol === focusedElement);
    item.innerHTML = `<strong>${symbol}</strong><span>x ${count}</span>`;
    compositionNode.append(item);
  }
}

function renderSteps(steps) {
  stepsNode.replaceChildren();

  for (const step of steps) {
    const item = document.createElement("li");
    item.className = `step-item ${step.color}`;

    const title = document.createElement("strong");
    title.className = "step-title";
    title.textContent = step.title;

    const expression = document.createElement("p");
    expression.className = "step-expression";
    expression.textContent = step.expression;

    const result = document.createElement("div");
    result.className = "step-result";
    result.textContent = `= ${formatNumber(step.result)} ${step.unit}`;

    item.append(title, expression, result);
    stepsNode.append(item);
  }
}

function highlightMap(payload) {
  // The backend returns math steps; the frontend maps those steps to arrows.
  document.querySelectorAll(".map-arrow, .map-node").forEach((node) => {
    node.classList.remove("active");
  });

  const activeUnits = new Set([payload.fromUnit, payload.toUnit]);

  for (const step of payload.steps) {
    const arrowId = arrowByStep[step.title];
    if (arrowId) {
      document.querySelector(`#${arrowId}`).classList.add("active");
      activeUnits.add("moles");
    }
  }

  for (const unit of activeUnits) {
    const node = document.querySelector(`.map-node[data-unit="${unit}"]`);
    if (node) {
      node.classList.add("active");
    }
  }
}

function renderElementVisual(payload) {
  const width = Math.max(0, Math.min(100, payload.massPercent));
  elementPercentFill.style.width = `${width}%`;
  elementPercentLabel.textContent = formatPercent(payload.massPercent);
  elementLegend.textContent = payload.element;
}

function renderFormulaUnitsVisual(payload) {
  const sampleUnitLabel = payload.sampleUnit === "mass" ? "g" : "mol";
  sampleFlowValue.textContent = `${formatNumber(payload.sampleValue)} ${sampleUnitLabel}`;
  molesFlowValue.textContent = `${formatNumber(payload.sampleMoles)} mol`;
  unitsFlowValue.textContent = formatNumber(payload.formulaUnits);
}

function updatePresetState(payload) {
  document.querySelectorAll(".preset-row button").forEach((button) => {
    let isActive = false;

    if (payload.mode === "conversion") {
      isActive =
        button.dataset.mode === "conversion" &&
        button.dataset.formula === payload.formula &&
        button.dataset.fromUnit === payload.fromUnit &&
        button.dataset.toUnit === payload.toUnit;
    }

    if (payload.mode === "element") {
      isActive =
        button.dataset.mode === "element" &&
        button.dataset.questionType === payload.questionType &&
        button.dataset.formula === payload.formula &&
        (payload.questionType === "massPercent"
          ? button.dataset.element === payload.element
          : button.dataset.sampleUnit === payload.sampleUnit);
    }

    button.classList.toggle("active", isActive);
  });
}

updateCurrentMode();
