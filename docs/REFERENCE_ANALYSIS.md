# S Mart — Reference Analysis of the BigMart Android APK

Scope: the uploaded file `BigMart_1.06_APKPure.apk` (4,030,612 bytes) was inspected statically as a **UI/UX reference only** for the original S Mart product. The app was never installed or run, its backend was never contacted, and no credential was used. No code, assets, strings or branding were copied; only identifying names and structural facts are recorded here.

Labels: **[observed]** = read directly from the APK (manifest, resources, class/layout inventory). **[inferred]** = reasoned from names and structure, not confirmed by running the app.

Tools used: `unzip -t`, a Python venv with `androguard` (in `/home/user/tools/smart_ref`, outside the repo), and the globally installed `rea-agents` v6.8.0 (read-only: `--help` and `capabilities` only; `setup` was not run). REA's providers listed by `capabilities` are native/desktop-oriented (macOS native inspection etc.); no Android-specific analysis was run through REA. All Android decoding below was done with androguard.

## 1. Integrity and identity

| Item | Value | Label |
|---|---|---|
| ZIP integrity (`unzip -tq`) | "No errors detected in compressed data" | observed |
| Valid APK structure | AndroidManifest.xml, classes.dex, resources.arsc, META-INF signature files present | observed |
| Package name | `com.ekbana.bigmart` | observed |
| App label | "BigMart" | observed |
| Version | 1.06 (versionCode 161) | observed |
| minSdk / targetSdk | 15 (Android 4.0.3) / 22 (Android 5.1) | observed |
| Build date | file timestamps inside the APK read 4 July 2016 | observed (zip timestamps) |
| Signing | legacy v1 JAR signature (META-INF CERT.RSA / CERT.SF) | observed |
| Developer/vendor | package prefix `ekbana`; the in-app footer text says "Powered by EK…" | observed (name only) |
| Business | a Nepal supermarket chain (BigMart / "Megamart" in a copyright string) with a loyalty-and-online-shopping app | inferred from strings/labels |

Consequence: this is a **2016-era app** (Android 4–5 design language: ActionBar/Toolbar, navigation drawer, support-library v7, no Material Components, no Jetpack). It is useful for the *feature list and flows* of a grocery/loyalty app, not as a design benchmark for 2026. S Mart should follow current Android and web practice instead.

## 2. Framework

* **Native Android, Java, support-library UI** — observed: `classes.dex` of 3.1 MB with 4,432 classes, 460 of them under `com.ekbana.bigmart`; layouts use `android.support.v7.widget.RecyclerView`, `SwipeRefreshLayout`, `CoordinatorLayout`, `FloatingActionButton`, `ViewPager`-style tabs, `ListView`/`GridView`.
* **Not Flutter, not React Native, not Cordova/Ionic, not Unity**: no `lib/` native libraries, no `assets/www`, no JS bundle, no `libflutter`/Hermes — observed.
* **Not a thin WebView wrapper** — observed: there is no WebView activity in the manifest and the screens are native layouts (RecyclerView lists, native maps, native barcode scanner). The `WebView` class name appears once in the DEX string table, which is inferred to come from an SDK (ads/Facebook), not an app screen.
* **Server-driven data, native UI** — inferred: screen content (products, promotions, vouchers, orders, bills) is loaded from a JSON REST API; the UI itself is compiled in.
* **Code is ProGuard/R8-obfuscated** — observed: most app classes have names like `a`, `b`, `Fragments/cz`, so the fragment-to-screen mapping and per-screen logic are **not** recoverable by names; only the layout names (which survive) and the manifest are reliable.
* Third-party libraries (observed from package inventory/manifest): Google Play Services (Maps, Analytics, Tag Manager, GCM push, Sign-In, AdMob SDK), Facebook SDK (login/share/messenger button), ZXing barcode scanner (`journeyapps`), MPAndroidChart (`mikephil`, pie charts), an image cropper (`edmodo`), AndroidQuery (image/network helper), legacy Apache HTTP client.

## 3. Permissions (observed)

INTERNET, ACCESS_NETWORK_STATE, ACCESS_WIFI_STATE, ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION, CAMERA, CALL_PHONE, READ_PHONE_STATE, GET_ACCOUNTS, USE_CREDENTIALS, WAKE_LOCK, WRITE_EXTERNAL_STORAGE, GCM receive (`C2D_MESSAGE`, `c2dm.permission.RECEIVE`), maps receive.
Declared hardware features: camera (autofocus, flash, front), GPS location, telephony, Wi-Fi, landscape screen.
Reading: camera → barcode scan; location → nearest store map; CALL_PHONE → tap-to-call a store (inferred); storage → cached images/profile photo crop (inferred). Several of these (READ_PHONE_STATE, GET_ACCOUNTS, USE_CREDENTIALS) are broad and would not be requested by a modern app. **S Mart should request only camera (optional, barcode) and location (optional, store/delivery) at the moment of use.**

## 4. Screen inventory

### 4.1 Manifest activities (observed; 12 declared, 7 are the app's own)

| Activity | Role | Label |
|---|---|---|
| `SplashScreenActivity` (launcher) | splash with animated logo view and a button (menu present) | observed |
| `LoggedActivity` | main shell: toolbar + navigation drawer + a fragment container; hosts almost all screens as fragments | observed (layout: view + fragment + include) / inferred (role) |
| `PromoActivity` | promotions / promotion detail | observed name; inferred role |
| `FilterActivity` | product search/filter form (spinner + scroll form, filter menu) | observed |
| `Checkout.CheckoutActivity` | cart/checkout shell | observed |
| `BarcodeActivity` + `custom_views.CaptureActivityBarcodeScanner` | barcode product lookup (camera) | observed |
| Library screens: AdActivity, InAppPurchaseActivity, SignInHubActivity, FacebookActivity, journeyapps `CaptureActivity` | SDK screens, not app design | observed |

### 4.2 Fragment-level screens recovered from layout names (observed names; function inferred)

Home (`fragment_home`, `home`), Trending (`fragment_trending`), Brand listing (`fragment_brand`), Product detail (`fragment_product_detail`, `…_viewpager`), Promotions (`fragment_promo`, `promotion_offer_layout`, `promo_detail_lv`), Checkout/cart (`fragment_checkout`, `checkout_list_view`, `checkout_bottom`), Place order (`fragment_placeorder`, with a spinner, text field and button) and Order success (`fragment_placeorder_success`), My Orders (`fragment_order_list`), Order detail (`fragment_order_detail`, `order_status_popup`), My Bills/history (`fragment_history`, `history_table_layout`), My Purchases / expense chart (`fragment_history_piechart`, `fragment_pager_pie`, `expense_top`), My Vouchers (`fragment_voucher`, `fragment_voucher_details`, `voucher_calculation_popup`), My Favourites (`layout_favourite`, `favourite_top`), Sign in (`fragment_signin`), Get PIN (`fragment_get_pin`), Change PIN (`fragment_change_pin`), Edit profile with photo crop (`fragment_edit_profile`, `layout_edit_profile_cropimage`), Feedback (`fragment_feedback`), About (`fragment_aboutus`), Store locator map (`fragment_googlemap`, `marker_info_box`), Barcode (`fragment_barcode`), a "no data" empty state (`layout_no_data`), a date/time picker (`date_time_picker`).
Total ≈ 21 fragment screens + 7 own activities ≈ **28 distinct screens** (observed layout names; some are partial layouts included in others).
Layout inventory: 138 layouts in `res/layout`, 17 in `layout-v17`, 5 in `layout-sw600dp` (a small amount of tablet adaptation — observed); 26 animation resources; 161 density-split drawables across mdpi–xxxhdpi (observed).

## 5. Navigation graph (as far as recoverable)

* Observed: Splash → `LoggedActivity` (single-activity-plus-fragments pattern); a navigation drawer layout (`navigation_layout`) with ~20 text rows and 11 icons; menu resources for the shell include search and a grid/list toggle; checkout and filter are separate activities.
* Inferred drawer entries from string resources (observed strings, mapping inferred): Home, Online Shopping, My Orders, My Bills, My Purchases (spending pie chart), My Vouchers, My Favourites, Promotions, Locate store, Feedback, About, Sign out / profile.
* Inferred main flow: Splash → Home (feed with promotions and categories/brands) → Trending/Brand lists → Product detail (image pager + FAB add-to-cart) → Cart (Checkout activity) → Place order (pick an option, enter a note/value, confirm) → Success → My Orders → Order detail with a status popup.
* Inferred secondary flows: Sign in with membership/mobile number + PIN (strings `MembershipMobileNumber`, `PinNumber`, screens Get PIN / Change PIN) → loyalty features (bills, vouchers, purchase analytics). Barcode scan → product lookup. Filter → results.
* **Not recoverable:** exact fragment transitions, back-stack rules, conditional branches (e.g. what is guest-visible), because logic classes are obfuscated and the app was not run.

## 6. Network and API shape

* Observed: a single versioned REST base URL in the string resources — host `bigmartnepal.com`, path `/crm/api/v2/` (HTTPS). Responses are parsed as JSON (JSONObject/JSONArray usage). Push uses the legacy Google Cloud Messaging (GCM) service classes. Analytics via Google Analytics + Tag Manager container resource (`gtm_analytics`).
* Observed: a local SQLite table caching store locations (name suggests an address-keyed JSON blob per store).
* Observed: the APK ships a **static API key string in its resources**. It is deliberately **not reproduced here and was not used**. Inferred lesson: a client-embedded key is not a secret and gives no per-user security.
* Inferred (from "Orders / Bills / Vouchers / Profile / PIN"): the API is CRM/loyalty-centric (customer identified by membership/mobile number + PIN) with an order-placement endpoint added for online shopping. **Specific endpoint paths, request/response schemas, auth tokens and error formats are not recoverable** without running the app or intercepting traffic, which was out of scope.

## 7. Feature list

| Feature | Present? | Label |
|---|---|---|
| Home feed (promotions/featured) | yes | observed (layout) |
| Categories / brands browsing | brands yes; categories inferred via filter | observed / inferred |
| Product list as grid/list, search and filter | yes | observed |
| Barcode scan to find a product | yes | observed |
| Product detail with image pager, add-to-cart | yes | observed / inferred |
| Trending products | yes | observed |
| Cart and checkout | yes | observed |
| Place order + order success | yes | observed |
| Order history and order detail with status | yes | observed |
| Bills / purchase history and spending pie charts | yes | observed |
| Vouchers (view, details, calculation popup) | yes | observed |
| Favourites (wishlist) | yes | observed |
| Auth: membership/mobile + PIN, plus Facebook login SDK present | yes | observed (SDK), inferred (flow) |
| Profile edit incl. photo crop | yes | observed |
| Store locator map with info popups | yes | observed |
| Push notifications | yes (GCM) | observed |
| Feedback form, About page | yes | observed |
| Online payment gateway | **no evidence** (no payment SDK; order flow appears to be pay-on-delivery/at-store) | inferred, not confirmed |
| Admin features | none (customer app only) | observed |
| Real-time order tracking | only a status popup/detail; no live tracking evidence | inferred |
| Wallet, referral, reviews, returns/refunds, support tickets | no evidence | inferred |

## 8. UX patterns (generic, observed or inferred)

* Drawer navigation with many entries (observed) — heavy on mobile; a bottom tab bar is the 2026 norm.
* Pull-to-refresh on lists (SwipeRefreshLayout, observed).
* Grid/list toggle for product lists (menu item, observed).
* Persistent floating action button on product screens (observed) for add-to-cart.
* Bottom summary bar in checkout (`checkout_bottom`, observed).
* Explicit empty-state layout (`layout_no_data`, observed).
* Dialog/popups for order status and voucher calculation (observed).
* Sliding tab strips for sections (observed).
* Customers' spending analysed with pie charts (observed) — an unusual differentiator worth considering as "spending insights".
* Weak points worth fixing in S Mart (inferred from structure): very broad permission list, drawer-only navigation, tiny tablet support, no search suggestions evidence, no accessibility-labelled design system visible, embedded API key, GCM-era push.

## 9. What was NOT recoverable

* Visual design as rendered (not run, no screenshots) — colours/typography exist in resources but were not reproduced, deliberately.
* Fragment/class-level logic and exact navigation (obfuscated).
* Endpoint paths, payload schemas, pricing/discount rules, delivery-fee logic, order status vocabulary, voucher rules.
* Whether online payments exist, and server-side behaviours (stock, tracking).
* Behaviour on a real device (not tested; no device or emulator used).
* Current (post-2016) versions of the app.

## 10. Implications for S Mart

S Mart is an **original** product: its own name, mark, palette, typography, copy, data model and code. Nothing from BigMart's branding, strings, drawables, layouts or API is reused. What the analysis legitimately supports is a checklist of *generic shopping features and patterns*, expressed in S Mart's own terms:

Generic patterns to implement (own wording and design):
1. Bottom-tab shell (Home, Categories, Search, Cart, Account) instead of a drawer; the account area holds orders, wishlist, addresses, payments, notifications, support.
2. Home with banners/offers set by the admin, a "new" shelf, a "popular" shelf driven by real order counts, and category entry points.
3. Category and brand browsing, product lists with grid/list toggle, sort and filter, text search with recent queries; optional barcode lookup behind an explicit camera permission.
4. Product detail with an image gallery, variant selector, stock state, price/discount shown honestly, add to cart, wishlist heart.
5. Cart with quantity edit, coupon entry, a sticky totals bar; totals calculated on the server only.
6. Checkout: address selection or entry, delivery option, payment method (Cash on Delivery working first; gateways behind a provider interface), idempotent place-order, success screen.
7. Orders: history, order detail, a status timeline updated live (SSE), cancellation of eligible orders, returns/refunds with a request flow.
8. Account: register/login with email or phone + password (argon2 on the server, rotating refresh tokens); profile edit; address book; notification centre; support tickets.
9. Spending insights (a monthly spend chart) as an optional later feature, designed independently.
10. Empty, loading (skeleton) and error states on every list; pull-to-refresh; tablet two-pane layouts.
11. Privacy by design: no embedded secrets in clients, minimal permissions requested just-in-time, no analytics SDKs by default.
12. Store locator is optional and only makes sense if S Mart has physical stores (a product decision for Nabin); do not build it by default.

Design/branding must differ: no use of BigMart's name, colours, icons, drawer structure, copy or flows verbatim. S Mart's identity is defined in `docs/DESIGN.md`.
