import { chromium } from "playwright";
// This one keeps its own launch rather than using `_browser.mjs`: it reaches two external sites and
// carries proxy arguments of its own. It still honours the provisioned-browser escape hatch, for
// the reason that module's header gives.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const b = await chromium.launch({
  ...(executablePath === undefined || executablePath === "" ? {} : { executablePath }),
  args: [`--proxy-server=${process.env.HTTPS_PROXY}`, "--ignore-certificate-errors"],
});
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
const p = await ctx.newPage();
for (const url of ["https://supermetrics.com/", "https://windsor.ai/"]) {
  try {
    const r = await p.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    console.log(url, "status", r?.status(), "|", (await p.title()).slice(0, 60));
  } catch (e) {
    console.log(url, "ERR", String(e).split("\n")[0].slice(0, 120));
  }
}
await b.close();
