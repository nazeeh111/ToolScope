# Dependency maintenance

The root and four clients have independent npm lockfiles. Weekly Dependabot checks cover all five directories and GitHub Actions. Patch and minor updates for the same package are grouped across all five installs, with at most two open npm update PRs and two Actions PRs. This follows GitHub’s [cross-directory grouping configuration](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference#group-by-groups). Updates require review and the existing validation gates; they are not merged automatically. Shared root/client versions must continue to satisfy `verify:dep-lockstep`. GitHub can split updates when version constraints differ; those checks still apply. Cross-directory grouping applies to version updates.

## September 30, 2026 runtime updates

| Package | Previous root lock | Updated root lock | Reason |
| --- | --- | --- | --- |
| `undici` | 8.9.0 | 8.11.2 | Same-major release beyond the published [8.10.2 fix boundary](https://github.com/advisories/GHSA-3wwx-pv8p-q78v) |
| `fast-uri` | 3.1.7 | 3.1.8 | Published [host normalization fix](https://github.com/advisories/GHSA-hrr3-gc8f-f4qj) within Ajv's existing major version |
| `ip-address` | 10.5.0 | 10.7.2 | Same-major release beyond the published [10.7.1 fix boundary](https://github.com/advisories/GHSA-h3mg-xc3c-68pw) |

`undici` is a direct root dependency. `fast-uri` arrives through Ajv, and `ip-address` through the legacy MCP server's `express-rate-limit` dependency. Root overrides establish patched minimums for those transitive packages while permitting later releases within their existing major versions. The client lockfiles are unchanged.

The updated root lock returned no runtime advisory matches from `npm audit --omit=dev --package-lock-only` on September 30. The four unchanged client locks also returned no runtime matches in the preceding scan. These are time-specific package checks. They do not establish application exploitability, review development dependencies, or prove universal security. The application gates verify behavior separately.
