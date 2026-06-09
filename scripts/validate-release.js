"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const manifest = require(path.join(root, "manifest.json"));
const requiredIcons = ["16", "32", "48", "128"];
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const errors = [];

if (manifest.manifest_version !== 3) {
  errors.push("manifest_version must be 3");
}

for (const key of ["name", "version", "description", "icons", "action"]) {
  if (!manifest[key]) {
    errors.push(`manifest.json is missing ${key}`);
  }
}

for (const size of requiredIcons) {
  const iconPath = manifest.icons && manifest.icons[size];

  if (!iconPath) {
    errors.push(`manifest.json is missing ${size}px icon`);
    continue;
  }

  const absoluteIconPath = path.join(root, iconPath);

  if (!fs.existsSync(absoluteIconPath)) {
    errors.push(`${iconPath} does not exist`);
    continue;
  }

  const icon = fs.readFileSync(absoluteIconPath);

  if (!icon.subarray(0, pngSignature.length).equals(pngSignature)) {
    errors.push(`${iconPath} is not a PNG file`);
  }
}

for (const file of ["src/popup.html", "src/popup.css", "src/popup.js", "src/content.js"]) {
  const content = fs.readFileSync(path.join(root, file), "utf8");

  if (/https:\/\/cdnjs\.buymeacoffee\.com|button\.prod\.min\.js/.test(content)) {
    errors.push(`${file} contains remote Buy Me a Coffee script code`);
  }
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(error);
  }

  process.exit(1);
}

console.log("Release validation passed.");
