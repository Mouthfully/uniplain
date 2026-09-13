import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Internal workspace packages export raw TypeScript from src/. There is no per-package
  // build step, so Next has to compile them itself.
  //
  // EVERY @repo/* PACKAGE THIS APP IMPORTS MUST BE LISTED, TRANSITIVELY. A missing entry does not
  // fail typecheck or vitest -- both resolve the source directly -- it fails only `next build`,
  // which is the last step before deploy. The list below is the closure of what `app/` imports:
  // brand, contract and connectors are imported by name; extract and payloads arrive underneath
  // connectors and are just as required, which is the half a hand-maintained list gets wrong.
  //
  // LISTING THEM HERE IS NECESSARY AND IS NOT SUFFICIENT. Next 16 builds with TURBOPACK, which
  // does not map a `.js` specifier onto the `.ts` file beside it, and has no escape hatch:
  // `experimental.extensionAlias` is webpack-only and next/dist/lib/turbopack-warning.js lists it
  // among the unsupported options. So a package whose modules import each other as `./thing.js`
  // fails the build with `Module not found` the moment this app pulls it in.
  //
  // That is the failure tsconfig.base.json already predicts in writing: "a relative import has to
  // name a file that exists on disk: `./claims.ts`, not `./claims.js` ... A `.js` specifier
  // resolves fine under tsc, vitest and esbuild and fails only `next build`". @repo/brand and
  // @repo/tokens followed the rule because they were the only packages this app had ever built.
  // The other four did not, and nothing caught it, because nothing had ever built them. Adding
  // /envelope pulled all four in at once and 103 specifiers across contract, connectors, extract
  // and payloads were converted to `.ts` to match the rule.
  //
  // The guard against a repeat is this app's own build: any package added here brings its
  // specifiers with it, and `next build` is the thing that says so.
  transpilePackages: [
    "@repo/tokens",
    "@repo/brand",
    "@repo/contract",
    "@repo/connectors",
    "@repo/extract",
    "@repo/payloads",
    // Added with `/keys`, which mints an API key and must hash it with the SAME function the Worker
    // feeds `verify_api_key`. It imports `@repo/store/jwt` -- the leaf module -- and NOT the
    // package's barrel, for the reason the paragraph above predicts: `src/index.ts` re-exports its
    // siblings as `./thing.js`, Turbopack will not map that onto the `.ts` beside it, and pulling
    // the barrel in fails the build with eight `Module not found`s. It did, on the first attempt.
    // `src/jwt.ts` imports nothing at all, so it has no specifiers to get wrong.
    "@repo/store",
  ],
  typedRoutes: true,

  /**
   * HEADERS, IN TWO GROUPS, AND NEITHER IS COSMETIC.
   *
   * 1. THE MARKDOWN TWIN, ADVERTISED WHERE A MACHINE ACTUALLY LOOKS. The llms.txt convention says
   *    a site "should provide a clean markdown version of those pages at the same URL", and names
   *    the standard relations for saying so: `rel="alternate" type="text/markdown"` for the
   *    markdown, `rel="describedby"` for the covering llms.txt. As an HTTP `Link` header rather
   *    than a `<link>` tag, because an agent that fetched the page to read the markdown has already
   *    paid for the HTML it was trying to avoid -- a header is readable from a HEAD request.
   *
   *    The path list is spelled out rather than imported from `app/_agent/registry.ts`. Importing
   *    it here would pull `_content.ts`, `@repo/brand` and the billing modules into the config that
   *    Next loads before it compiles anything, to read fourteen strings. `_agent/headers.test.ts`
   *    asserts this list and the registry are the same set, in both directions, so the duplication
   *    is checked rather than trusted -- which is the trade `transpilePackages` above already makes.
   *
   * 2. SECURITY HEADERS. There were none. Each of these is one line and each closes something real:
   *    HSTS stops the first request being downgradeable, `nosniff` stops a `.md` twin being
   *    re-interpreted as HTML, `frame-ancestors` is the CSP-era clickjacking control that
   *    X-Frame-Options only approximates, and the Referrer-Policy keeps a signed-in path out of the
   *    `Referer` of every third-party asset -- which matters here specifically because the OAuth
   *    return leg was designed to keep an authorisation code out of exactly that header.
   *
   *    A FULL `script-src` CSP IS DELIBERATELY NOT HERE. This app emits an inline JSON-LD block and
   *    Next emits inline bootstrap scripts, so a strict policy needs per-request nonces, which needs
   *    middleware on every route and turns a static export dynamic. That is a real change with a
   *    real cost and it is not a header edit; it is written down in the design note as the next
   *    step rather than half-done here. `frame-ancestors` is included because it needs no nonce.
   */
  async headers() {
    const security = [
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
      { key: "X-Frame-Options", value: "DENY" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
      },
    ];

    // Kept in sync with app/_agent/registry.ts by _agent/headers.test.ts.
    const AGENT_PATHS = [
      "/",
      "/pricing",
      "/integrations",
      "/envelope",
      "/docs",
      "/fields/google-ads",
      "/connectors/ga4",
      "/connectors/google-ads",
      "/connectors/meta-ads",
      "/connectors/search-console",
      "/connectors/shopify",
      "/connectors/woocommerce",
      // The three segment pages and the security page. Added here as well as in the registry
      // because a Next config cannot import from `app/` -- `headers.test.ts` is what holds the two
      // lists together, and it fails on exactly this drift.
      "/for/cafe",
      "/for/online-shop",
      "/for/salon",
      "/security",
      "/processing",
      "/sub-processors",
      "/dpa",
      "/terms",
      "/privacy",
    ];

    const markdownFor = (path: string) => (path === "/" ? "/index.md" : `${path}.md`);

    return [
      { source: "/:path*", headers: security },
      ...AGENT_PATHS.map((path) => ({
        source: path,
        headers: [
          {
            key: "Link",
            value:
              `<${markdownFor(path)}>; rel="alternate"; type="text/markdown", ` +
              `</llms.txt>; rel="describedby"`,
          },
        ],
      })),
    ];
  },
};

export default nextConfig;
