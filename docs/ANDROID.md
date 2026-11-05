# S Mart Android app (M2): status and feature matrix

Version 0.1.0-m2 (versionCode 2). Package `com.nabin.smart`, label "S Mart". Native Kotlin and Jetpack Compose, in `apps/android/`. It talks to the same REST API as the customer web app (`/api/v1`, bearer tokens).

Written 2026-11-05 from the code and from the runs listed below. Nothing here is a plan dressed up as a feature: **Implemented** means the screen calls the real API and the call was run; **Partial** means some of it works or is untested; **Planned** means not in the app.

## What was actually run

| Check | Command | Result |
|---|---|---|
| Kotlin compile (typecheck) | `./gradlew :app:compileDebugKotlin` | exit 0 |
| Unit tests (JVM) | `./gradlew :app:testDebugUnitTest` (with `SMART_LIVE_API` set) | 27 run, 0 failed, 0 skipped |
| Live API tests | `LiveApiTest` against a local API on a dev database with DEMO data | 2 run, 0 failed |
| Release build | `./gradlew :app:assembleRelease` | exit 0, signed |
| Signature | `apksigner verify --verbose` | Verifies; v2 scheme true; one signer |
| Manifest | `aapt dump badging` | package com.nabin.smart, label S Mart, minSdk 26, targetSdk 35 |
| Alignment | `zipalign -c 4` | OK |
| Installed on a phone or emulator | not possible here | **not tested** (no KVM, no emulator package on this box) |

The live tests ran these requests against the real API: register, log out, log in, wrong password (401), profile read and update, catalogue list and detail, price-band filter, payment methods (COD enabled, the rest not enabled), add to cart, change quantity, set quantity, wishlist add and remove, address add, checkout with an idempotency key (a repeated key returned the same order, and the database holds one order for it), order list and detail, cancel, and refresh-on-401 (a bad access token is refreshed once with the stored refresh token; a bad refresh token ends the session).

## Feature matrix

| Area | Status | What it does / what is missing |
|---|---|---|
| Splash | Implemented | Brand splash, then Home. Nothing loaded from the network. |
| Home: featured and offers rows | Implemented | Lists come from `/catalog/products` (featured, onOffer). |
| Home: category chips | Partial | Chips show the categories; tapping opens Shop without preselecting that category. |
| Home: hero banners | Planned | The API has banners; the app does not show them yet. |
| Shop: search | Implemented | `q` on `/catalog/products`. |
| Shop: category filter | Implemented | Category slug on `/catalog/products`. |
| Shop: price bands | Implemented | Under Rs. 500, Rs. 500 to 2,000, over Rs. 2,000 (paisa bounds). Filter parameters unit-tested; the band call is in the live test. |
| Shop: sort and load more | Implemented | Newest, price low/high, name; pages of 20. |
| Product detail: photo | Partial | Shows the first photo only (no gallery). Real product photos were not checked against live data. |
| Product detail: variants, price, list price, offers | Implemented | Server prices; the struck list price shows only when it is higher. Out-of-stock variants are disabled. |
| Product detail: save for later | Implemented | Wishlist add and remove (live test). Needs sign-in; a guest is sent to sign in. |
| Cart: add, change, remove, totals | Implemented | Totals are the server's. Live test covers add, set, change. |
| Checkout: addresses | Implemented | Choose an address or add one. Add tested live; choose and delete are not live-tested. |
| Checkout: payment | Implemented (COD only) | Cash on delivery is the only working method. The payment list shows the others as "Not enabled yet". |
| Checkout: idempotent placing | Implemented | One key per checkout attempt; a retry reuses it. Tested live. |
| Checkout: coupon code | Partial | Sent to the server, which validates it. Not tested with a real coupon. |
| eSewa, Khalti, Stripe payments | Planned | Listed as not enabled. No payment flow exists, by design. |
| Sign up, sign in, sign out | Implemented | Bearer tokens in encrypted device storage. Tested live. |
| Session refresh | Implemented | A 401 on a signed-in call refreshes once; if refresh fails, the user is asked to sign in again. Tested live. |
| Password change, forgot password | Planned | Not in the app. |
| Orders list | Implemented | Tested live. |
| Order detail: status, timeline, totals | Implemented | Timeline and totals from the order. The shipment block is written but not yet seen with a shipped order. |
| Order tracking live updates | Planned | The web app listens for updates; the app loads the order when it opens. |
| Cancel an order | Implemented | Placed, confirmed or awaiting payment only (the API's rule). Tested live. |
| Returns | Planned | The API has returns; the app does not. |
| Profile: name and phone | Partial | Name update tested live; clearing the phone is not tested. |
| Addresses: add, delete | Implemented | Add tested live; delete not live-tested. |
| Saved items | Implemented | List, add, remove. |
| Notifications | Planned | The API has notifications; not in the app. |
| Support tickets | Planned | The API has tickets; not in the app. |
| Push notifications | Planned | Needs a Firebase project from Nabin (his Google account). Not created by Tab. |
| Dark mode | Implemented (palette only) | Light and dark palettes from the web app. Not checked on a device. |
| Typography | Implemented | Fraunces (headings) and DM Sans (text), bundled as static instances (SIL OFL 1.1). |
| Offline use | Planned | The app needs the network for everything. |

## Build

Requirements on this box (checked): JDK 17, Android SDK with platforms 34 to 36 and build-tools 34 to 36 at `/home/user/android-sdk`, Gradle 8.14.3 (wrapper), Android Gradle Plugin 8.10.1, Kotlin 2.1.20 with the Compose compiler plugin.

```
cd apps/android
export ANDROID_HOME=/home/user/android-sdk
./gradlew :app:testDebugUnitTest                       # unit tests
SMART_LIVE_API=http://localhost:4100/api/v1 ./gradlew :app:testDebugUnitTest   # + live API tests (needs a running API)
./gradlew :app:assembleRelease                         # signed release APK when signing is set (below)
```

Signing reads four environment variables and never stores them in the repo: `SMART_KEYSTORE` (path to the keystore), `SMART_KEYSTORE_PASSWORD`, `SMART_KEY_ALIAS` (default `smart`), `SMART_KEY_PASSWORD`. Without `SMART_KEYSTORE`, the release build is unsigned.

The API base URL is a Gradle property, `smartApiBaseUrl` (default `http://localhost:4100/api/v1`, a placeholder). Override it per build: `./gradlew -PsmartApiBaseUrl=https://api.example.com/api/v1 :app:assembleRelease`. Cleartext HTTP is allowed in the build only when the URL itself starts with `http://`.

## Limits, stated plainly

- **No deployed API exists yet.** The default base URL is `localhost`, which on a phone means the phone. To use the app on a phone before a deployment, run the API on a machine the phone can reach and build with its address, or deploy the API (Nabin's decision on hosting; see DEPLOYMENT.md).
- **Not installed on a device or emulator.** No install test or UI automation has been run. This box has no KVM and no emulator package.
- **No screenshots** from the app exist, so none are published.
- **Product photos:** images load from the URL the API returns; relative paths resolve against the API origin. The DEMO catalogue's photos were not checked.
- **Release is not minified** (R8 off). The APK is 8.0 MiB, so this costs little, and it avoids reflection-related breakage that could not be tested on a device.
- **Google Play:** the APK is sideload-only. Play Protect will warn; this is normal for an unsigned-by-Play build.
- **iOS and desktop:** not part of this build.

## Release signing

The release keystore is `/home/user/tools/keystores/smart-release.keystore` (outside the repo; its password file is `chmod 600`). It is a separate key from the game's keystore. Losing it means a new key and a reinstall for anyone who already has the app.
