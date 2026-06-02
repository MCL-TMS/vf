const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const baseUrl = process.env.MCL_BASE_URL || "http://localhost:3000/";
const username = process.env.MCL_USER || "vf_admin";
const password = process.env.MCL_PASS || "654321";
const outputDir = process.env.MCL_SHOT_DIR || path.join(process.cwd(), "screenshots", "overview");
const navTimeoutMs = Number(process.env.MCL_NAV_TIMEOUT_MS || 90000);
const dateFrom = "2026-05-13";
const dateTo = "2026-05-14";

function getTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function waitForDashboardReady(page) {
  const candidates = [
    page.locator("text=总单量"),
    page.locator("text=核心指标"),
    page.locator("text=订单状态分布")
  ];

  try {
    await Promise.race(
      candidates.map(locator => locator.first().waitFor({ state: "visible", timeout: navTimeoutMs }))
    );
  } catch (error) {
    console.warn("Dashboard readiness timeout; continuing.");
  }
}

async function ensureLoggedIn(page) {
  const userInput = page.locator("#userId");
  const loginVisible = await userInput.isVisible().catch(() => false);
  if (!loginVisible) {
    return;
  }

  await userInput.fill(username);
  await page.locator("#password").fill(password);

  await page.locator('button[type="submit"]').click();
  await waitForDashboardReady(page);
}

async function warmUpAndScroll(page) {
  await page.waitForLoadState("domcontentloaded", { timeout: navTimeoutMs });
  await waitForDashboardReady(page);

  const scrollStep = 800;
  const delayMs = 250;
  let lastHeight = 0;

  for (let i = 0; i < 200; i += 1) {
    const info = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      innerHeight: window.innerHeight,
      scrollTop: window.scrollY
    }));

    if (info.scrollTop + info.innerHeight >= info.scrollHeight) {
      break;
    }

    await page.evaluate(step => window.scrollBy(0, step), scrollStep);
    await page.waitForTimeout(delayMs);

    if (info.scrollHeight === lastHeight && info.scrollTop + info.innerHeight >= info.scrollHeight) {
      break;
    }

    lastHeight = info.scrollHeight;
  }

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
}

async function applyDateRange(page) {
  if (!dateFrom || !dateTo) {
    return;
  }

  const trigger = page.getByRole("button", { name: /\d{4}-\d{2}-\d{2}/ });
  await trigger.first().click();

  const fromInput = page
    .locator("label:has-text('开始日期')")
    .locator("..")
    .locator("input[type='date']");
  const toInput = page
    .locator("label:has-text('结束日期')")
    .locator("..")
    .locator("input[type='date']");

  await fromInput.fill(dateFrom);
  await toInput.fill(dateTo);

  await page.getByRole("button", { name: "应用" }).click();
  await waitForDashboardReady(page);
}

function cardByTitle(page, titleText) {
  return page
    .getByText(titleText, { exact: true })
    .locator('xpath=ancestor::*[@data-slot="card"][1]');
}

function sectionByHeading(page, headingText) {
  return page
    .getByText(headingText)
    .locator('xpath=ancestor::section[1]');
}

async function captureModules(page) {
  const stamp = getTimestamp();
  const targets = [
    { key: "total-orders", locator: cardByTitle(page, "总单量") },
    { key: "kpis", locator: sectionByHeading(page, "核心指标") },
    { key: "status-distribution", locator: cardByTitle(page, "订单状态分布") },
    { key: "impact-chart", locator: cardByTitle(page, "品牌×快递承运商×异常分类流向分析") },
    { key: "timeout-monitor", locator: cardByTitle(page, "超时监控详情") },
    { key: "courier-share", locator: cardByTitle(page, "快递公司订单占比") }
  ];

  const brandSummary = page
    .getByText("品牌概览")
    .locator('xpath=ancestor::*[@data-slot="card"][1]');

  for (const target of targets) {
    if ((await target.locator.count()) === 0) {
      console.log(`Skip: ${target.key} (not found)`);
      continue;
    }

    const element = target.locator.first();
    await element.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);

    const fileName = `overview-${target.key}-${stamp}.png`;
    const filePath = path.join(outputDir, fileName);
    await element.screenshot({ path: filePath });
    console.log(`Saved: ${filePath}`);
  }

  if ((await brandSummary.count()) > 0) {
    const element = brandSummary.first();
    await element.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);

    const fileName = `overview-brand-summary-${stamp}.png`;
    const filePath = path.join(outputDir, fileName);
    await element.screenshot({ path: filePath });
    console.log(`Saved: ${filePath}`);
  }
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: navTimeoutMs });
  await ensureLoggedIn(page);
  await applyDateRange(page);
  await warmUpAndScroll(page);
  await captureModules(page);

  await browser.close();
}

main().catch(error => {
  console.error("Screenshot failed:", error);
  process.exit(1);
});
