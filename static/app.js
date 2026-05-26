const form = document.querySelector("#conversion-form");
const statusNode = document.querySelector("#status");
const resultValue = document.querySelector("#result-value");
const resultUnit = document.querySelector("#result-unit");
const molarMass = document.querySelector("#molar-mass");
const totalAtoms = document.querySelector("#total-atoms");
const compositionNode = document.querySelector("#composition");
const stepsNode = document.querySelector("#steps");
const formulaChip = document.querySelector("#formula-chip");
const apiBase = window.location.protocol === "file:" ? "http://127.0.0.1:8000" : "";

const arrowByStep = {
  "Mass to moles": "mass-to-moles",
  "Moles to mass": "moles-to-mass",
  "Particles to moles": "particles-to-moles",
  "Moles to particles": "moles-to-particles",
};

form.addEventListener("submit", (event) => {
  event.preventDefault();
  updateConversion();
});

// Recalculate as soon as a dropdown changes so the visual map stays in sync.
for (const control of form.elements) {
  control.addEventListener("change", updateConversion);
}

document.querySelectorAll(".preset-row button").forEach((button) => {
  button.addEventListener("click", () => {
    form.elements.namedItem("formula").value = button.dataset.formula;
    form.elements.namedItem("value").value = button.dataset.value;
    form.elements.namedItem("fromUnit").value = button.dataset.fromUnit;
    form.elements.namedItem("toUnit").value = button.dataset.toUnit;
    updateConversion();
  });
});

applyInitialQueryValues();

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

async function updateConversion() {
  statusNode.textContent = "";

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

  if (!response.ok) {
    statusNode.textContent = payload.error || "Something went wrong.";
    return;
  }

  renderResult(payload);
}

function applyInitialQueryValues() {
  const params = new URLSearchParams(window.location.search);

  for (const [name, value] of params.entries()) {
    const field = form.elements.namedItem(name);
    if (field) {
      field.value = value;
    }
  }
}

function renderResult(payload) {
  formulaChip.textContent = payload.formula;
  resultValue.textContent = formatNumber(payload.result);
  resultUnit.textContent = payload.resultUnit;
  molarMass.textContent = `${formatNumber(payload.molarMass)} g/mol`;
  totalAtoms.textContent = formatNumber(payload.totalAtoms);

  renderComposition(payload.composition);
  renderSteps(payload.steps);
  highlightMap(payload);
  updatePresetState(payload);
}

function renderComposition(composition) {
  compositionNode.replaceChildren();

  for (const [symbol, count] of Object.entries(composition).sort()) {
    const item = document.createElement("div");
    item.className = "composition-pill";
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

function updatePresetState(payload) {
  document.querySelectorAll(".preset-row button").forEach((button) => {
    const isActive =
      button.dataset.formula === payload.formula &&
      button.dataset.fromUnit === payload.fromUnit &&
      button.dataset.toUnit === payload.toUnit;

    button.classList.toggle("active", isActive);
  });
}

updateConversion();
