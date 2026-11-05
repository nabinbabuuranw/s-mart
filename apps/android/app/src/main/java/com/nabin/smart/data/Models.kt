package com.nabin.smart.data

import org.json.JSONObject

data class Category(val id: String, val slug: String, val name: String, val imageUrl: String?)

data class Variant(
    val id: String,
    val sku: String,
    val name: String,
    val price: Long,
    val listPrice: Long,
    val offerTitle: String?,
    val available: Boolean,
    val lowStock: Boolean,
)

data class Product(
    val id: String,
    val slug: String,
    val name: String,
    val brand: String?,
    val description: String,
    val imageUrls: List<String>,
    val variants: List<Variant>,
    val priceFrom: Long,
    val onOffer: Boolean,
    val featured: Boolean,
    val categoryName: String?,
    val categorySlug: String?,
) {
    val firstImage: String? get() = imageUrls.firstOrNull()
    val anyAvailable: Boolean get() = variants.any { it.available }
}

data class ProductPage(val items: List<Product>, val total: Int, val page: Int, val pageSize: Int)

data class Banner(val id: String, val title: String, val subtitle: String?, val imageUrl: String?, val linkUrl: String?)

data class CartLine(
    val id: String,
    val variantId: String,
    val slug: String,
    val name: String,
    val variantName: String,
    val image: String?,
    val quantity: Int,
    val unitPrice: Long,
    val listPrice: Long,
    val offerTitle: String?,
    val lineTotal: Long,
    val available: Boolean,
    val stock: Int?,
)

data class Cart(
    val lines: List<CartLine>,
    val subtotal: Long,
    val discountTotal: Long,
    val couponDiscount: Long,
    val shippingFee: Long,
    val taxTotal: Long,
    val total: Long,
)

data class Address(
    val id: String,
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
    fun oneLine(): String = listOfNotNull(line1, line2, city, district, province).filter { it.isNotBlank() }.joinToString(", ")
}

data class PaymentMethod(val id: String, val label: String, val enabled: Boolean)

data class OrderSummary(
    val id: String,
    val number: String,
    val status: String,
    val paymentMethod: String,
    val paymentStatus: String,
    val total: Long,
    val placedAt: String,
    val itemsText: String,
)

data class OrderLine(val name: String, val variantName: String, val quantity: Int, val unitPrice: Long, val lineTotal: Long)
data class OrderEvent(val status: String, val note: String?, val createdAt: String)
data class Shipment(val carrier: String, val trackingNumber: String?, val status: String, val shippedAt: String)

data class OrderDetail(
    val id: String,
    val number: String,
    val status: String,
    val paymentMethod: String,
    val paymentStatus: String,
    val subtotal: Long,
    val discountTotal: Long,
    val couponDiscount: Long,
    val shippingFee: Long,
    val taxTotal: Long,
    val total: Long,
    val placedAt: String,
    val note: String?,
    val items: List<OrderLine>,
    val events: List<OrderEvent>,
    val shipments: List<Shipment>,
)

data class OrderPage(val items: List<OrderSummary>, val total: Int)

data class AuthUser(val id: String, val email: String, val name: String, val role: String)

data class Profile(val id: String, val email: String, val name: String, val phone: String?)

data class AuthSession(val accessToken: String, val refreshToken: String, val user: AuthUser)

// ---- parsers (pure; covered by unit tests) ----

internal fun JSONObject.toCategory() = Category(
    id = str("id"), slug = str("slug"), name = str("name"), imageUrl = strOrNull("imageUrl"),
)

internal fun JSONObject.toVariant() = Variant(
    id = str("id"),
    sku = str("sku"),
    name = str("name"),
    price = long("price"),
    listPrice = long("listPrice"),
    offerTitle = optJSONObject("offer")?.strOrNull("title"),
    available = bool("available"),
    lowStock = bool("lowStock"),
)

internal fun JSONObject.toProduct(): Product {
    val variants = objects("variants").map { it.toVariant() }
    return Product(
        id = str("id"),
        slug = str("slug"),
        name = str("name"),
        brand = strOrNull("brand"),
        description = str("description"),
        imageUrls = objects("images").mapNotNull { it.strOrNull("url") },
        variants = variants,
        priceFrom = long("priceFrom"),
        onOffer = bool("onOffer"),
        featured = bool("featured"),
        categoryName = optJSONObject("category")?.strOrNull("name"),
        categorySlug = optJSONObject("category")?.strOrNull("slug"),
    )
}

internal fun JSONObject.toCartLine() = CartLine(
    id = str("id"),
    variantId = str("variantId"),
    slug = str("slug"),
    name = str("name"),
    variantName = str("variantName"),
    image = strOrNull("image"),
    quantity = int("quantity"),
    unitPrice = long("unitPrice"),
    listPrice = long("listPrice"),
    offerTitle = strOrNull("offerTitle"),
    lineTotal = long("lineTotal"),
    available = bool("available"),
    stock = intOrNull("stock"),
)

internal fun JSONObject.toCart() = Cart(
    lines = objects("items").map { it.toCartLine() },
    subtotal = long("subtotal"),
    discountTotal = long("discountTotal"),
    couponDiscount = long("couponDiscount"),
    shippingFee = long("shippingFee"),
    taxTotal = long("taxTotal"),
    total = long("total"),
)

internal fun JSONObject.toAddress() = Address(
    id = str("id"),
    label = str("label"),
    fullName = str("fullName"),
    phone = str("phone"),
    line1 = str("line1"),
    line2 = strOrNull("line2"),
    city = str("city"),
    district = strOrNull("district"),
    province = strOrNull("province"),
    postalCode = strOrNull("postalCode"),
    isDefault = bool("isDefault"),
)

internal fun JSONObject.toOrderSummary(): OrderSummary {
    val items = objects("items")
    val itemsText = items.joinToString(", ") { "${it.str("name")} x${it.int("quantity")}" }
    return OrderSummary(
        id = str("id"),
        number = str("number"),
        status = str("status"),
        paymentMethod = str("paymentMethod"),
        paymentStatus = str("paymentStatus"),
        total = long("total"),
        placedAt = str("placedAt").ifEmpty { str("createdAt") },
        itemsText = itemsText,
    )
}

internal fun JSONObject.toOrderDetail() = OrderDetail(
    id = str("id"),
    number = str("number"),
    status = str("status"),
    paymentMethod = str("paymentMethod"),
    paymentStatus = str("paymentStatus"),
    subtotal = long("subtotal"),
    discountTotal = long("discountTotal"),
    couponDiscount = long("couponDiscount"),
    shippingFee = long("shippingFee"),
    taxTotal = long("taxTotal"),
    total = long("total"),
    placedAt = str("placedAt"),
    note = strOrNull("note"),
    items = objects("items").map {
        OrderLine(it.str("name"), it.str("variantName"), it.int("quantity"), it.long("unitPrice"), it.long("lineTotal"))
    },
    events = objects("events").map { OrderEvent(it.str("status"), it.strOrNull("note"), it.str("createdAt")) },
    shipments = objects("shipments").map {
        Shipment(it.str("carrier"), it.strOrNull("trackingNumber"), it.str("status"), it.str("shippedAt"))
    },
)

internal fun JSONObject.toAuthSession(): AuthSession {
    val u = getJSONObject("user")
    return AuthSession(
        accessToken = str("accessToken"),
        refreshToken = str("refreshToken"),
        user = AuthUser(u.str("id"), u.str("email"), u.str("name"), u.str("role")),
    )
}

internal fun JSONObject.toProfile() = Profile(str("id"), str("email"), str("name"), strOrNull("phone"))
