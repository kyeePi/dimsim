"use strict";

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const root = path.resolve(__dirname, "..");
const assetDir = path.join(root, "src", "assets");
const sizes = [16, 32, 48, 128];
const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;

  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }

  return value >>> 0;
});

fs.mkdirSync(assetDir, { recursive: true });

for (const size of sizes) {
  const rgba = renderIcon(size);
  fs.writeFileSync(path.join(assetDir, `icon-${size}.png`), encodePng(size, size, rgba));
}

function renderIcon(size) {
  const pixels = Buffer.alloc(size * size * 4);

  for (let index = 0; index < size * size; index += 1) {
    pixels[index * 4 + 3] = 0;
  }

  const margin = Math.max(1, Math.round(size * 0.1));
  fillRoundedRect(pixels, size, margin, margin, size - margin * 2, size - margin * 2, size * 0.16, "#1a73e8");
  fillRoundedRect(
    pixels,
    size,
    margin + 1,
    margin + 1,
    size - margin * 2 - 2,
    size - margin * 2 - 2,
    size * 0.12,
    "#ffffff"
  );

  const left = Math.round(size * 0.22);
  const top = Math.round(size * 0.24);
  const width = Math.round(size * 0.56);
  const height = Math.round(size * 0.56);
  const headerHeight = Math.max(2, Math.round(height * 0.22));
  const bodyTop = top + headerHeight;
  const bodyHeight = height - headerHeight;
  const shadeTopHeight = Math.max(1, Math.round(bodyHeight * 0.24));
  const shadeBottomTop = bodyTop + Math.round(bodyHeight * 0.64);
  const shadeBottomHeight = Math.max(1, bodyTop + bodyHeight - shadeBottomTop);

  fillRect(pixels, size, left, top, width, height, "#d7e2ea");
  fillRect(pixels, size, left + 1, top + 1, width - 2, height - 2, "#ffffff");
  fillRect(pixels, size, left + 1, top + 1, width - 2, headerHeight, "#1a73e8");
  fillRect(pixels, size, left + 1, bodyTop, width - 2, shadeTopHeight, "#dff1ff");
  fillRect(pixels, size, left + 1, shadeBottomTop, width - 2, shadeBottomHeight - 1, "#dff1ff");

  drawGrid(pixels, size, left + 1, bodyTop, width - 2, bodyHeight - 1);
  drawHatch(pixels, size, left + 1, bodyTop, width - 2, shadeTopHeight, "#79bce8");
  drawHatch(pixels, size, left + 1, shadeBottomTop, width - 2, shadeBottomHeight - 1, "#79bce8");
  drawDimSim(pixels, size, left + Math.round(width / 2), bodyTop + Math.round(bodyHeight * 0.48));

  return pixels;
}

function drawDimSim(pixels, size, cx, cy) {
  const length = Math.max(7, Math.round(size * (size < 48 ? 0.5 : 0.42)));
  const thickness = Math.max(4, Math.round(length * 0.44));
  const angle = -0.28;
  const shadowOffset = Math.max(1, Math.round(size * 0.015));

  fillRotatedCapsule(
    pixels,
    size,
    cx,
    cy + shadowOffset,
    length + 2,
    thickness + 2,
    angle,
    "#7b461c"
  );
  fillRotatedCapsule(pixels, size, cx, cy, length, thickness, angle, "#c8752d");
  fillRotatedCapsule(
    pixels,
    size,
    cx - Math.round(size * 0.005),
    cy - Math.round(size * 0.005),
    length - 2,
    thickness - 2,
    angle,
    "#e7a24d"
  );
  fillRotatedCapsule(
    pixels,
    size,
    cx - Math.round(size * 0.02),
    cy - Math.round(size * 0.025),
    Math.max(4, Math.round(length * 0.68)),
    Math.max(2, Math.round(thickness * 0.42)),
    angle,
    "#f3bf75"
  );

  if (size < 32) {
    return;
  }

  const foldColor = "#93511f";
  const lineWidth = size >= 96 ? 2 : 1;

  drawLocalLine(
    pixels,
    size,
    cx,
    cy,
    angle,
    -length * 0.3,
    -thickness * 0.28,
    -length * 0.18,
    thickness * 0.28,
    foldColor,
    lineWidth
  );
  drawLocalLine(
    pixels,
    size,
    cx,
    cy,
    angle,
    0,
    -thickness * 0.34,
    length * 0.04,
    thickness * 0.34,
    foldColor,
    lineWidth
  );
  drawLocalLine(
    pixels,
    size,
    cx,
    cy,
    angle,
    length * 0.28,
    -thickness * 0.24,
    length * 0.18,
    thickness * 0.26,
    foldColor,
    lineWidth
  );

  if (size < 48) {
    return;
  }

  fillLocalEllipse(pixels, size, cx, cy, angle, -length * 0.04, -thickness * 0.18, 5, 3, "#7a3f19");
  fillLocalEllipse(pixels, size, cx, cy, angle, length * 0.22, thickness * 0.08, 4, 3, "#8f4b1d");
}

function drawGrid(pixels, size, x, y, width, height) {
  const columns = 3;
  const rows = 3;

  for (let column = 1; column < columns; column += 1) {
    const px = x + Math.round((width * column) / columns);
    fillRect(pixels, size, px, y, 1, height, "#edf2f7");
  }

  for (let row = 1; row < rows; row += 1) {
    const py = y + Math.round((height * row) / rows);
    fillRect(pixels, size, x, py, width, 1, "#edf2f7");
  }
}

function drawHatch(pixels, size, x, y, width, height, color) {
  const step = Math.max(3, Math.round(size * 0.16));

  for (let offset = -height; offset < width; offset += step) {
    for (let dy = 0; dy < height; dy += 1) {
      const px = x + offset + dy;
      const py = y + dy;

      if (px >= x && px < x + width) {
        setPixel(pixels, size, px, py, color);
      }
    }
  }
}

function fillRoundedRect(pixels, size, x, y, width, height, radius, color) {
  const r = Math.max(0, Math.round(radius));
  const right = x + width - 1;
  const bottom = y + height - 1;

  for (let py = y; py <= bottom; py += 1) {
    for (let px = x; px <= right; px += 1) {
      const cx = px < x + r ? x + r : px > right - r ? right - r : px;
      const cy = py < y + r ? y + r : py > bottom - r ? bottom - r : py;
      const dx = px - cx;
      const dy = py - cy;

      if (dx * dx + dy * dy <= r * r) {
        setPixel(pixels, size, px, py, color);
      }
    }
  }
}

function fillRect(pixels, size, x, y, width, height, color) {
  for (let py = y; py < y + height; py += 1) {
    for (let px = x; px < x + width; px += 1) {
      setPixel(pixels, size, px, py, color);
    }
  }
}

function fillRotatedCapsule(pixels, size, cx, cy, length, thickness, angle, color) {
  const halfLength = length / 2;
  const radius = thickness / 2;
  const squareHalf = Math.max(0, halfLength - radius);
  const bounds = Math.ceil(halfLength + radius + 2);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  for (let py = Math.floor(cy - bounds); py <= Math.ceil(cy + bounds); py += 1) {
    for (let px = Math.floor(cx - bounds); px <= Math.ceil(cx + bounds); px += 1) {
      const dx = px - cx;
      const dy = py - cy;
      const localX = dx * cos + dy * sin;
      const localY = -dx * sin + dy * cos;
      const endX = Math.max(-squareHalf, Math.min(squareHalf, localX));
      const distX = localX - endX;

      if (distX * distX + localY * localY <= radius * radius) {
        setPixel(pixels, size, px, py, color);
      }
    }
  }
}

function fillLocalEllipse(pixels, size, cx, cy, angle, localCx, localCy, width, height, color) {
  const [worldCx, worldCy] = localToWorld(cx, cy, angle, localCx, localCy);
  fillRotatedEllipse(pixels, size, worldCx, worldCy, width, height, angle, color);
}

function fillRotatedEllipse(pixels, size, cx, cy, width, height, angle, color) {
  const rx = Math.max(1, width / 2);
  const ry = Math.max(1, height / 2);
  const bounds = Math.ceil(Math.max(width, height) + 2);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  for (let py = Math.floor(cy - bounds); py <= Math.ceil(cy + bounds); py += 1) {
    for (let px = Math.floor(cx - bounds); px <= Math.ceil(cx + bounds); px += 1) {
      const dx = px - cx;
      const dy = py - cy;
      const localX = dx * cos + dy * sin;
      const localY = -dx * sin + dy * cos;

      if ((localX * localX) / (rx * rx) + (localY * localY) / (ry * ry) <= 1) {
        setPixel(pixels, size, px, py, color);
      }
    }
  }
}

function drawLocalLine(pixels, size, cx, cy, angle, x1, y1, x2, y2, color, lineWidth) {
  const [worldX1, worldY1] = localToWorld(cx, cy, angle, x1, y1);
  const [worldX2, worldY2] = localToWorld(cx, cy, angle, x2, y2);

  for (let offset = 0; offset < lineWidth; offset += 1) {
    drawLine(
      pixels,
      size,
      Math.round(worldX1 + offset),
      Math.round(worldY1),
      Math.round(worldX2 + offset),
      Math.round(worldY2),
      color
    );
  }
}

function localToWorld(cx, cy, angle, x, y) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return [cx + x * cos - y * sin, cy + x * sin + y * cos];
}

function fillEllipse(pixels, size, cx, cy, width, height, color) {
  const rx = Math.max(1, width / 2);
  const ry = Math.max(1, height / 2);
  const left = Math.floor(cx - rx);
  const right = Math.ceil(cx + rx);
  const top = Math.floor(cy - ry);
  const bottom = Math.ceil(cy + ry);

  for (let py = top; py <= bottom; py += 1) {
    for (let px = left; px <= right; px += 1) {
      const dx = (px - cx) / rx;
      const dy = (py - cy) / ry;

      if (dx * dx + dy * dy <= 1) {
        setPixel(pixels, size, px, py, color);
      }
    }
  }
}

function drawLine(pixels, size, x1, y1, x2, y2, color) {
  let x = x1;
  let y = y1;
  const dx = Math.abs(x2 - x1);
  const dy = -Math.abs(y2 - y1);
  const sx = x1 < x2 ? 1 : -1;
  const sy = y1 < y2 ? 1 : -1;
  let error = dx + dy;

  while (true) {
    setPixel(pixels, size, x, y, color);

    if (x === x2 && y === y2) {
      break;
    }

    const e2 = 2 * error;

    if (e2 >= dy) {
      error += dy;
      x += sx;
    }

    if (e2 <= dx) {
      error += dx;
      y += sy;
    }
  }
}

function setPixel(pixels, size, x, y, color) {
  if (x < 0 || y < 0 || x >= size || y >= size) {
    return;
  }

  const [r, g, b, a] = hexToRgba(color);
  const index = (y * size + x) * 4;

  pixels[index] = r;
  pixels[index + 1] = g;
  pixels[index + 2] = b;
  pixels[index + 3] = a;
}

function hexToRgba(hex) {
  const normalized = hex.replace("#", "");
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
    255
  ];
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);

  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr(width, height)),
    pngChunk("IDAT", zlib.deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

function ihdr(width, height) {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data[8] = 8;
  data[9] = 6;
  data[10] = 0;
  data[11] = 0;
  data[12] = 0;
  return data;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  const crc = Buffer.alloc(4);

  length.writeUInt32BE(data.length, 0);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff];
  }

  return (crc ^ 0xffffffff) >>> 0;
}
