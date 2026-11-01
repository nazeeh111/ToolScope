# Dependency maintenance

The root and four clients have independent npm lockfiles. Weekly Dependabot checks cover all five directories and GitHub Actions. Patch and minor updates for the same package are grouped across all five installs, with at most two open npm update PRs and two Actions PRs. This follows GitHub’s [cross-directory grouping configuration](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference#group-by-groups). Updates require review and the existing validation gates; they are not merged automatically. Shared root/client versions must continue to satisfy `verify:dep-lockstep`. GitHub can split updates when version constraints differ; those checks still apply. Cross-directory grouping applies to version updates.

## September 30, 2026 runtime updates

| Package      | Previous root lock | Updated root lock | Reason                                                                                                                    |
| ------------ | ------------------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `undici`     | 8.9.0              | 8.11.2            | Same-major release beyond the published [8.10.2 fix boundary](https://github.com/advisories/GHSA-3wwx-pv8p-q78v)          |
| `fast-uri`   | 3.1.7              | 3.1.8             | Published [host normalization fix](https://github.com/advisories/GHSA-hrr3-gc8f-f4qj) within Ajv's existing major version |
| `ip-address` | 10.5.0             | 10.7.2            | Same-major release beyond the published [10.7.1 fix boundary](https://github.com/advisories/GHSA-h3mg-xc3c-68pw)          |

`undici` is a direct root dependency. `fast-uri` arrives through Ajv, and `ip-address` through the legacy MCP server's `express-rate-limit` dependency. Root overrides establish patched minimums for those transitive packages while permitting later releases within their existing major versions. The client lockfiles are unchanged.

The updated root lock returned no runtime advisory matches from `npm audit --omit=dev --package-lock-only` on September 30. The four unchanged client locks also returned no runtime matches in the preceding scan. These are time-specific package checks. They do not establish application exploitability, review development dependencies, or prove universal security. The application gates verify behavior separately.

## October 22, 2026 advisory refresh

An audit of the five current lockfiles found published advisories in the root, web and terminal installs. The affected direct packages were advanced to patched releases: MCP client, core, server and legacy server `2.3.1`; Hono `4.13.11`; Vite `8.2.4`; Vitest and its coverage/browser packages `4.1.12`; and the matching Storybook packages `10.6.2`. The existing dependency ranges also allowed patched transitive releases of `brace-expansion`, `proxy-addr` and `source-map-js`. The CLI and launcher lockfiles did not need changes.

These updates address the published [MCP client advisory](https://github.com/advisories/GHSA-6qxp-vccf-f47h), [Storybook preview advisory](https://github.com/advisories/GHSA-f2ph-cmg5-wxc8), [proxy-addr advisory](https://github.com/advisories/GHSA-jqcg-44mw-7w3h), and the other advisories reported for these installed versions. `npm audit` returned zero findings in the root, web and terminal installs after the update; the CLI and launcher installs reported zero at the initial check. This is a time-specific dependency result, not a claim that every advisory is exploitable in ToolScope or that the application is secure in all configurations. See [verification](toolscope-verification.md) for behavior checks.

## November 1, 2026 dependency refresh

The next clean-install check found advisory matches in the root, web and terminal lockfiles. The root update advances `@hono/node-server` to 2.1.5, `undici` to 8.12.3, `zod` to 4.6.7, `fast-uri` to 3.1.9 and `ip-address` to 10.7.5. The existing dependency ranges also resolve `body-parser` 2.4.0 and `qs` 6.17.1. Web and terminal installs use the same Zod version. CLI and launcher lockfiles are unchanged.

These versions meet or exceed the published fix boundaries for [Hono's Node adapter](https://github.com/advisories/GHSA-rmxm-3fg6-px4f), [body-parser](https://github.com/advisories/GHSA-27r3-jxmh-p828), [fast-uri](https://github.com/advisories/GHSA-w74x-v6f9-j3xg), [ip-address](https://github.com/advisories/GHSA-rxp7-6hxx-x8q5), [qs](https://github.com/advisories/GHSA-6pq8-jhm2-2vcw), [Undici](https://github.com/advisories/GHSA-2m5v-pch6-74hx) and [Zod](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5). The transitive overrides retain their existing major versions.

The web test dependency `happy-dom` moves from major 20 to 21.0.4. This is an intentional major update, including the vendor's [ESM code-injection and opaque-frame fixes](https://github.com/capricorn86/happy-dom/releases/tag/v21.0.4), rather than a routine patch-only refresh. Application behavior and coverage must pass the existing publication gates separately. Package advisory matches alone do not establish whether a ToolScope execution path is exploitable.

On November 1, `npm audit --omit=dev --package-lock-only` returned zero runtime findings for the updated root, web and terminal locks. The unchanged CLI and launcher locks returned zero findings in their full audits. Full audits still report 11 moderate findings in root, 11 in web and 4 in terminal, propagated from development-only `minimatch` 10.2.6 and web's `glob` 13.0.6. Their newly reviewed [pattern-amplification](https://github.com/advisories/GHSA-g3hv-75wg-m249) and [cancellation](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) advisories require separate major-version compatibility work. No broad audit fixer or incompatible linter downgrade was applied. These are dated package checks, not proof of application security.
