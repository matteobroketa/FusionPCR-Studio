# Validation and verification

FusionPCR Studio's automated checks verify software behavior. They do not establish wet-lab success, manufacturer-approved reaction conditions, or genome-wide primer specificity. See [LIMITATIONS.md](./LIMITATIONS.md) and [METHODS.md](./METHODS.md) for the scientific boundaries.

## Reproduce the checks

Use Node.js 22 (the CI version), npm, and the stable Rust toolchain. Install dependencies from the lockfile:

```bash
npm ci
npm test
npm run build
npm run test:rust
```

The browser suites require Playwright's browser binaries:

```bash
npx playwright install chromium firefox webkit
npm run test:e2e
npm run smoke:pages:dist
```

On Linux CI, use `npx playwright install --with-deps chromium firefox webkit` to install browser system dependencies as well. `npm run test:e2e` builds the app before each suite and starts the preview server on port 4173. `smoke:pages:dist` expects an existing production build.

To include linting and repository formatting checks, run `npm run verify`. Visual snapshot comparisons are separate: `npm run test:e2e:visual`. Review screenshot differences before updating a baseline.

## Coverage in the repository

- **Calculation and data handling:** `src/utils/*.test.ts` cover sequence import, primer and product construction, translation-related fusion behavior, thermodynamics, overlap, structure, specificity, protocol planning, export, and project recovery. Project import tests reject unsupported polymerase IDs, unknown design modes, and non-finite fragment coordinates.
- **Interactive workflows:** `src/App.test.tsx` covers built-in examples, sequence import, swapping and undo, replacement recovery, saved-project reload, export availability, and blocked browser storage. Component tests cover junction interactions.
- **Production browser behavior:** `tests/e2e/app.spec.ts` covers functional flows in Chromium. Smoke tests exercise Chromium, Firefox, and WebKit; accessibility tests use axe in Chromium. Visual tests have a separate script.
- **Static deployment:** `scripts/smoke-pages.mjs` checks the built GitHub Pages assets. Deployed smoke tests can target a site using `PAGES_BASE_URL` and `PLAYWRIGHT_SKIP_WEBSERVER=1`.
- **Rust workspace:** `cargo test --workspace` exercises the implemented Rust core and bindings. The public application still uses the TypeScript calculation engine; Rust tests do not imply that every TypeScript feature has been ported.

CI configuration lives in [.github/workflows/ci.yml](./.github/workflows/ci.yml). Test definitions describe intended coverage; check a specific CI run or local command output for the result of that revision.

## Remaining validation gaps

The [validation dataset directory](./validation/README.md) does not yet contain a wet-lab outcome dataset. Automated reconstruction and fixture checks cannot replace gel or sequencing outcomes, external reference comparisons, or empirical calibration of reaction recommendations. Specificity is limited to the templates provided in the project; whole-genome specificity searches are not performed by the public app.
