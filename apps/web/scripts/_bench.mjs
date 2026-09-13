import { chromium } from "playwright";
const b = await chromium.launch({
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
