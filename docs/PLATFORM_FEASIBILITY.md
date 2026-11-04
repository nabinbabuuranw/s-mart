# S Mart — Platform Feasibility for M2 (Android apps) and M3 (Windows admin .EXE)

Written 2026-11-04 from what is actually on this box plus Nabin's earlier delivery routes. Labels: **[measured]** = read on this box this session; **[notes]** = from existing memory/log notes; **[unverified]** = published or remembered figure, or a route not yet tried. **No APK or EXE has been built by this document's author. None exists yet for S Mart.** No feasibility build (Capacitor "hello") was run: the SDK exists, but the box was heavily loaded and the 10-minute / 1.5 GB budget could not be guaranteed.

## 1. What is installed [measured]

| Tool | State |
|---|---|
| Java | OpenJDK 17.0.21 at `/usr/bin/java` |
| Android SDK | `/home/user/android-sdk`, 3.0 GB total: platforms android-34, 35, 36; build-tools 34.0.0, 35.0.0, 36.0.0; cmdline-tools `latest`; platform-tools (adb); NDK 27.1.12297006. `ANDROID_HOME` is not exported (set it per command). |
| Gradle | no system `gradle`; a wrapper distribution `gradle-8.14.3-bin` is cached under `~/.gradle` (whole `~/.gradle` = 3.9 GB: 2.9 GB build caches, 935 MB module cache). Projects with a Gradle wrapper can build offline-ish. |
| Node / npm | Node v22.23.3, npm present |
| Not installed | Flutter/Dart, Wine, Rust/cargo (so no Tauri), Docker, `makensis`, an Electron or electron-builder cache (`~/.cache/electron*` absent) |
| Disk | 17 GB free of 66 GB at time of reading (shared with other workers; keep >=5 GB free) |
| Emulator | no system images and no KVM mentioned in notes, so **no emulator testing**; adb cannot test on Nabin's phone either |

## 2. How Nabin's earlier mobile work was delivered [notes + measured]

* The Veerbhumi game: Godot 4.7 + the same Android SDK, release APKs built locally (31.8 MB phase 1, 43.6 MB M2, minSdk 24), signed with a release keystore in `/home/user/tools/keystores/` (never committed). Over WhatsApp's 32 MiB limit, the M2 APK was served as chunked files on GitHub Pages with an in-browser reassembly page and SHA-256 check; the connected GitHub route cannot upload release binaries. This is a proven delivery pattern for any S Mart APK > 32 MB. [notes]
* NEXA Admin app (`/home/user/tab/tasks/nexa-admin-app`): Expo SDK 54 / React Native 0.81 / TypeScript project with a generated `android/` directory containing `gradlew`, `build.gradle`, `local.properties`, and a `build/` folder, i.e. the **Expo prebuild + local Gradle** route was used on this box, not EAS cloud. The README states it has no backend and is not fully wired. Whether a release APK from it was ever delivered/installed is not stated in the notes I read. [measured: directory contents; unverified: delivery]
* A directory `/home/user/tools/nexa-mobile-app` does not exist at that path; the NEXA apps live under `/home/user/tab/tasks/`. [measured]
* No memory note mentions EAS builds, Capacitor, Electron or a Windows .EXE; Windows desktop builds were never done (the game notes say Windows/Linux templates were not built). [notes; grep of memory]

## 3. Android options (M2: shopping app + admin app, both consuming `/api/v1`)

| Path | Disk cost | Time (first working signed debug/release APK, once code exists) | Risks | Verdict |
|---|---|---|---|---|
| **A. Capacitor wrapper around the responsive customer-web / admin-web** | tiny project (~50-150 MB with node_modules, **unverified**); reuses the existing 3 GB SDK and 3.9 GB Gradle caches (+ ~0.5-1 GB new Gradle deps, **unverified**) | 1-2 h per app for scaffolding + native plugins + signing; first Gradle run 5-15 min on this box | Needs the web apps to be served from HTTPS (the app loads `https://…` or bundled static export). Feels like a web view, not native; Play-Store policy for thin web wrappers is a risk if Nabin ever publishes. Push needs a Firebase project (below). Offline needs a service worker or bundled export. | **Fastest, lowest risk for M2.** Good enough for an installable, honest v1; label it "hybrid/web-based". |
| **B. Expo / React Native + local Gradle (prebuild + assembleRelease)** | project ~400-700 MB with node_modules (**unverified**); `android/` build outputs 1-2 GB; shares existing SDK/Gradle | 4-8 h per app including real screens; 10-20 min first build | Heavier to build well, more bugs to chase without a device; Clerk is not needed (we use our own JWT). Already proven on this box with NEXA Admin. | Best "real native-feeling" option. Recommend for the **customer shopping app** only if Nabin wants more than a wrapper. |
| C. Flutter | SDK ~1.5-2.5 GB download + caches (published, **unverified**); not installed | 6-10 h per app plus a long toolchain setup | Most disk and setup risk on a box that already holds 4 big caches; no existing Flutter code. | Not recommended now. |
| D. Kotlin + Jetpack Compose (native) | no new SDK; Compose deps ~0.5-1 GB in Gradle cache (**unverified**) | 10+ h per app | Highest effort; two native apps double it. Best result long-term. | Only if Nabin wants Play-Store-grade native later. |

**Recommendation M2:** build **both** Android apps as Capacitor wrappers of the responsive web apps first (shared codebase, always in sync with the API; the admin app and shop app differ by start URL/branding), ship signed APKs, and plan an Expo/React Native native shopping app as a follow-up only if the wrapper's feel is not acceptable. Signing: a release keystore separate from the game keystore, stored in `/home/user/tools/keystores/`, never committed; the APK is sideload-only (Play Protect warning is normal).
Estimated total for M2 with Capacitor: **3-5 h of worker time for both APKs, ~1-2 GB of extra disk**. Not tested on a real phone by us; Nabin must test installation.

## 4. Push notifications

* Firebase Cloud Messaging **requires a Firebase project and `google-services.json`** from Nabin's own Google account; Tab cannot create it without his login. Free tier is enough. The backend keeps an FCM provider interface; until the project exists, push is not available. [documented requirement]
* **Free alternative that needs no account:** in-app delivery over the already-planned SSE stream plus polling of a notifications endpoint when the app is open (and an Android foreground service is not needed for a first version). Limitation: the phone gets nothing while the app is closed. For the Windows app, Electron's native `Notification` API fed by the same SSE stream works with no external account.
* Honest scope for M2 without Firebase: "real-time while the app is open"; "push while closed" is blocked on Nabin's Firebase project.

## 5. Windows .EXE (M3, admin app)

| Path | Disk | Time | Risks | Verdict |
|---|---|---|---|---|
| **A. Electron + electron-builder, built on a GitHub Actions `windows-latest` runner** | nothing on this box except the repo (~tens of MB); the runner does the heavy work (Electron ~100-200 MB download per build, **unverified**) | 1-2 h to set up, 5-10 min per CI run (**unverified**) | Needs the repo and workflow on GitHub. Notes show the connected route can create repos, push many small blobs and trees (largest blob 2.5 MB; a 7.6 MB blob failed) and that **GitHub Actions CI ran green** for the SMS repo, so workflow files can be pushed and runs observed through the connected account [notes]. Artifact download through the connected route is **not proven** [unverified]. The workflow can instead create a GitHub Release with the workflow's own `GITHUB_TOKEN` (needs `permissions: contents: write`), so no binary ever passes through the connected route; a public release asset can be fetched with plain `curl` from this box and hosted/linked for Nabin [inferred; to be tried in M3]. | **Recommended.** The only route that produces a real NSIS installer `.exe` without a Windows machine. |
| B. Electron + electron-builder on this Linux box (NSIS cross-build) | needs Wine (~0.5-1 GB with prefix, **unverified**) plus Electron/NSIS caches (~0.5 GB, **unverified**); Wine is not installed | 1-3 h of fiddling | Wine on a shared, loaded box with 12 OOM kills since boot [measured in live state] and an unattended installer; NSIS cross-build via Wine is flaky; cannot test the result on Windows. | Fallback only. |
| C. Electron portable zip/`win-unpacked` from Linux (no Wine) | ~0.5-0.7 GB with the Electron Windows zip (**unverified**) | 30-60 min | Not an installer; user unzips and runs the exe; no auto-update/shortcuts. | Acceptable stopgap; must be labelled "portable, not an installer". |
| D. Tauri | requires Rust (not installed, ~1-1.5 GB toolchain **unverified**) plus Windows build tools; cross-compiling to Windows from Linux is poor | long | Smaller binaries but the heaviest setup; still best built on the Windows runner. | Not recommended for this box. |

**Auto-update:** `electron-updater` with the GitHub provider can read releases of a **public** repo without a token. Each release needs `latest.yml` and the installer uploaded as release assets — done by the Actions workflow (not by the connected route, which cannot carry binaries >~2.5 MB: 413/502 observed on the notes). Limits: unsigned installer ⇒ Windows SmartScreen warning ("Unknown publisher"); Windows code signing needs a paid certificate (not free; out of budget) and so is not possible now. Auto-update still works unsigned but the warning remains. [partially notes, rest unverified until built]
**Desktop notifications:** Electron `Notification` API on Windows 10/11 fed by the SSE stream. **Secure auth:** the same JWT login against the HTTPS API; tokens in the OS keychain through Electron `safeStorage`; no DB credentials in the app.
Windows 10/11 testing: **impossible on this box** (no Windows, no Wine tested). We can verify that the CI built and the installer's size/hash; Nabin must test installation.

## 6. Hosting constraint that affects both M2 and M3

The apps need an **HTTPS URL for the API** (and for the web apps if wrapped). Nabin has no VPS; the API is not hosted publicly in M1. Until a host exists, the apps can only be pointed at a URL Nabin supplies or at a developer machine on the LAN. Free managed Postgres tiers plus a free Node host exist but have cold-start/limits (**unverified**, to be chosen with Nabin). This is the largest real-world blocker for "working" APK/EXE, bigger than the build tooling.

## 7. Recommended plan

| Milestone | Plan | Disk | Time | Nabin must supply |
|---|---|---|---|---|
| M2a | Capacitor Android Shopping app + Capacitor Android Admin app (two packageIds, e.g. `com.smart.shop` and `com.smart.admin`), signed with a new release keystore; SSE live updates; installer chunk-download page if APK >32 MB | +1-2 GB | 3-5 h | HTTPS API URL (or confirm a free host), branding approval; testing on his phone |
| M2b (optional) | Native-feeling shopping app in Expo/React Native with local Gradle | +2-3 GB | 6-10 h | decision after trying M2a |
| M2c | FCM push | small | 1-2 h after keys | Firebase project + `google-services.json` |
| M3 | Electron admin app (loads the admin-web build or bundled static export), electron-builder NSIS config, GitHub Actions `windows-latest` workflow publishing a Release with installer and `latest.yml`; unsigned | ~0 on box | 2-3 h | confirm GitHub repo is public and Actions allowed; accept SmartScreen warning; test on Windows 10/11 |

Fall-backs: if Actions cannot be used, ship the portable zip (path C), clearly labelled.

## 8. Unverified / not done

* No Capacitor, Expo, Gradle or Electron build was run for S Mart; every disk and time figure above marked unverified is a published or experience-based estimate.
* The behaviour of the Actions-Release-then-`curl` route and of artifact retrieval through the connected GitHub route was not tried.
* Whether NEXA Admin's APK was ever built and delivered was not determined.
* No device, emulator or Windows machine is available for testing.
