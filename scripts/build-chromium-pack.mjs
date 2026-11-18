import { execFileSync } from "node:child_process";
import { mkdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

const binDirectory = resolve("node_modules/@sparticuz/chromium/bin");
const outputDirectory = resolve("worker/public");
const outputFile = resolve(outputDirectory, "chromium-pack.tar");
const requiredFiles = [
  "al2023.tar.br",
  "chromium.br",
  "fonts.tar.br",
  "swiftshader.tar.br",
];

mkdirSync(outputDirectory, { recursive: true });
execFileSync("tar", ["-cf", outputFile, "-C", binDirectory, ...requiredFiles], {
  stdio: "inherit",
});

console.log(`Created ${outputFile} (${statSync(outputFile).size} bytes)`);
