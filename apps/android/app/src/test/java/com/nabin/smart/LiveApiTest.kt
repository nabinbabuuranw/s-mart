package com.nabin.smart

import com.nabin.smart.data.ApiClient
import com.nabin.smart.data.ApiException
import com.nabin.smart.data.AddressDraft
import com.nabin.smart.data.ProductQuery
import com.nabin.smart.data.ShopRepository
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.util.UUID

/**
 * Runs the app's real repository against a live S Mart API. Skipped unless SMART_LIVE_API is set,
 * e.g. SMART_LIVE_API=http://localhost:4100/api/v1 (a local test database with DEMO data).
 */
class LiveApiTest {
    private val liveBase: String? = System.getenv("SMART_LIVE_API")

    private fun repo(store: MemoryTokenStore = MemoryTokenStore()) = ShopRepository(ApiClient(liveBase!!), store)

    @Test fun catalogueSignUpCartCheckoutAndOrders() = runBlocking {
        assumeTrue("SMART_LIVE_API not set", liveBase != null)
        val store = MemoryTokenStore()
        val shop = repo(store)

        // Catalogue (public)
        val categories = shop.categories()
        assertTrue("categories from DEMO seed", categories.isNotEmpty())
        val page = shop.products(ProductQuery(pageSize = 50))
        assertTrue("products from DEMO seed", page.items.isNotEmpty())
        val withStock = page.items.first { it.variants.any { v -> v.available } }
        val detail = shop.product(withStock.slug)
        assertEquals(withStock.id, detail.id)
        val variant = detail.variants.first { it.available }

        // Filters reach the API
        val cheap = shop.products(ProductQuery(band = com.nabin.smart.data.PriceBand.UNDER_500, pageSize = 50))
        assertTrue(cheap.items.all { p -> p.variants.any { it.price <= 50_000 } })
        val payments = shop.paymentMethods()
        assertTrue("COD enabled", payments.any { it.id == "cod" && it.enabled })
        assertTrue("other methods listed as not enabled", payments.filter { it.id != "cod" }.all { !it.enabled })

        // Sign up a fresh customer, then sign in with the same password
        val tag = UUID.randomUUID().toString().take(8)
        val email = "m2-app-$tag@example.com"
        val password = "AppTest-$tag-2026"
        val signedUp = shop.register("M2 App Test $tag", email, password, "9800000000")
        assertEquals("customer", signedUp.user.role)
        assertNotNull(store.accessToken)
        shop.logout()
        assertEquals(null, store.accessToken)
        val loggedIn = shop.login(email, password)
        assertEquals(email, loggedIn.user.email)

        // Wrong password is a clean refusal, not a crash
        val wrong = try { shop.login(email, "wrong-password-xyz"); null } catch (e: ApiException) { e }
        assertNotNull(wrong)
        assertEquals(401, wrong!!.status)

        // Profile
        val profile = shop.profile()
        assertEquals(email, profile.email)
        val renamed = shop.updateProfile("M2 App Renamed $tag", "9800000001")
        assertEquals("M2 App Renamed $tag", renamed.name)

        // Cart: add, change, remove
        val afterAdd = shop.addToCart(variant.id, 2)
        assertEquals(1, afterAdd.lines.size)
        assertEquals(2, afterAdd.lines[0].quantity)
        val afterSet = shop.setCartQuantity(variant.id, 3)
        assertEquals(3, afterSet.lines[0].quantity)
        assertTrue(afterSet.total > 0)
        val afterSet1 = shop.setCartQuantity(variant.id, 1)
        assertEquals(1, afterSet1.lines[0].quantity)

        // Wishlist
        shop.addToWishlist(withStock.id)
        assertTrue(shop.wishlist().any { it.id == withStock.id })
        shop.removeFromWishlist(withStock.id)
        assertFalse(shop.wishlist().any { it.id == withStock.id })

        // Addresses
        val address = shop.addAddress(AddressDraft("Home", "M2 App Test", "9800000000", "Baneshwor 4", null, "Kathmandu", null, "Bagmati", null, true))
        assertTrue(shop.addresses().any { it.id == address.id })

        // Checkout with one idempotency key; a retry with the same key must not create a second order
        val key = "app-test-" + UUID.randomUUID()
        val order = shop.checkout(address.id, key, null, "M2 live test")
        assertTrue(order.number.startsWith("SM-"))
        val retry = shop.checkout(address.id, key, null, "M2 live test")
        assertEquals(order.id, retry.id)

        // Orders, detail, cancel (only placed/confirmed orders can be cancelled)
        val orders = shop.orders()
        assertTrue(orders.items.any { it.id == order.id })
        val detailOrder = shop.order(order.id)
        assertEquals("placed", detailOrder.status)
        assertEquals("cod", detailOrder.paymentMethod)
        assertTrue(detailOrder.items.isNotEmpty())
        val cancelled = shop.cancelOrder(order.id, "test cancel")
        assertEquals("cancelled", cancelled.status)

        shop.logout()
    }

    @Test fun expiredAccessTokenRefreshesOnce() = runBlocking {
        assumeTrue("SMART_LIVE_API not set", liveBase != null)
        val store = MemoryTokenStore()
        val shop = repo(store)
        val tag = UUID.randomUUID().toString().take(8)
        shop.register("M2 Refresh $tag", "m2-refresh-$tag@example.com", "Refresh-$tag-2026", null)
        // Corrupt the access token: the next authed call gets 401, refreshes with the stored refresh token, retries.
        store.updateTokens("not-a-real-token", store.refreshToken!!)
        val cart = shop.cart()
        assertNotNull(cart)
        assertTrue("refresh rotated the access token", store.accessToken != "not-a-real-token")
        // A broken refresh token ends the session and signals it.
        store.updateTokens("not-a-real-token", "not-a-real-refresh-token-value-0000")
        val failed = try { shop.cart(); null } catch (e: ApiException) { e }
        assertNotNull(failed)
        assertEquals(401, failed!!.status)
        assertEquals(null, store.accessToken)
    }
}
