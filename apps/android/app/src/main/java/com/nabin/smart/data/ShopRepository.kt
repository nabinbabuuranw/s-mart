package com.nabin.smart.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject

/**
 * Every network call the app makes. Catalogue calls are public; the /me routes and /checkout need the bearer token.
 * A 401 on an authenticated call refreshes the access token once (rotating refresh token) and retries once.
 */
class ShopRepository(private val api: ApiClient, private val session: TokenStore) {

    val imageOrigin: String get() = api.originOf()

    private val _sessionEnded = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    /** Emits once when the refresh token is no longer accepted: the user must sign in again. */
    val sessionEnded: SharedFlow<Unit> = _sessionEnded.asSharedFlow()

    fun signedInUser(): AuthUser? = session.signedInUser()

    // ---------- transport ----------

    private suspend fun raw(
        method: String,
        path: String,
        body: JSONObject? = null,
        query: Map<String, String> = emptyMap(),
        idempotencyKey: String? = null,
        authed: Boolean = false,
    ): String = withContext(Dispatchers.IO) {
        var token = if (authed) session.accessToken else null
        var result = api.call(method, path, body, token, idempotencyKey, query)
        if (authed && result.status == 401 && session.refreshToken != null) {
            if (refreshSession()) {
                token = session.accessToken
                result = api.call(method, path, body, token, idempotencyKey, query)
            } else {
                session.clear()
                _sessionEnded.tryEmit(Unit)
                throw ApiException(401, "session_expired", "Your session has ended. Please sign in again.")
            }
        }
        if (result.status !in 200..299) throw parseApiError(result.status, result.body)
        result.body
    }

    private fun refreshSession(): Boolean {
        val refresh = session.refreshToken ?: return false
        return try {
            val res = api.call("POST", "/auth/refresh", JSONObject().put("refreshToken", refresh))
            if (res.status !in 200..299) return false
            val json = JSONObject(res.body)
            val access = json.optString("accessToken", "")
            val newRefresh = json.optString("refreshToken", "")
            if (access.isEmpty() || newRefresh.isEmpty()) return false
            session.updateTokens(access, newRefresh)
            true
        } catch (e: Exception) {
            false
        }
    }

    private suspend fun json(
        method: String,
        path: String,
        body: JSONObject? = null,
        query: Map<String, String> = emptyMap(),
        idempotencyKey: String? = null,
        authed: Boolean = false,
    ): JSONObject = JSONObject(raw(method, path, body, query, idempotencyKey, authed))

    private suspend fun jsonArray(
        method: String,
        path: String,
        query: Map<String, String> = emptyMap(),
        authed: Boolean = false,
    ): JSONArray = JSONArray(raw(method, path, null, query, null, authed))

    // ---------- auth ----------

    suspend fun login(email: String, password: String): AuthSession {
        val body = JSONObject().put("email", email.trim().lowercase()).put("password", password).put("audience", "customer")
        val session = json("POST", "/auth/login", body).toAuthSession()
        this.session.save(session)
        return session
    }

    suspend fun register(name: String, email: String, password: String, phone: String?): AuthSession {
        val body = JSONObject().put("name", name.trim()).put("email", email.trim().lowercase()).put("password", password)
        if (!phone.isNullOrBlank()) body.put("phone", phone.trim())
        val session = json("POST", "/auth/register", body).toAuthSession()
        this.session.save(session)
        return session
    }

    suspend fun logout() {
        val refresh = session.refreshToken
        if (refresh != null) {
            try {
                raw("POST", "/auth/logout", JSONObject().put("refreshToken", refresh))
            } catch (e: ApiException) {
                // Local sign-out still happens below; the server session expires on its own.
            }
        }
        session.clear()
    }

    suspend fun profile(): Profile = json("GET", "/me/profile", authed = true).toProfile()

    suspend fun updateProfile(name: String, phone: String?): Profile {
        val body = JSONObject().put("name", name.trim())
        body.put("phone", if (phone.isNullOrBlank()) JSONObject.NULL else phone.trim())
        return json("PATCH", "/me/profile", body, authed = true).toProfile()
    }

    // ---------- catalogue (public) ----------

    suspend fun categories(): List<Category> = jsonArray("GET", "/catalog/categories").objects().map { it.toCategory() }

    suspend fun banners(): List<Banner> = jsonArray("GET", "/catalog/banners", mapOf("placement" to "home_hero"))
        .objects().map {
            Banner(it.str("id"), it.str("title"), it.strOrNull("subtitle"), it.strOrNull("imageUrl"), it.strOrNull("linkUrl"))
        }

    suspend fun products(query: ProductQuery): ProductPage {
        val json = json("GET", "/catalog/products", query = query.toParams())
        return ProductPage(
            items = json.objects("items").map { it.toProduct() },
            total = json.int("total"),
            page = json.int("page"),
            pageSize = json.int("pageSize"),
        )
    }

    suspend fun product(slug: String): Product = json("GET", "/catalog/products/$slug").toProduct()

    suspend fun paymentMethods(): List<PaymentMethod> = jsonArray("GET", "/payment-methods").objects().map {
        PaymentMethod(it.str("id"), it.str("label"), it.bool("enabled"))
    }

    // ---------- cart (customer) ----------

    suspend fun cart(): Cart = json("GET", "/me/cart", authed = true).toCart()

    suspend fun addToCart(variantId: String, quantity: Int): Cart =
        json("POST", "/me/cart/items", JSONObject().put("variantId", variantId).put("quantity", quantity), authed = true).toCart()

    /** quantity 0 removes the line. */
    suspend fun setCartQuantity(variantId: String, quantity: Int): Cart =
        json("PUT", "/me/cart/items/$variantId", JSONObject().put("quantity", quantity), authed = true).toCart()

    // ---------- wishlist (customer) ----------

    suspend fun wishlist(): List<Product> = jsonArray("GET", "/me/wishlist", authed = true).objects().map { it.toProduct() }

    suspend fun addToWishlist(productId: String) { raw("PUT", "/me/wishlist/$productId", authed = true) }

    suspend fun removeFromWishlist(productId: String) { raw("DELETE", "/me/wishlist/$productId", authed = true) }

    // ---------- addresses (customer) ----------

    suspend fun addresses(): List<Address> = jsonArray("GET", "/me/addresses", authed = true).objects().map { it.toAddress() }

    suspend fun addAddress(draft: AddressDraft): Address =
        json("POST", "/me/addresses", draft.toJson(), authed = true).toAddress()

    suspend fun deleteAddress(id: String) { raw("DELETE", "/me/addresses/$id", authed = true) }

    // ---------- checkout and orders (customer) ----------

    /** One Idempotency-Key per checkout attempt: the caller reuses the same key when retrying. */
    suspend fun checkout(addressId: String, idempotencyKey: String, couponCode: String?, note: String?): OrderSummary {
        val body = JSONObject().put("addressId", addressId).put("paymentMethod", "cod")
        if (!couponCode.isNullOrBlank()) body.put("couponCode", couponCode.trim().uppercase())
        if (!note.isNullOrBlank()) body.put("note", note.trim())
        return json("POST", "/checkout", body, idempotencyKey = idempotencyKey, authed = true).toOrderSummary()
    }

    suspend fun orders(page: Int = 1): OrderPage {
        val json = json("GET", "/me/orders", query = mapOf("page" to page.toString(), "pageSize" to "20"), authed = true)
        return OrderPage(json.objects("items").map { it.toOrderSummary() }, json.int("total"))
    }

    suspend fun order(id: String): OrderDetail = json("GET", "/me/orders/$id", authed = true).toOrderDetail()

    suspend fun cancelOrder(id: String, reason: String?): OrderDetail {
        val body = JSONObject()
        if (!reason.isNullOrBlank()) body.put("reason", reason.trim())
        return json("POST", "/me/orders/$id/cancel", body, authed = true).toOrderDetail()
    }
}

/** An address as the form collects it. Field names and limits match the API's addressSchema. */
data class AddressDraft(
    val label: String,
    val fullName: String,
    val phone: String,
    val line1: String,
    val line2: String?,
    val city: String,
    val district: String?,
    val province: String?,
    val postalCode: String?,
    val isDefault: Boolean,
) {
    fun toJson(): JSONObject = JSONObject()
        .put("label", label.trim().ifEmpty { "Home" })
        .put("fullName", fullName.trim())
        .put("phone", phone.trim())
        .put("line1", line1.trim())
        .put("line2", line2?.trim()?.ifEmpty { null } ?: JSONObject.NULL)
        .put("city", city.trim())
        .put("district", district?.trim()?.ifEmpty { null } ?: JSONObject.NULL)
        .put("province", province?.trim()?.ifEmpty { null } ?: JSONObject.NULL)
        .put("postalCode", postalCode?.trim()?.ifEmpty { null } ?: JSONObject.NULL)
        .put("isDefault", isDefault)
}
