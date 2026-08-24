# Model Artifact

The trained detector this service runs is versioned **in this repository**, through **Git LFS**.

Without Git LFS installed, a clone gives you a 133-byte text pointer where the model should be, and
the Backend Docker build fails at `COPY best.onnx`. That is the single thing to get right below.

---

## The artifact

| | |
|---|---|
| **Path** | `Backend/best.onnx` |
| **Storage** | Git LFS (tracked in the repository, stored as an LFS object) |
| **Size** | **68,159,217 bytes** (65.00 MiB) |
| **SHA-256** | `b8e9af676bd63a6fcee6a219ac431e46071a1d64bdf448a0d53bc576cbda4ebf` |
| **Format** | ONNX, opset export of the project's from-scratch Faster R-CNN |
| **Visibility** | **Public.** This is a public repository; the model is publicly downloadable, and it is also extractable from the published Backend image. |
| **Consumed by** | `Backend/Dockerfile` → `/app/models/best.onnx`; loaded at startup by `ModelManager` via `onnxruntime` |

---

## Cloning this repository

Install Git LFS **once per machine**, before cloning:

```bash
git lfs install
```

```bash
git clone https://github.com/michaelmagdyda/driver-drowsiness-detection.git
```

## If you already cloned without Git LFS

Your `Backend/best.onnx` is currently a pointer file, not the model. Fix it in place:

```bash
git lfs install
```

```bash
git lfs pull
```

## Verifying the download

**Windows (PowerShell):**

```powershell
Get-FileHash Backend/best.onnx -Algorithm SHA256
```

**macOS / Linux:**

```bash
shasum -a 256 Backend/best.onnx
```

The hash must equal the SHA-256 above. If it does not — or if the file is only a few hundred bytes —
the LFS object was not fetched. Re-run `git lfs pull`.

A quick way to tell a pointer from the real model: a pointer is plain text beginning with
`version https://git-lfs.github.com/spec/v1`, and is ~133 bytes.

---

## What is *not* tracked here, and why

Only this one file is in LFS. The tracking rule in `.gitattributes` is deliberately narrow:

```gitattributes
Backend/best.onnx filter=lfs diff=lfs merge=lfs -text
```

It is **not** `*.onnx`. The root `.gitignore` still excludes `*.onnx`, `*.pth`, `*.pt`, `*.ckpt`,
`/ML/checkpoints/`, `/ML/results/`, `/ML/videos/` and the training datasets, so the training
checkpoints under `ML/checkpoints/tuned_fixed/` — including a second, byte-identical `best.onnx` and
two 128.6 MB `.pth` files — stay out of the repository entirely. Two of those exceed GitHub's 100 MB
hard limit, and none of them belongs in an LFS quota that every clone draws against.

`Backend/best.onnx` is force-added (`git add -f`) as a single, deliberate exception. General artifact
protection was not weakened to accommodate it.

---

## Quota note

Git LFS storage and bandwidth are metered by GitHub. Every clone or `git lfs pull` that fetches this
object transfers 65 MiB against the repository owner's bandwidth allowance. On the free tier that
allowance is 1 GiB per month — roughly 15 full fetches. CI systems that clone on every run consume it
quickly; caching the LFS object, or a shallow/`GIT_LFS_SKIP_SMUDGE=1` clone where the model is not
needed, avoids that.

This trade-off was accepted deliberately when choosing LFS over an external artifact store.

---

## Updating the model

1. Replace `Backend/best.onnx` in the working tree.
2. `git add Backend/best.onnx` — the LFS filter converts it to a pointer automatically; **no `-f` is
   needed once the path is already tracked**.
3. Confirm with `git lfs ls-files` and check the staged blob is ~133 bytes, not the model.
4. Update the size and SHA-256 in this file.
5. Commit and push.

Do not commit a replacement without updating the checksum here — the checksum is the only thing that
makes an out-of-band download verifiable.
