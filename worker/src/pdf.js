import { resolve } from "node:path";
import chromium from "@sparticuz/chromium-min";
import puppeteer from "puppeteer-core";

const PAGE_SIZES = new Set(["A3", "A4", "A5", "Letter", "Legal"]);

export async function renderPdf(html, { paperSize = "A4", orientation = "portrait" } = {}) {
  if (!PAGE_SIZES.has(paperSize)) {
    throw new TypeError("paperSize must be A3, A4, A5, Letter, or Legal.");
  }
  if (orientation !== "portrait" && orientation !== "landscape") {
    throw new TypeError("orientation must be portrait or landscape.");
  }
  chromium.setGraphicsMode = false;
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  const chromiumLocation = process.env.CHROMIUM_PACK_URL
    ?? (vercelHost
      ? `https://${vercelHost}/chromium-pack.tar`
      : process.env.CHROMIUM_BIN_DIR);
  if (!chromiumLocation) {
    throw new Error("Set CHROMIUM_PACK_URL or CHROMIUM_BIN_DIR to locate the Chromium binary pack.");
  }
  const executablePath = await chromium.executablePath(chromiumLocation);
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath,
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "load", timeout: 15000 });
    return await page.pdf({
      format: paperSize,
      landscape: orientation === "landscape",
      printBackground: true,
      preferCSSPageSize: false,
      margin: {
        top: "8mm",
        right: "8mm",
        bottom: "8mm",
        left: "8mm",
      },
    });
  } finally {
    await browser.close();
  }
}
