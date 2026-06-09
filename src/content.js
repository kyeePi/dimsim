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

  const OVERLAY_ID = "dimsim-overlay";
  const LEGACY_OVERLAY_ID = "shade-cal-extension-overlay";
  const RENDER_DELAY_MS = 80;
  const MIN_HOUR_HEIGHT = 24;
  const MAX_HOUR_HEIGHT = 180;
  const MIN_DAY_GRID_HEIGHT = MIN_HOUR_HEIGHT * 24;
  const MAX_DAY_GRID_HEIGHT = MAX_HOUR_HEIGHT * 24;

  let settings = { ...DEFAULT_SETTINGS };
  let overlay;
  let renderTimer;

  function init() {
    document.getElementById(LEGACY_OVERLAY_ID)?.remove();
    overlay = createOverlay();
    const root = document.body || document.documentElement;
    root.append(overlay);

    chrome.storage.sync.get(DEFAULT_SETTINGS, (storedSettings) => {
      settings = normalizeSettings(storedSettings);
      scheduleRender();
    });

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "sync") {
        return;
      }

      settings = normalizeSettings({
        ...settings,
        ...Object.fromEntries(
          Object.entries(changes).map(([key, change]) => [key, change.newValue])
        )
      });
      scheduleRender();
    });

    const observer = new MutationObserver((mutations) => {
      if (mutations.every(isOverlayMutation)) {
        return;
      }
      scheduleRender();
    });
    observer.observe(root, {
      attributes: true,
      childList: true,
      subtree: true
    });

    window.addEventListener("resize", scheduleRender, { passive: true });
    window.addEventListener("scroll", scheduleRender, {
      passive: true,
      capture: true
    });
    document.addEventListener("visibilitychange", scheduleRender);
  }

  function isOverlayMutation(mutation) {
    if (!overlay) {
      return false;
    }

    const changedNodes = [...mutation.addedNodes, ...mutation.removedNodes];
    return (
      mutation.target === overlay ||
      overlay.contains(mutation.target) ||
      changedNodes.every((node) => node === overlay || overlay.contains(node))
    );
  }

  function createOverlay() {
    const node = document.createElement("div");
    node.id = OVERLAY_ID;
    node.setAttribute("aria-hidden", "true");
    node.style.position = "fixed";
    node.style.inset = "0";
    node.style.pointerEvents = "none";
    node.style.zIndex = "1";
    node.style.contain = "layout style paint";
    return node;
  }

  function normalizeSettings(rawSettings) {
    const startTime = isClockTime(rawSettings.startTime)
      ? rawSettings.startTime
      : DEFAULT_SETTINGS.startTime;
    const endTime = isClockTime(rawSettings.endTime)
      ? rawSettings.endTime
      : DEFAULT_SETTINGS.endTime;
    const opacity = Number(rawSettings.opacity);

    return {
      enabled: rawSettings.enabled !== false,
      startTime,
      endTime,
      shadeColor: isColor(rawSettings.shadeColor)
        ? rawSettings.shadeColor
        : DEFAULT_SETTINGS.shadeColor,
      patternEnabled: rawSettings.patternEnabled === true,
      patternStyle: isPatternStyle(rawSettings.patternStyle)
        ? rawSettings.patternStyle
        : DEFAULT_SETTINGS.patternStyle,
      opacity:
        Number.isFinite(opacity) && opacity >= 0.05 && opacity <= 0.6
          ? opacity
          : DEFAULT_SETTINGS.opacity
    };
  }

  function isClockTime(value) {
    return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  }

  function isColor(value) {
    return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
  }

  function isPatternStyle(value) {
    return ["diagonal", "crosshatch", "dots"].includes(value);
  }

  function hexToRgba(hex, alpha) {
    const red = parseInt(hex.slice(1, 3), 16);
    const green = parseInt(hex.slice(3, 5), 16);
    const blue = parseInt(hex.slice(5, 7), 16);

    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  function svgDataUrl(svg) {
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }

  function scheduleRender() {
    window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(render, RENDER_DELAY_MS);
  }

  function render() {
    if (!settings.enabled || document.hidden) {
      clearOverlay();
      return;
    }

    const startMinutes = clockTimeToMinutes(settings.startTime);
    const endMinutes = clockTimeToMinutes(settings.endTime);
    if (startMinutes === null || endMinutes === null || startMinutes >= endMinutes) {
      clearOverlay();
      return;
    }

    const metrics = getCalendarMetrics();
    if (!metrics) {
      clearOverlay();
      return;
    }

    const startY = metrics.yForMinutes(startMinutes);
    const endY = metrics.yForMinutes(endMinutes);
    const dayTop = metrics.yForMinutes(0);
    const dayBottom = metrics.yForMinutes(24 * 60);
    const blocks = [
      {
        top: Math.max(dayTop, metrics.clipTop),
        bottom: Math.min(startY, dayBottom, metrics.clipBottom)
      },
      {
        top: Math.max(endY, dayTop, metrics.clipTop),
        bottom: Math.min(dayBottom, metrics.clipBottom)
      }
    ].filter((block) => block.bottom - block.top > 1);

    clearOverlay();

    for (const block of blocks) {
      overlay.append(
        createShadeBlock({
          left: metrics.left,
          top: block.top,
          width: metrics.right - metrics.left,
          height: block.bottom - block.top
        })
      );
    }
  }

  function getCalendarMetrics() {
    const main = document.querySelector('[role="main"]') || document.body;
    const mainRect = main.getBoundingClientRect();
    if (!hasUsableRect(mainRect)) {
      return null;
    }

    const timedGridMetrics = getTimedGridMetrics(main, mainRect);
    if (timedGridMetrics) {
      return timedGridMetrics;
    }

    return getLabelBasedCalendarMetrics(main, mainRect);
  }

  function getTimedGridMetrics(main, mainRect) {
    const scrollFrames = getScrollableFrames(main);

    for (const scrollFrame of scrollFrames) {
      const metrics = getMetricsFromScrollFrame(scrollFrame, mainRect);
      if (metrics) {
        return metrics;
      }
    }

    return null;
  }

  function getScrollableFrames(root) {
    return Array.from(root.querySelectorAll("*"))
      .map((element) => ({
        element,
        rect: element.getBoundingClientRect()
      }))
      .filter(({ element, rect }) => {
        const style = window.getComputedStyle(element);
        const canScroll = /(auto|scroll|overlay)/.test(style.overflowY);

        return (
          canScroll &&
          element.scrollHeight > element.clientHeight + 20 &&
          rect.width > 200 &&
          rect.height > 100
        );
      })
      .sort((a, b) => scoreScrollFrame(b) - scoreScrollFrame(a))
      .map(({ element }) => element);
  }

  function scoreScrollFrame({ element, rect }) {
    return rect.width * rect.height + element.scrollHeight;
  }

  function getMetricsFromScrollFrame(scrollFrame, mainRect) {
    const frameRect = scrollFrame.getBoundingClientRect();
    const cells = collectTimedGridCells(scrollFrame, frameRect);
    if (cells.length === 0) {
      return null;
    }

    const maxHeight = Math.max(...cells.map((cell) => cell.rect.height));
    const fullDayCells = cells.filter(
      (cell) => Math.abs(cell.rect.height - maxHeight) <= Math.max(4, maxHeight * 0.05)
    );
    const gridTop = median(fullDayCells.map((cell) => cell.rect.top));
    const gridHeight = median(fullDayCells.map((cell) => cell.rect.height));
    const left = Math.max(
      Math.min(...fullDayCells.map((cell) => cell.rect.left)),
      frameRect.left
    );
    const right = Math.min(
      Math.max(...fullDayCells.map((cell) => cell.rect.right)),
      frameRect.right
    );
    const clipTop = Math.max(frameRect.top, mainRect.top, 0);
    const clipBottom = Math.min(frameRect.bottom, mainRect.bottom, window.innerHeight);

    if (
      !Number.isFinite(gridTop) ||
      !Number.isFinite(gridHeight) ||
      gridHeight < MIN_DAY_GRID_HEIGHT ||
      gridHeight > MAX_DAY_GRID_HEIGHT ||
      right - left < 80 ||
      clipBottom - clipTop < 80
    ) {
      return null;
    }

    return {
      left,
      right,
      clipTop,
      clipBottom,
      yForMinutes(minutes) {
        return gridTop + (minutes / (24 * 60)) * gridHeight;
      }
    };
  }

  function collectTimedGridCells(scrollFrame, frameRect) {
    return Array.from(scrollFrame.querySelectorAll('[role="gridcell"]'))
      .map((element) => ({
        element,
        rect: element.getBoundingClientRect()
      }))
      .filter(({ rect }) => {
        return (
          hasUsableRect(rect) &&
          rect.width >= 40 &&
          rect.height >= MIN_DAY_GRID_HEIGHT &&
          rect.top <= frameRect.top + 8 &&
          rect.bottom >= frameRect.bottom - 8 &&
          rect.right > frameRect.left &&
          rect.left < frameRect.right
        );
      });
  }

  function median(values) {
    if (values.length === 0) {
      return null;
    }

    const sorted = values.slice().sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }

  function getLabelBasedCalendarMetrics(main, mainRect) {
    const labels = collectTimeLabels(main);
    const group = getBestTimeLabelGroup(labels);
    if (!group) {
      return null;
    }

    const hourHeight = getMedianHourHeight(group);
    if (!hourHeight) {
      return null;
    }

    const anchor = group
      .slice()
      .sort((a, b) => Math.abs(a.hour - 12) - Math.abs(b.hour - 12))[0];
    const anchorY = getHourBoundaryY(anchor);
    const dayTop = anchorY - anchor.hour * hourHeight;
    const scrollFrame = getScrollFrame(anchor.element);
    const clipRect = scrollFrame
      ? scrollFrame.getBoundingClientRect()
      : main.getBoundingClientRect();
    const rightMostLabel = Math.max(...group.map((label) => label.rect.right));
    const left = Math.min(rightMostLabel + 8, mainRect.right - 80);
    const right = mainRect.right;
    const clipTop = Math.max(clipRect.top, mainRect.top, 0);
    const clipBottom = Math.min(clipRect.bottom, mainRect.bottom, window.innerHeight);

    if (right - left < 80 || clipBottom - clipTop < 80) {
      return null;
    }

    return {
      left,
      right,
      clipTop,
      clipBottom,
      yForMinutes(minutes) {
        return dayTop + (minutes / 60) * hourHeight;
      }
    };
  }

  function collectTimeLabels(root) {
    const candidates = [];
    const elements = root.querySelectorAll("span, div");

    for (const element of elements) {
      if (element.id === OVERLAY_ID || element.closest(`#${OVERLAY_ID}`)) {
        continue;
      }

      const text = compactText(element.textContent);
      const hour = parseHourLabel(text);
      if (hour === null) {
        continue;
      }

      const rect = element.getBoundingClientRect();
      if (
        !hasUsableRect(rect) ||
        rect.width > 100 ||
        rect.height > 32 ||
        rect.bottom < 0 ||
        rect.top > window.innerHeight
      ) {
        continue;
      }

      candidates.push({ element, hour, rect });
    }

    return candidates;
  }

  function compactText(value) {
    return value.replace(/\s+/g, " ").trim();
  }

  function parseHourLabel(text) {
    const lower = text.toLowerCase().replace(/\./g, "");
    const twelveHourMatch = lower.match(/^([1-9]|1[0-2])(?::00)?\s*([ap]m)$/);
    if (twelveHourMatch) {
      const hour = Number(twelveHourMatch[1]);
      const period = twelveHourMatch[2];
      if (period === "am") {
        return hour === 12 ? 0 : hour;
      }
      return hour === 12 ? 12 : hour + 12;
    }

    const twentyFourHourMatch = lower.match(/^([01]?\d|2[0-3]):00$/);
    if (twentyFourHourMatch) {
      return Number(twentyFourHourMatch[1]);
    }

    return null;
  }

  function getBestTimeLabelGroup(labels) {
    const groups = new Map();

    for (const label of labels) {
      const key = Math.round(label.rect.left / 8) * 8;
      const group = groups.get(key) || [];
      group.push(label);
      groups.set(key, group);
    }

    return Array.from(groups.values())
      .map((group) => dedupeLabelsByHourAndY(group))
      .filter((group) => countUniqueHours(group) >= 2)
      .sort((a, b) => {
        const hourCountDelta = countUniqueHours(b) - countUniqueHours(a);
        if (hourCountDelta !== 0) {
          return hourCountDelta;
        }
        return averageRectRight(b) - averageRectRight(a);
      })[0];
  }

  function dedupeLabelsByHourAndY(labels) {
    const sorted = labels.slice().sort((a, b) => {
      if (a.hour !== b.hour) {
        return a.hour - b.hour;
      }
      return a.rect.top - b.rect.top;
    });
    const deduped = [];

    for (const label of sorted) {
      const duplicate = deduped.some(
        (existing) =>
          existing.hour === label.hour &&
          Math.abs(existing.rect.top - label.rect.top) < 6
      );
      if (!duplicate) {
        deduped.push(label);
      }
    }

    return deduped;
  }

  function countUniqueHours(labels) {
    return new Set(labels.map((label) => label.hour)).size;
  }

  function averageRectRight(labels) {
    return (
      labels.reduce((total, label) => total + label.rect.right, 0) / labels.length
    );
  }

  function getMedianHourHeight(labels) {
    const sorted = labels.slice().sort((a, b) => a.rect.top - b.rect.top);
    const heights = [];

    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1];
      const current = sorted[index];
      const hourDelta = current.hour - previous.hour;
      const yDelta = getHourBoundaryY(current) - getHourBoundaryY(previous);

      if (hourDelta > 0 && yDelta > 0) {
        const height = yDelta / hourDelta;
        if (height >= MIN_HOUR_HEIGHT && height <= MAX_HOUR_HEIGHT) {
          heights.push(height);
        }
      }
    }

    if (heights.length === 0) {
      return null;
    }

    heights.sort((a, b) => a - b);
    return heights[Math.floor(heights.length / 2)];
  }

  function getHourBoundaryY(label) {
    return label.rect.top + label.rect.height / 2;
  }

  function getScrollFrame(element) {
    let current = element.parentElement;

    while (current && current !== document.body) {
      const style = window.getComputedStyle(current);
      const canScroll = /(auto|scroll|overlay)/.test(style.overflowY);
      if (canScroll && current.scrollHeight > current.clientHeight + 20) {
        return current;
      }
      current = current.parentElement;
    }

    return null;
  }

  function hasUsableRect(rect) {
    return rect.width > 0 && rect.height > 0;
  }

  function getPatternBackground(stripeColor) {
    switch (settings.patternStyle) {
      case "crosshatch":
        return {
          image: svgDataUrl(
            `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><path d="M-9 0L9 18M0 0L18 18M9 0L27 18M-9 18L9 0M0 18L18 0M9 18L27 0" fill="none" stroke="${stripeColor}" stroke-width="2" stroke-linecap="square"/></svg>`
          ),
          position: "center center",
          size: "18px 18px"
        };
      case "dots":
        return {
          image: `radial-gradient(circle, ${stripeColor} 1.8px, transparent 2px)`,
          position: "center center",
          size: "12px 12px"
        };
      case "diagonal":
      default:
        return {
          image: `repeating-linear-gradient(135deg, transparent 0 9px, ${stripeColor} 9px 12px, transparent 12px 18px)`,
          position: "center center",
          size: "18px 18px"
        };
    }
  }

  function createShadeBlock({ left, top, width, height }) {
    const block = document.createElement("div");
    const baseColor = hexToRgba(settings.shadeColor, settings.opacity);
    const stripeColor = hexToRgba(
      settings.shadeColor,
      Math.min(settings.opacity + 0.35, 0.75)
    );
    const pattern = getPatternBackground(stripeColor);

    block.style.position = "absolute";
    block.style.left = `${left}px`;
    block.style.top = `${top}px`;
    block.style.width = `${width}px`;
    block.style.height = `${height}px`;
    block.style.backgroundColor = baseColor;
    block.style.backgroundImage = settings.patternEnabled ? pattern.image : "none";
    block.style.backgroundPosition = settings.patternEnabled
      ? pattern.position
      : "0 0";
    block.style.backgroundSize = settings.patternEnabled ? pattern.size : "auto";
    block.style.opacity = "1";
    block.style.borderTop = "1px solid rgba(60, 64, 67, 0.18)";
    block.style.borderBottom = "1px solid rgba(60, 64, 67, 0.18)";
    block.style.boxSizing = "border-box";
    return block;
  }

  function clearOverlay() {
    if (overlay) {
      overlay.replaceChildren();
    }
  }

  function clockTimeToMinutes(value) {
    if (!isClockTime(value)) {
      return null;
    }

    const [hours, minutes] = value.split(":").map(Number);
    return hours * 60 + minutes;
  }

  init();
})();
