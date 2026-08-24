# Phase 2 — Git Preparation: Pre-Commit Report

**Project:** Driver Drowsiness Detection V2
**Date:** 2026-08-24
**Scope:** Local Git preparation only.
**Not done, by instruction:** no commit, no GitHub repository, no remote, no push. No Docker Hub,
AWS, IAM, OIDC, Terraform, Kubernetes, EKS, GitHub Actions, CI/CD, model migration, monitoring,
domain or HTTPS work.

---

## 1. Phase 2 Status

### ✅ **PASS**

The repository is initialised, ignore rules are verified with Git's own matcher, 425 files are
staged (plus this report, 426 total), and no real credential appears anywhere in the staged
content. Nothing is committed and no
remote exists.

Two problems were found and fixed during the audit:

1. **A latent landmine in `ML/.gitignore`** that could have forced a 128.6 MB file into the commit
   and made the first push fail outright — see §4 and the negation inventory in §6.
2. **A flaw in my own verification harness**, which briefly mis-reported the safe `.env.example`
   templates as ignored — see §6.

---

## 2. Repository Root and Branch

| Item | Value |
|---|---|
| Repository root | `D:/Project/by FR-CNN from scratch/Driver Drowsiness Detection V2` |
| Branch | `main` |
| Remotes configured | **0** |
| Commits | **0** (`HEAD` does not resolve — no commit exists) |
| Nested repositories | **None.** No `.git` inside `Backend/`, `Frontend/` or `ML/` |
| Pre-existing history | **None.** No `.git` existed anywhere before this phase, so there is no prior history to audit for leaked secrets. |

---

## 3. Files Created

| File | Purpose |
|---|---|
| `.git/` | The repository itself, initialised at the project root with `--initial-branch=main`. |
| `PHASE_2_PRECOMMIT_REPORT.md` | This document. |

---

## 4. Files Modified

| File | Change | Why |
|---|---|---|
| `Backend/app/api/v1/admin.py` | `get_active_model`: parameter `admin` → `_admin` (+ docstring note) | Fixes the pre-existing `ARG001` lint failure. See §12. |
| `.gitignore` (root) | Added `.pytest-tmp*/` | A pytest `--basetemp` directory held **53 generated fixtures**, including `.pth` and `.mp4` files, which were otherwise commit candidates. |
| `ML/.gitignore` | Removed the `!checkpoints/tuned/best.pth` re-include; replaced with a plain `checkpoints/` | **Latent landmine.** A deeper `.gitignore` overrides the root, so that negation could defeat the root's `*.pth` rule and force-add a **128.6 MB** file — past GitHub's 100 MB hard limit, rejecting the push. It was inert only because it named `checkpoints/tuned/`, while the real directory is `checkpoints/tuned_fixed/`. Renaming that directory would have armed it. |

## 5. Files Deleted

**None.** No file was deleted in Phase 2.

---

## 6. `.gitignore` Validation

Three ignore files are in force: root, `Backend/`, `Frontend/`, plus `ML/`.

Verified with **`git check-ignore`**, using the **exit code** as the authority.

That distinction matters and it caught a mistake. My first verification pass tested whether
`check-ignore -v` produced *output*. It does — but it also prints a match when the winning rule is a
**negation**, so `.env.docker.example` and `Backend/.env.example` were briefly reported as "ignored"
when they are in fact correctly tracked. Only the exit code distinguishes the two cases. Every
assertion below was re-run with `check-ignore -q` and its exit status.

### Confirmed IGNORED — 19/19

| Path | Matched by |
|---|---|
| `.env`, `Backend/.env`, `Frontend/.env` | `.env` |
| `Backend/best.onnx` | `*.onnx` |
| `ML/checkpoints/tuned_fixed/best.pth` · `last.pth` · `best.onnx` | `checkpoints/` |
| `ML/videos/6-MaleGlasses.avi` | `/ML/videos/` |
| `ML/results/*` | `/ML/results/` |
| `Backend/.venv/`, `ML/venv/` | `.venv/`, `venv/` |
| `Frontend/node_modules/` | `node_modules` |
| `Frontend/.output/` | `.output` |
| `Backend/.coverage`, `Backend/.pytest_cache/` | `.coverage`, `.pytest_cache/` |
| `.pytest-tmp-review/**` | `.pytest-tmp*/` **(added this phase)** |
| `.docker-ca/`, `docker-compose.local-ca.yml` | dedicated rules |
| `_to_delete/` | `_to_delete/` |

### Confirmed NOT IGNORED — 18/18

`.gitignore` · `.env.docker.example` · `Backend/.env.example` · `docker-compose.yml` ·
`Backend/Dockerfile` · `Backend/requirements.txt` · `Backend/requirements-torch.txt` ·
`Backend/app/main.py` · `Backend/app/api/v1/admin.py` · **`Backend/app/domain/models/manager.py`** ·
**`Backend/app/domain/models/custom_frcnn/faster_rcnn.py`** · `Backend/tests/api/test_health.py` ·
`Backend/test_metrics_tuned.json` · `Frontend/Dockerfile` · `Frontend/package-lock.json` ·
`Frontend/src/lib/api.js` · **`ML/models/faster_rcnn.py`** · `PHASE_1_REPORT.md`

Both `models/` **source** directories are tracked, which was the specific hazard the root
`.gitignore` was written to avoid.

### Negation inventory

Every `!` rule across all four files was enumerated and checked, because a negation in a deeper
file can defeat a root rule:

| File | Negations | Verdict |
|---|---|---|
| root | `!.env.example`, `!.env.docker.example`, `!.env.*.example`, `!*.tfvars.example`, `!Frontend/public/**`, `!.vscode/extensions.json` | all safe |
| `Backend/` | `!.env.example` | safe |
| `Frontend/` | `!.vscode/extensions.json` | safe |
| `ML/` | **none** — the dangerous one was removed this phase | safe |

---

## 7. Secret-Scan Results

No secret value is printed anywhere in this report.

### Method

1. The real values of genuinely sensitive variables were loaded **from the gitignored `.env` files**
   and held in memory, then searched for byte-exact inside every staged blob.
2. Independently, 11 credential-shaped regex patterns were run over all staged content.
3. Both scans read blobs **from the Git index** (`git cat-file blob`), not the working tree, so the
   result describes exactly what a commit would contain.

### Result: staged content is clean

| Check | Result |
|---|---|
| `SECRET_KEY` value in staged content | ✅ **absent** |
| `SUPABASE_SERVICE_ROLE_KEY` value in staged content | ✅ **absent** |
| `SUPABASE_JWT_SECRET` value in staged content | ✅ **absent** |
| AWS access-key pattern | ✅ none |
| Private-key header (`-----BEGIN … PRIVATE KEY-----`) | ✅ none |
| GitHub / Slack tokens | ✅ none |
| Pattern hits requiring review | ✅ **zero** |

### Environment-file inventory (names and populated-state only)

| File | Vars | Sensitive by name | State | Git |
|---|---|---|---|---|
| `Backend/.env` | 21 | `SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` | **populated — real** | ✅ ignored |
| | | `SMTP_PASSWORD`, `WHATSAPP_API_KEY` | placeholder | ✅ ignored |
| `Frontend/.env` | 7 | none | publishable/anon + API URL | ✅ ignored |
| `.env` (root) | 6 | none | publishable `VITE_*` + ports | ✅ ignored |
| `Backend/.env.example` | 25 | 4 | **all placeholders** | ✅ tracked (safe) |
| `.env.docker.example` | 6 | 0 | placeholders | ✅ tracked (safe) |

### Classified findings — all benign

| File:line | Type | Classification |
|---|---|---|
| `Backend/tests/unit/test_supabase_client.py:25` | `sb_secret_…` pattern | **Test-only fake.** The literal is a self-describing constant ending `_test_value_not_a_real_key`. No action, but see §17 item 9. |
| `Backend/tests/conftest.py:184` | URL with embedded credentials | **Deliberate fake.** `postgres://admin:hunter2@…` exists so a test can assert the 500 handler never leaks it. Removing it would delete a security test. No action. |
| `DEPLOY.md:339` | Supabase **publishable** key | **Not a credential leak** — the publishable/anon key is browser-safe by design and is already inlined into the frontend JS bundle served to every visitor. Flagged for your decision, see §17. |

### False positives corrected during the scan

The first scan pass reported ~60 "blockers". Every one was an artefact of loading *all* env values
rather than only sensitive ones: it flagged `VITE_API_URL`, `MODEL_PATH`, `SMTP_HOST`,
`ALLOWED_ORIGINS`, `SUPABASE_URL` and `*_PROJECT_ID` — none of which are credentials. The scan was
narrowed to genuinely sensitive variable names and re-run. Recorded here rather than quietly
dropped, because "the first scan said 60 blockers" is exactly the kind of result that should not
disappear from a security report.

### Personal data

14 distinct email-like strings appear in staged content. All are fictional: demo users in
`Frontend/src/components/admin/mockData.js`, the project's own `@drivealert.io` support addresses in
UI components, and form placeholders (`you@company.com`, `driver@example.com`). **No real personal
data.**

### Git history

**Not applicable.** No repository existed before this phase, so there is no history to audit.

---

## 8. Large-File Scan

### Working tree

| File | Size | Status |
|---|---|---|
| `ML/checkpoints/tuned_fixed/last.pth` | **128.6 MB** | ⛔ over GitHub's 100 MB hard limit · ✅ ignored |
| `ML/checkpoints/tuned_fixed/best.pth` | **128.6 MB** | ⛔ over the hard limit · ✅ ignored |
| `ML/videos/6-MaleGlasses.avi` | 97.0 MB | over the 50 MB warning · ✅ ignored |
| `ML/checkpoints/tuned_fixed/best.onnx` | 65.0 MB | over the warning · ✅ ignored |
| `Backend/best.onnx` | 65.0 MB | over the warning · ✅ ignored — see §14 |

Directory sizes: `ML/` 4.1 GB · `Backend/` 1.2 GB · `Frontend/` 372 MB — dominated by
`ML/venv/` (3.5 GB), `Backend/.venv/` and `Frontend/node_modules/`, all ignored.

### Staged

| Threshold | Count |
|---|---|
| > 100 MB (GitHub hard limit) | **0** |
| > 50 MB (GitHub warning) | **0** |
| > 10 MB | **0** |

---

## 9. Staged File Count and Size

| Metric | Value |
|---|---|
| Commit candidates found | 426 |
| **Files staged** | **426** (425 + this report) |
| Deliberately not staged | 1 — `AGENTS.md` (see §17) |
| **Total staged blob size** | **2.67 MB** (2,804,875 bytes) |
| Insertions | 66,377 lines |

By group:

| Group | Files | Size |
|---|---|---|
| `Frontend/` | 258 | 1.61 MB |
| `Backend/` | 121 | 0.71 MB |
| `ML/` | 39 | 0.21 MB |
| root files | 8 | 0.15 MB |

---

## 10. Largest Staged Files

| Size | File |
|---|---|
| 282.4 KB | `Frontend/package-lock.json` |
| 85.9 KB | `Frontend/src/assets/preview-analytics.jpg` |
| 85.2 KB | `Frontend/src/assets/preview-live.jpg` |
| 82.9 KB | `Frontend/src/assets/hero-cockpit.jpg` |
| 66.2 KB | `PHASE_1_REPORT.md` |
| 62.3 KB | `Frontend/src/assets/auth-side.jpg` |
| 38.5 KB | `Frontend/.lovable/backend-plan.md` |
| 36.4 KB | `Frontend/src/routes/_authenticated/analytics.jsx` |
| 30.8 KB | `Frontend/src/routes/_authenticated/dashboard.jsx` |
| 24.1 KB | `PHASE_0_AUDIT.md` |

The four JPGs are the landing page's own imagery — application assets, not training output.

---

## 11. Files Intentionally Ignored

Secrets: `.env`, `Backend/.env`, `Frontend/.env` ·
Model artifacts: `Backend/best.onnx`, all `*.pth`/`*.pt`/`*.onnx` ·
ML bulk: `/ML/checkpoints/`, `/ML/results/`, `/ML/videos/`, `/ML/venv/` ·
Environments: `Backend/.venv/`, `Frontend/node_modules/` ·
Build output: `Frontend/.output/`, `.nitro/`, `.tanstack/`, `.wrangler/` ·
Caches: `.pytest_cache/`, `.ruff_cache/`, `__pycache__/`, `.coverage`, `.pytest-tmp*/` ·
Machine-specific: `.docker-ca/`, `docker-compose.local-ca.yml` ·
Leftovers: `_to_delete/` · IDE/OS files · logs · archives.

---

## 12. Ruff Fix and Test Results

### The fix

`ARG001 Unused function argument: admin` at `Backend/app/api/v1/admin.py:200`.

**Investigated before changing.** Six routes in that module take `admin: AdminUserDep`. An AST check
of each body showed **five genuinely read the value**; only `get_active_model` does not — there the
dependency exists purely as an authorization gate.

Renamed that one parameter to `_admin`. Safe because FastAPI resolves `Depends` from the
**annotation**, not the parameter name, so `require_admin` still runs and the endpoint is still
admin-only. A docstring note records why the underscore is there, so nobody "tidies up" by deleting
what looks like an unused argument and silently makes the endpoint public.

The authorization dependency was **not** removed or weakened.

### Results

| Check | Result |
|---|---|
| `ruff check app/api/v1/admin.py` | ✅ **All checks passed** |
| `ruff check app tests` (whole backend) | ✅ **All checks passed** — the tree is now lint-clean |
| `black --check app tests` | ✅ 108 files unchanged |
| `isort --check-only app tests` | ✅ clean |
| `pytest tests/api/test_admin.py` | ✅ **11 passed** |
| **Complete backend suite** | ✅ **349 passed**, 0 failed (97s) |

Run with `--basetemp=../.pytest-tmp-review` to keep pytest's scratch space project-local; that
directory is now gitignored.

### Other validation

| Check | Result |
|---|---|
| `docker compose config --quiet` | ✅ VALID |
| `Frontend/package.json` / `package-lock.json` | ✅ unmodified (mtimes predate this session; no `audit fix` was run) |
| Docker images | not rebuilt — no Phase 2 change affects the build |

---

## 13. npm Audit Findings — Report Only

`npm audit` was run in **report-only** mode. **No `npm audit fix` was run and the lockfile was not
modified.** Network access was available, so these results are fresh.

### Production dependencies — 3 (2 high, 1 moderate)

| Package | Installed | Severity | Direct? | Affected | Pulled in by | Fix |
|---|---|---|---|---|---|---|
| `js-yaml` | 4.3.0 | **high** | transitive | `4.0.0 – 4.3.0` | `@tanstack/react-start` → `@tanstack/start-plugin-core` → `xmlbuilder2` | available, non-breaking |
| `nanoid` | 3.3.16 | **high** | transitive | `< 3.3.18` | `vite` → `postcss` → `nanoid` | available, non-breaking |
| `postcss` | 8.5.21 | moderate | transitive | `<= 8.5.22` | `vite` → `postcss` | available, non-breaking |

Advisories: quadratic CPU consumption in `!!omap` resolution (js-yaml); custom generators can loop
indefinitely when size is zero (nanoid); incomplete fix of GHSA-6g55-p6wh-862q allowing an
attacker-controlled `sourceMappingURL` to read arbitrary `.map` files (postcss).

### Dev-only — 1 additional (high)

| Package | Installed | Pulled in by |
|---|---|---|
| `brace-expansion` | 1.1.16 / 5.0.7 | `eslint` → `minimatch`; `typescript-eslint` → `@typescript-eslint/typescript-estree` → `minimatch` |

### Assessment

All four are **transitive**; none is a direct dependency of this project, so none can be fixed by
editing `package.json`. npm reports `fixAvailable: true` (a plain boolean, not a
`isSemVerMajor` object) for every one, meaning **npm believes a non-breaking resolution exists**.

All three "production" packages are **build-toolchain** components — `vite`/`postcss`/`nanoid` run
during `npm run build`, and `js-yaml` arrives through the TanStack build plugin. The shipped
frontend runtime image contains only `.output/`, so runtime exposure is limited; the meaningful risk
is to the **build environment**, which matters once CI builds this repo.

**Correction to the Phase 1.5 report:** it named only `nanoid` and `postcss`. The third production
advisory, `js-yaml`, was not identified there. The count (3 prod: 1 moderate, 2 high) was right; the
package list was incomplete.

### Proposed remediation — awaiting your approval, not applied

1. `npm audit fix` (no `--force`), which should lift the three transitives via lockfile-only updates.
2. Re-run `npm ci` and the production build to confirm nothing regressed.
3. Rebuild the frontend image and re-verify the `node-server` preset assertion.
4. Commit the lockfile change as its own commit, separate from the initial import.

---

## 14. Model Artifact Warning

> ### ⚠️ A fresh clone of this repository cannot build the Backend image.

`Backend/Dockerfile` contains:

```dockerfile
COPY --chown=appuser:appuser best.onnx /app/models/best.onnx
```

`Backend/best.onnx` is **65 MB** and is **deliberately gitignored** (matched by `*.onnx`). It is
present on this machine and local Docker builds work, but it is not in the proposed commit.

**Consequences, stated plainly:**

* `git clone` + `docker compose build` **fails** for anyone else, at the `COPY best.onnx` step.
* Any future CI build will fail the same way until a model-delivery mechanism exists.
* This is the open decision recorded as audit item **D12**. It is **not** resolved here, per
  instruction, and the file was neither moved, deleted, nor uploaded.

### Options for the next decision

| Option | Pros | Cons |
|---|---|---|
| **Git LFS** | Model versioned alongside the code; transparent `git clone`; no extra infrastructure | GitHub's free tier is 1 GB storage **and 1 GB bandwidth/month** — a 65 MB model pulled by every CI run exhausts that in ~15 builds, then bills or blocks. Every clone and every CI runner needs LFS installed. |
| **Amazon S3 (versioned bucket)** | Fits the existing AWS/EKS roadmap; native object versioning; cheap; IAM/OIDC-controlled (Phase 4 creates that anyway); no repo bloat | Requires AWS to exist first — it does not until Phase 4. Adds a bootstrap dependency for Phase 3. |
| **GitHub Release assets** | Free; up to 2 GB per asset; no LFS quota; one `gh release download` in CI; works immediately with no cloud account | Release creation is a manual/scripted step; versioning is tied to releases rather than to commits. |
| **OCI artifact in a registry** (ECR/GHCR via ORAS) | Model versioned next to the images that consume it; same auth as the image push | Most machinery of the four; least familiar tooling. |

### Recommendation — not implemented

**Two-step: GitHub Release assets now, Amazon S3 later.**

The roadmap is GitHub → Actions → Docker Hub → AWS, so **Phase 3 needs the model before AWS
exists**. A GitHub Release asset unblocks CI immediately with no cloud account, no LFS quota, and a
single `gh release download` step. Then, once Phase 4 has created the IAM/OIDC trust that CI will
already be using, migrate to a versioned S3 bucket as the durable home.

Git LFS is the option to avoid here specifically because of the bandwidth quota: a 65 MB model on
every CI run is exactly the usage pattern that quota punishes.

---

## 15. Exact Command Output Summaries

### `git status --short`

```
   426  A   (staged, added)
     1  ??  AGENTS.md
```

### `git diff --cached --stat` (final line)

```
 426 files changed, 66377 insertions(+)
```

### `git diff --cached --name-only` (counts by group)

```
Frontend/   258
Backend/    121
ML/          39
root          8   .gitignore  .env.docker.example  docker-compose.yml  DEPLOY.md
                  PHASE_0_AUDIT.md  PHASE_1_REPORT.md  PHASE_2_PRECOMMIT_REPORT.md
                  SESSION_REPORT.md
```

### `git diff --cached --check`

```
(no output — no whitespace errors, no conflict markers)
```

### Staged-content secret scan

```
Scanning 426 STAGED blobs from the git index   (re-run AFTER staging this report)
--- REAL CREDENTIALS IN STAGED CONTENT ---   NONE
--- PATTERN HITS NEEDING REVIEW ---          NONE
--- PATTERN HITS CLASSIFIED SAFE ---         3 (two test fixtures + this report quoting one)
VERDICT: STAGED SET IS SAFE
```

### Staged size validation

```
TOTAL STAGED BLOB SIZE : 2.67 MB (2,804,875 bytes)
> 100 MB : 0 files
>  50 MB : 0 files
>  10 MB : 0 files
```

---

## 16. Confirmation of What Did **Not** Happen

| Statement | Verified by |
|---|---|
| **No commit exists** | `git rev-list --count --all` → `0`; `git rev-parse HEAD` → *unknown revision* |
| **No remote exists** | `git remote -v` → empty |
| **Nothing was pushed** | no remote to push to; no push command was run |
| **No GitHub repository was created** | no `gh` or API call was made |
| **No Phase 3+ artifacts** | no `.github/`, `terraform/`, `k8s/`, `.terraform/` |
| **Lockfile untouched** | `npm audit fix` never run; `package-lock.json` mtime predates this session |
| **`best.onnx` untouched** | still at `Backend/best.onnx`, 65 MB, not moved or deleted |

---

## 17. Remaining Risks and Blockers

| # | Item | Severity | Note |
|---|---|---|---|
| 1 | **`Backend/best.onnx` not in the commit** | **High** for CI | A fresh clone cannot build the backend image. §14. Decision required before Phase 3. |
| 2 | `AGENTS.md` (root) left unstaged | Low — your call | A 1-line Cowork tooling stub whose entire content is a heading. `Frontend/AGENTS.md` is genuine project content and **is** staged. Delete the root stub, or tell me to stage it. |
| 3 | `DEPLOY.md` contains the Supabase **publishable** key | Low | Browser-safe by design, already public in the shipped JS bundle — not a leak. But `DEPLOY.md` is a superseded Render/Vercel plan; consider redacting or removing it. |
| 4 | No `.gitattributes` | Low | Git reported CRLF normalization for most text files. No shell scripts are staged, so nothing breaks today, but a `.gitattributes` with `* text=auto eol=lf` would prevent cross-platform churn. Not added — not in the Phase 2 brief. |
| 5 | 3 production npm advisories | Medium | §13. Remediation proposed, not applied. |
| 6 | `SUPABASE_JWT_SECRET` still present in `Backend/.env` | Low | Legacy and unused (project uses ES256/JWKS). Safe to delete from the file. Audit **S7**. |
| 7 | `PHASE_1_REPORT.md` contains two absolute local paths | Very low | `cd "D:/Project/..."` in reproduction snippets. Not secret-bearing. |
| 8 | Secrets exist only on this machine | Medium | `Backend/.env` is correctly ignored, so the real `SECRET_KEY`, service-role key and JWT secret exist in exactly one place with no backup. Losing this machine loses them. |
| 9 | GitHub push protection may flag a test fixture | Low, but blocks the push | `Backend/tests/unit/test_supabase_client.py:25` assigns a fake Supabase service key whose shape matches a real one. GitHub's secret scanning can reject the push on pattern alone. It is **not** a real key. If the push is blocked, either allow it in the GitHub UI or rename the constant (e.g. drop the `sb_` prefix) — do not delete the test. |

---

## 18. Recommendation

### ✅ The proposed first commit is **safe to make**.

Supporting evidence:

* **No real credential is in the staged content.** Verified byte-exact against the actual values
  from the gitignored `.env` files, scanning blobs from the Git index rather than the working tree.
* **Zero pattern hits require review.** The only two matches are a self-describing fake
  (a constant ending `_test_value_not_a_real_key`) and a deliberate fake DSN that exists so a test can prove
  the 500 handler does not leak it.
* **No file exceeds any GitHub limit** — largest staged file is 282 KB, total 2.65 MB, nothing over
  10 MB.
* **Both `.pth` files over the 100 MB hard limit are ignored**, confirmed by `git check-ignore`.
* **No source is ignored** — including the two `models/` directories that a naive rule would have
  silently untracked.
* **The backend tree is lint-clean and 349 tests pass.**

### Two things to settle before you approve

1. **`AGENTS.md`** — stage it, or delete the stub? It is currently the only untracked file.
2. **`DEPLOY.md`** — keep as-is, or redact the publishable key / drop the superseded file?

### What I recommend for the commit itself

A single initial-import commit is appropriate here: there is no history to preserve, and splitting
425 files of an existing working system into artificial commits would add no information.

**Do not push before deciding the model-artifact strategy (§14)** — not because pushing is unsafe,
but because the first CI run will fail at `COPY best.onnx` and it is better to know that now than to
debug it as a red build.

---

*No commit was created. No remote was added. Nothing was pushed. Awaiting explicit approval.*


---
---

# Phase 2 Final Cleanup and Local Commit

**Date:** 2026-08-24
**Authorisation:** pre-commit review approved with cleanup requirements; local commit authorised.
**Explicitly not authorised and not done:** no GitHub repository, no remote, no push, no model
upload, no `npm audit fix`, no dependency upgrades, no Phase 3 (Docker Hub, GitHub Actions, AWS,
IAM, OIDC, Terraform, Kubernetes, EKS, S3, model migration).

---

## 1. Root `AGENTS.md` — deleted

Inspected before deleting: **47 bytes, 1 line**, whose entire content was the heading
`## Imported Claude Cowork project instructions`. No project instructions, no configuration — an
empty tooling stub left by the editor.

**Deleted.** It was the only untracked file; the working tree now has none.

**`Frontend/AGENTS.md` was NOT touched.** It holds 480 bytes of genuine project content (a Lovable
warning about not rewriting published git history) and remains staged.

## 2. `DEPLOY.md` — sanitised

The real Supabase **publishable/anon** key was replaced with the placeholder
`${VITE_SUPABASE_PUBLISHABLE_KEY}`. One occurrence; the surrounding deployment table and
instructions are unchanged.

Re-audited afterwards for every category requested. **No value was printed at any point.**

| Credential type | Found in `DEPLOY.md`? |
|---|---|
| Supabase **service-role** key (`sb_secret_…`) | ✅ none |
| Supabase JWT secret | ✅ none |
| SMTP password | ✅ none |
| WhatsApp API key | ✅ none |
| AWS credentials / access keys | ✅ none |
| Bearer / GitHub / Slack tokens | ✅ none |
| Private-key headers | ✅ none |
| JWTs | ✅ none |
| Supabase publishable key | ⚠️ was present → **replaced with a placeholder** |

**One thing deliberately left in place.** `DEPLOY.md` still contains the Supabase **project URL**
and **project ID** (`https://<ref>.supabase.co`, and the bare ref). These are not credentials: the
URL is compiled into the frontend bundle and served to every visitor, so it is public by
construction, and the same values appear throughout `PHASE_0_AUDIT.md` and `PHASE_1_REPORT.md`.
Masking them everywhere would be a large documentation rewrite for no security gain. Flagged here so
the decision is visible rather than assumed — say the word if you want them templated too.

## 3. Root `.gitattributes` — created

Created with exactly the configuration specified: `* text=auto`, `eol=lf` for
`*.sh`/`*.yml`/`*.yaml`/`*.tf`/`*.tfvars`/`Dockerfile`/`*.dockerfile`, `eol=crlf` for
`*.bat`/`*.cmd`/`*.ps1`, and `binary` for the image/model/video extensions. No extra
language-specific rules were added.

### Normalization impact: none

This was the risk worth checking, and it came back clean.

```
Status after staging .gitattributes alone:
  426  A    (unchanged, still staged)
    1  AM   DEPLOY.md   <- my own sanitisation edit, not normalization
```

**Zero files were re-normalised.** The earlier `git add` had already stored LF in the index (Git's
`core.autocrlf` was active and reported `LF will be replaced by CRLF` on checkout), and `text=auto`
agrees with that, so the attributes file changed nothing already staged.

`git add --renormalize .` was **not** run, and was not needed.

## 4. Final staged set

| Metric | Value |
|---|---|
| **Files staged** | **427** |
| **Total staged size** | **2.68 MB** (2,806,615 bytes) |
| Insertions | 66,424 lines |
| Untracked files | **0** |
| Unstaged modifications | **0** |
| Files > 100 MB | **0** |
| Files > 50 MB | **0** |
| Files > 10 MB | **0** |

Change from the pre-commit review: 426 → 427 (`+.gitattributes`, `−AGENTS.md`, `+` this section's
report update; `AGENTS.md` was never staged, so it leaves no gap).

### Largest staged files

| Size | File |
|---|---|
| 282.4 KB | `Frontend/package-lock.json` |
| 85.9 KB | `Frontend/src/assets/preview-analytics.jpg` |
| 85.2 KB | `Frontend/src/assets/preview-live.jpg` |
| 82.9 KB | `Frontend/src/assets/hero-cockpit.jpg` |
| 66.2 KB | `PHASE_1_REPORT.md` |
| 62.3 KB | `Frontend/src/assets/auth-side.jpg` |
| 38.5 KB | `Frontend/.lovable/backend-plan.md` |
| 36.4 KB | `Frontend/src/routes/_authenticated/analytics.jsx` |

**No model, checkpoint, dataset or video is staged** — a filename scan for
`*.onnx|pth|pt|ckpt|h5|safetensors|avi|mp4|mkv|zip|tar|rar` across the index returned nothing.

## 5. Final secret scan — CLEAN

Run against **Git index blobs** (`git cat-file blob`), so it describes the commit content exactly.

| Category | Result |
|---|---|
| Real values from ignored `.env` files (`SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `SMTP_PASSWORD`, `WHATSAPP_API_KEY`, AWS) | ✅ **NONE** |
| AWS access-key / secret patterns | ✅ none |
| Private-key headers | ✅ none |
| JWTs | ✅ none |
| Supabase service-role pattern | ✅ none real |
| Supabase publishable pattern | ✅ none — removed from `DEPLOY.md` |
| GitHub / Slack / Bearer tokens | ✅ none |
| Password assignments | ✅ none real |
| **Patterns requiring review** | ✅ **ZERO** |

Three hits classified **safe**, all deliberate:

| File:line | Classification |
|---|---|
| `Backend/tests/conftest.py:184` | Deliberately fake DSN (`postgres://admin:hunter2@…`) that exists so a test can assert the 500 handler never leaks it. Deleting it would delete a security test. |
| `Backend/tests/unit/test_supabase_client.py:25` | Test-only fake ending `_test_value_not_a_real_key`. |
| `PHASE_2_PRECOMMIT_REPORT.md:161` | This report quoting the fake DSN above while explaining it. |

Public-by-design values (Supabase project URL/ID, `VITE_API_URL`, `SMTP_HOST`, `APP_ENV`) do appear
in the documentation and `.env.example` files. They are configuration, not credentials.

## 6. `.gitignore` validation — 23/23 ignored, 19/19 tracked

**Confirmed ignored:** `.env` · `Backend/.env` · `Frontend/.env` · `Backend/best.onnx` ·
`*.onnx`/`*.pth`/`*.pt` (all three ML checkpoints) · `Backend/.venv/` · `ML/venv/` ·
`Frontend/node_modules/` · `Frontend/.output/` · `ML/data/` (datasets) · `ML/videos/` ·
`ML/results/` · `Backend/.coverage` · `.pytest_cache/` · `.ruff_cache/` · `__pycache__/` ·
`.pytest-tmp*/` · `.docker-ca/` · `docker-compose.local-ca.yml` · `_to_delete/`

**Confirmed tracked and staged:** `.gitignore` · **`.gitattributes`** · `.env.docker.example` ·
`Backend/.env.example` · `Backend/app/` · `Backend/tests/` · `Backend/Dockerfile` · `Frontend/src/` ·
`Frontend/Dockerfile` · `Frontend/package.json` · `Frontend/package-lock.json` ·
`docker-compose.yml` · `ML/models/faster_rcnn.py` · `Frontend/AGENTS.md` · all four phase documents

Verified with `git check-ignore -q` using the **exit code**, not command output.

**`best.onnx` strategy unchanged.** The file remains at `Backend/best.onnx`, 68,159,217 bytes, on
disk and ignored. It was not moved, deleted, uploaded or re-included.

## 7. Test, lint and build results

| Check | Result |
|---|---|
| `ruff check app tests` | ✅ **All checks passed** |
| `black --check app tests` | ✅ 108 files unchanged |
| `isort --check-only app tests` | ✅ clean |
| `pytest tests -q` | ✅ **349 passed**, 0 failed (107s) |
| `docker compose config --quiet` | ✅ VALID |
| Frontend production build | ✅ built, `preset: node-server` |
| `git diff --cached --check` | ✅ no whitespace errors, no merge markers |

pytest used `--basetemp=../.pytest-tmp-review` to keep scratch space project-local; that directory
is gitignored.

**`package.json` and `package-lock.json` are unmodified** — mtimes 2026-07-23 and 2026-08-06, both
predating this phase. `npm audit fix` was never run, in this phase or any other.

## 8. Warnings and things still true

1. **A fresh clone still cannot build the Backend image.** `Backend/Dockerfile` executes
   `COPY best.onnx /app/models/best.onnx`, and `Backend/best.onnx` is gitignored and not committed.
   Anyone cloning this repository — and any future CI job — fails at that step. This is unchanged
   and intentional; see §9.
2. **npm vulnerabilities remain open and documented.** 3 production advisories (`js-yaml` high,
   `nanoid` high, `postcss` moderate) and 1 dev-only (`brace-expansion` high). All transitive, all
   with non-breaking fixes available. **No automatic fix was performed and the lockfile is
   untouched.** Details in §13 of the pre-commit report.
3. **The Supabase project URL and ID remain in documentation** — public by design, see §2 above.
4. **GitHub push protection may reject the first push** over
   `Backend/tests/unit/test_supabase_client.py:25`, whose fake constant matches the *shape* of a real
   Supabase key. It is not a real key. If blocked, allow it in the GitHub UI or rename the constant —
   do not delete the test.
5. **The real secrets exist only on this machine**, in the gitignored `Backend/.env`, with no backup.

## 9. Model artifact decision record — recorded, not implemented

**Nothing was uploaded, migrated or published. Git LFS was not used. No GitHub Release was created.**

### Short-term (after the GitHub repository exists)

Store a versioned `best.onnx` as a **GitHub Release asset**, and have the build download it and
**verify a checksum** before `docker build`. Chosen because Phase 3 needs the model *before* AWS
exists: a Release asset needs no cloud account, has a 2 GB per-asset limit, costs nothing, and is one
`gh release download` step. The checksum matters — it is what makes an out-of-band artifact
trustworthy.

### Long-term (after AWS IAM/OIDC exists)

Move versioned model artifacts to **Amazon S3** with bucket versioning, read via the same OIDC role
CI will already assume. This aligns with the EKS target, keeps artifacts out of the repository, and
gives real object versioning.

### Explicitly rejected

**Git LFS.** GitHub's free tier allows 1 GB of LFS bandwidth per month; a 65 MB model pulled on every
CI run exhausts that in roughly 15 builds, after which builds either bill or block.

### Status

**Implementation deferred until explicitly approved.** No Release, no S3 bucket, no download step,
no checksum file has been created.

## 10. First local commit

Created after every check above passed:

```
Initial import: application, ML source, and Docker setup
```

Pre-commit confirmations: no real secret staged · no model artifact staged · no file over any GitHub
limit · no unexpected untracked file · **no remote configured**.

> This report is *inside* the commit, so it cannot contain its own commit hash. The hash, the
> `git show --stat` summary and the post-commit working-tree status are reported in the session
> response accompanying this phase.

**No remote was added. Nothing was pushed. No GitHub repository was created. Phase 3 was not
started.**
