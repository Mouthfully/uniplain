import { chromium } from "playwright";

/**
 * THE ONE PLACE THESE HARNESSES OPEN A BROWSER, AND WHY IT IS NOT `chromium.launch()`.
 *
 * Playwright pins the exact Chromium build a given release expects, and refuses to start any other:
 * bumping the library from 1.56 to 1.63 made all five harnesses in this directory die with
 *
 *     Executable doesn't exist at .../chromium_headless_shell-1243/...
 *
 * on a machine that had build 1194 and no way to fetch 1243. THAT IS THE RIGHT DEFAULT -- a
 * measurement taken in a browser two years older than the library thinks it is measuring is a
 * finding about nothing -- but it means any environment that PROVISIONS a browser rather than
 * downloading one (a locked-down container, an offline runner, an image with a vetted build) loses
 * every harness to a library bump that has nothing to do with it.
 *
 * So: `PLAYWRIGHT_CHROMIUM_EXECUTABLE` names a browser to use instead. Unset -- which is the normal
 * case, and what CI does -- this is exactly `chromium.launch()` and Playwright's own pinning
 * applies. Set, the operator has said which binary they mean, and the version skew is theirs to
 * own rather than ours to hide.
 *
 * IT IS NOT READ FROM `PLAYWRIGHT_BROWSERS_PATH`. That variable says where Playwright's OWN
 * downloads live and Playwright already reads it; pointing this at the same directory and guessing
 * a build number underneath it would be this file inventing a path layout it does not control.
 *
 * THE PROXY IS HANDLED HERE TOO, for the same reason it existed in `imagery-audit.mjs` first:
 * Chromium does not read `HTTPS_PROXY` from the environment the way Node does, and a harness that
 * cannot reach a site reports it as having no content rather than as unreachable.
 */
export async function launchBrowser({ external = false } = {}) {
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  const proxyServer = process.env.HTTPS_PROXY ?? process.env.https_proxy;

  return chromium.launch({
    ...(executablePath === undefined || executablePath === "" ? {} : { executablePath }),
    ...(external && proxyServer !== undefined && proxyServer !== ""
      ? { proxy: { server: proxyServer } }
      : {}),
  });
}
