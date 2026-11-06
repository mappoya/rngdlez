const DEFAULT_TARGET_SCORE = 100000;

const extensionRoot = document.createElement("div");
extensionRoot.id = "rngdlez-extension";

const rollButton = document.createElement("button");
rollButton.className = "default-button main-button";
rollButton.type = "button";
rollButton.textContent = "Roll";
extensionRoot.appendChild(rollButton);

const clearButton = document.createElement("button");
clearButton.className = "default-button clear-button";
clearButton.type = "button";
clearButton.textContent = "Clear";
extensionRoot.appendChild(clearButton);

const toggleButton = document.createElement("button");
toggleButton.className = "default-button toggle-button";
toggleButton.type = "button";
toggleButton.textContent = "Auto: OFF";
toggleButton.setAttribute("aria-pressed", "false");

const controls = document.createElement("div");
controls.className = "status-controls";

const numberField = document.createElement("input");
numberField.className = "number-field";
numberField.type = "text";
numberField.inputMode = "numeric";
numberField.maxLength = 9;
numberField.value = String(DEFAULT_TARGET_SCORE);
numberField.setAttribute("aria-label", "Minimum score for auto roll");

numberField.addEventListener("input", () => {
  numberField.value = numberField.value.replace(/\D/g, "").slice(0, 9);
});

controls.append(numberField, toggleButton);
extensionRoot.appendChild(controls);
document.body.appendChild(extensionRoot);

// ---

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const pollInterval = 25;
let autoEnabled = false;
let autoRolling = false;
let initialized = false;
let rollInProgress = false;

const renderControls = () => {
  toggleButton.setAttribute("aria-pressed", String(autoEnabled));
  toggleButton.textContent = autoEnabled ? "Auto: ON" : "Auto: OFF";
  rollButton.disabled = !initialized || rollInProgress || autoRolling;
  clearButton.disabled = !initialized || rollInProgress || autoRolling;
  toggleButton.disabled = !initialized || rollInProgress || autoRolling;
  numberField.disabled = !initialized || rollInProgress || autoRolling;
};

const getTargetScore = () => {
  const score = Number(numberField.value);
  if (!Number.isSafeInteger(score) || score <= 0) {
    throw new Error("Enter a positive whole-number target score.");
  }
  return score;
};

const clearRollData = () => {
  localStorage.removeItem("rngdle_guest_roll_data");
  localStorage.removeItem("rngdle_guest_roll_date");
};

const waitForGenerateButton = async () => {
  const timeoutAt = Date.now() + 10000;
  while (Date.now() < timeoutAt) {
    const generateButton = document.querySelector(
      "button[aria-label='Generate a new number']",
    );
    if (generateButton) {
      return generateButton;
    }
    await sleep(pollInterval);
  }

  throw new Error("Timed out waiting for the game's Generate button.");
};

const waitForRollData = async (previousData) => {
  const timeoutAt = Date.now() + 10000;
  while (Date.now() < timeoutAt) {
    const data = localStorage.getItem("rngdle_guest_roll_data");
    if (data && data !== previousData) {
      return JSON.parse(data);
    }
    await sleep(pollInterval);
  }

  throw new Error("Timed out waiting for the new roll data.");
};

const resetAndReload = async (kickstart) => {
  clearRollData();
  await chrome.storage.local.set({
    rolled: false,
    kickstart,
    autoRolling,
    targetScore: Number(numberField.value) || DEFAULT_TARGET_SCORE,
  });
  location.reload();
};

async function performRoll() {
  const generateButton = await waitForGenerateButton();
  const previousData = localStorage.getItem("rngdle_guest_roll_data");
  generateButton.click();
  const data = await waitForRollData(previousData);
  const score = Number(data.totalScore);
  if (!Number.isFinite(score)) {
    throw new Error("The new roll data does not contain a valid total score.");
  }

  if (autoRolling && score < getTargetScore()) {
    await resetAndReload(true);
    return;
  }

  autoRolling = false;
  renderControls();
  await chrome.storage.local.set({ rolled: true, autoRolling: false });
  location.reload();
}

async function startRoll() {
  if (!initialized || rollInProgress || autoRolling) {
    return;
  }

  rollInProgress = true;
  renderControls();
  const { rolled = false } = await chrome.storage.local.get("rolled");
  autoRolling = autoEnabled;
  const targetScore = autoRolling ? getTargetScore() : DEFAULT_TARGET_SCORE;
  await chrome.storage.local.set({ autoRolling, targetScore });
  renderControls();

  if (
    rolled ||
    localStorage.getItem("rngdle_guest_roll_data") !== null
  ) {
    await resetAndReload(true);
    return;
  }

  await performRoll();
}

const stopAutoRollOnError = async (error) => {
  autoRolling = false;
  rollInProgress = false;
  renderControls();
  await chrome.storage.local.set({ autoRolling: false, kickstart: false });
  console.error("Roll failed:", error);
};

rollButton.addEventListener("click", () => {
  startRoll().catch((error) => {
    stopAutoRollOnError(error).catch((storageError) =>
      console.error("Could not stop auto roll after failure:", storageError),
    );
  });
});

clearButton.addEventListener("click", () => {
  if (!initialized || rollInProgress || autoRolling) {
    return;
  }
  rollInProgress = true;
  autoRolling = false;
  renderControls();
  resetAndReload(false).catch((error) => {
    rollInProgress = false;
    renderControls();
    console.error("Clear failed:", error);
  });
});

toggleButton.addEventListener("click", () => {
  autoEnabled = !autoEnabled;
  renderControls();
  chrome.storage.local
    .set({ autoEnabled })
    .catch((error) =>
      console.error("Could not save auto-roll setting:", error),
    );
});

numberField.addEventListener("change", () => {
  try {
    const targetScore = getTargetScore();
    chrome.storage.local
      .set({ targetScore })
      .catch((error) => console.error("Could not save target score:", error));
  } catch (error) {
    console.error("Invalid target score:", error);
  }
});

chrome.storage.local
  .get(["rolled", "kickstart", "autoEnabled", "autoRolling", "targetScore"])
  .then(async (state) => {
    autoEnabled = state.autoEnabled === true;
    autoRolling = state.autoRolling === true;
    numberField.value = String(state.targetScore || DEFAULT_TARGET_SCORE);
    initialized = true;
    renderControls();

    if (state.kickstart) {
      rollInProgress = true;
      renderControls();
      await chrome.storage.local.set({ kickstart: false });
      await performRoll();
    } else if (autoRolling) {
      autoRolling = false;
      renderControls();
      await chrome.storage.local.set({ autoRolling: false });
    }
  })
  .catch((error) => {
    autoRolling = false;
    rollInProgress = false;
    initialized = true;
    renderControls();
    chrome.storage.local
      .set({ autoRolling: false, kickstart: false })
      .catch((storageError) =>
        console.error("Could not save stopped auto-roll state:", storageError),
      );
    console.error("Extension startup failed:", error);
  });
