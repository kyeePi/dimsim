(() => {
  "use strict";

  const DEFAULT_SETTINGS = {
    enabled: true,
    startTime: "09:00",
    endTime: "17:00",
    shadeColor: "#5f6368",
    patternEnabled: false,
    patternStyle: "diagonal",
    opacity: 0.18
  };

  const form = document.querySelector("#settings-form");
  const status = document.querySelector("#status");
  const fields = {
    enabled: document.querySelector("#enabled"),
    startTime: document.querySelector("#startTime"),
    endTime: document.querySelector("#endTime"),
    shadeColor: document.querySelector("#shadeColor"),
    patternEnabled: document.querySelector("#patternEnabled"),
    patternStyle: document.querySelector("#patternStyle"),
    opacity: document.querySelector("#opacity")
  };

  chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
    fields.enabled.checked = settings.enabled !== false;
    fields.startTime.value = settings.startTime || DEFAULT_SETTINGS.startTime;
    fields.endTime.value = settings.endTime || DEFAULT_SETTINGS.endTime;
    fields.shadeColor.value = settings.shadeColor || DEFAULT_SETTINGS.shadeColor;
    fields.patternEnabled.checked = settings.patternEnabled === true;
    fields.patternStyle.value = settings.patternStyle || DEFAULT_SETTINGS.patternStyle;
    fields.opacity.value = String(settings.opacity || DEFAULT_SETTINGS.opacity);
    updateStatus("Saved settings apply to open Calendar tabs.");
  });

  form.addEventListener("input", saveSettings);
  form.addEventListener("change", saveSettings);

  function saveSettings() {
    const settings = {
      enabled: fields.enabled.checked,
      startTime: fields.startTime.value,
      endTime: fields.endTime.value,
      shadeColor: fields.shadeColor.value,
      patternEnabled: fields.patternEnabled.checked,
      patternStyle: fields.patternStyle.value,
      opacity: Number(fields.opacity.value)
    };

    if (settings.startTime >= settings.endTime) {
      updateStatus("Start time must be before end time.");
      return;
    }

    chrome.storage.sync.set(settings, () => {
      updateStatus("Saved.");
    });
  }

  function updateStatus(message) {
    status.textContent = message;
  }
})();
