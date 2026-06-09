"use strict";

const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const packageJson = require(path.join(root, "package.json"));
const packageName = packageJson.name;
const outRoot = path.join(root, "dist");
const outDir = path.join(outRoot, packageName);
const shouldZip = process.argv.includes("--zip");

const entries = ["manifest.json", "src", "README.md", "PRIVACY.md", "LICENSE"];

fs.rmSync(outRoot, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

for (const entry of entries) {
  const source = path.join(root, entry);
  const target = path.join(outDir, entry);

  if (!fs.existsSync(source)) {
    continue;
  }

  fs.cpSync(source, target, { recursive: true });
}

if (shouldZip) {
  const zipName = `${packageName}-v${packageJson.version}.zip`;
  const zipPath = path.join(outRoot, zipName);

  childProcess.execFileSync("zip", ["-qr", zipPath, "."], { cwd: outDir });
  console.log(`Built ${path.relative(root, zipPath)}`);
} else {
  console.log(`Built ${path.relative(root, outDir)}`);
}
