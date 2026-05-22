import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const repoRoot = resolve(root, "..");
const seedPath = resolve(
  root,
  "projects/admin-panel/src/app/shared/page-feature-management/page-feature-management.seed.ts",
);

const routeFiles = [
  {
    appId: "vendor-app",
    label: "Vendor App",
    path: resolve(root, "projects/vendor-app/src/app/app.routes.ts"),
    helperNames: ["vendorPageGuard"],
    aliases: {
      "vendor-product-edit": ["/products/edit/:id"],
      "vendor-store-settings": ["/store/settings"],
    },
  },
  {
    appId: "customer-app",
    label: "Customer App",
    path: resolve(root, "projects/customer-app/src/app/app.routes.ts"),
    helperNames: [],
    aliases: {
      "customer-home": ["/new-home"],
      "customer-help": [
        "/order/:id/help",
        "/order/:id/issue",
        "/issue/:issueId",
      ],
      "customer-order-finished": ["/order/:id/rating"],
    },
  },
  {
    appId: "delivery-app",
    label: "Delivery App",
    path: resolve(root, "projects/delivery-app/src/app/app.routes.ts"),
    helperNames: ["deliveryPageGuard"],
    aliases: {},
  },
];

const mobileConfig = {
  appId: "mobile-customer",
  label: "Mobile Customer",
  path: resolve(repoRoot, "shopping-mobile-app/mobile-customer/App.tsx"),
  ignoredScreens: new Set(["MainTabs", "CartTab", "OrdersTab"]),
};

function normalizeRoute(route) {
  const text = String(route || "").trim();
  if (!text || text === "/") return "/";
  return text.startsWith("/") ? text : `/${text}`;
}

function loadSeed() {
  const source = readFileSync(seedPath, "utf8");
  const pages = new Map();
  const duplicateIds = [];
  const appIds = new Set();
  const pageRegex =
    /page\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*,\s*['"][^'"]+['"]\s*,\s*['"]([^'"]+)['"]/g;
  let match;

  while ((match = pageRegex.exec(source)) !== null) {
    const [, appId, pageId, route] = match;
    appIds.add(appId);
    if (pages.has(pageId)) duplicateIds.push(pageId);
    pages.set(pageId, { appId, route: normalizeRoute(route) });
  }

  return { pages, appIds, duplicateIds };
}

function routeObjects(source) {
  const objects = [];
  const routeRegex = /\{[^{}]*path:\s*['"]([^'"]*)['"][^{}]*\}/g;
  let match;
  while ((match = routeRegex.exec(source)) !== null) {
    objects.push({ path: normalizeRoute(match[1]), source: match[0] });
  }
  return objects;
}

function findGuardPageId(routeSource, appId, helperNames) {
  const directGuard = new RegExp(
    `pageFeatureGuard\\(\\s*['"]${appId}['"]\\s*,\\s*['"]([^'"]+)['"]`,
    "m",
  ).exec(routeSource);
  if (directGuard) return directGuard[1];

  for (const helperName of helperNames) {
    const helperGuard = new RegExp(
      `${helperName}\\(\\s*['"]([^'"]+)['"]`,
      "m",
    ).exec(routeSource);
    if (helperGuard) return helperGuard[1];
  }

  return "";
}

function validateAngularRoutes(seed, errors) {
  for (const config of routeFiles) {
    const source = readFileSync(config.path, "utf8");
    const routes = routeObjects(source);

    for (const route of routes) {
      if (
        route.path === "/**" ||
        route.path === "/feature-unavailable" ||
        route.source.includes("redirectTo:")
      ) {
        continue;
      }

      const pageId = findGuardPageId(
        route.source,
        config.appId,
        config.helperNames,
      );
      if (!pageId) {
        errors.push(
          `${config.label} route "${route.path}" is not protected by pageFeatureGuard. Add it to Page & Feature Management and guard the route.`,
        );
        continue;
      }

      const seedPage = seed.pages.get(pageId);
      if (!seedPage) {
        errors.push(
          `${config.label} route "${route.path}" uses page id "${pageId}", but that id is missing from page-feature-management.seed.ts.`,
        );
        continue;
      }

      if (seedPage.appId !== config.appId) {
        errors.push(
          `${config.label} route "${route.path}" uses page id "${pageId}", but the seed assigns it to "${seedPage.appId}".`,
        );
      }

      const allowedRoutes = new Set([
        seedPage.route,
        ...(config.aliases[pageId] || []).map(normalizeRoute),
      ]);
      if (!allowedRoutes.has(route.path)) {
        errors.push(
          `${config.label} page id "${pageId}" is guarded on route "${route.path}", but the seed route is "${seedPage.route}". Add an alias in the validator only for intentional legacy routes.`,
        );
      }
    }
  }
}

function validateMobileScreens(seed, errors) {
  const source = readFileSync(mobileConfig.path, "utf8");
  const screenRegex = /<(?:Stack|Tabs)\.Screen\s+name=["']([^"']+)["']/g;
  let match;

  while ((match = screenRegex.exec(source)) !== null) {
    const screen = match[1];
    if (mobileConfig.ignoredScreens.has(screen)) continue;

    const exists = [...seed.pages.values()].some(
      (page) =>
        page.appId === mobileConfig.appId &&
        page.route === normalizeRoute(screen),
    );
    if (!exists) {
      errors.push(
        `${mobileConfig.label} screen "${screen}" is missing from page-feature-management.seed.ts.`,
      );
    }
  }
}

function main() {
  const seed = loadSeed();
  const errors = [];

  if (seed.duplicateIds.length) {
    errors.push(
      `Duplicate Page & Feature Management page ids: ${[...new Set(seed.duplicateIds)].join(", ")}`,
    );
  }

  validateAngularRoutes(seed, errors);
  validateMobileScreens(seed, errors);

  if (errors.length) {
    console.error("\nPage & Feature Management inventory validation failed:\n");
    for (const error of errors) console.error(`- ${error}`);
    console.error(
      "\nEvery new page or feature route must be represented in projects/admin-panel/src/app/shared/page-feature-management/page-feature-management.seed.ts.\n",
    );
    process.exit(1);
  }

  console.log(
    `Page & Feature Management inventory validated: ${seed.pages.size} pages across ${seed.appIds.size} applications.`,
  );
}

main();
