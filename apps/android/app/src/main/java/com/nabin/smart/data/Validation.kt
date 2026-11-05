package com.nabin.smart.data

/** Same rules the API enforces (packages/shared/src/schemas.ts), so the app catches mistakes before a round trip. */
object Validation {
    private val PHONE = Regex("^[0-9+\\-\\s()]{7,20}$")
    private val EMAIL = Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")

    fun isEmail(value: String): Boolean = value.trim().length <= 200 && EMAIL.matches(value.trim())

    fun isPhone(value: String): Boolean = PHONE.matches(value.trim())

    /** Registration requires a 10+ character password (API: min 10). */
    fun isNewPassword(value: String): Boolean = value.length in 10..200

    fun nonBlank(value: String, max: Int): Boolean = value.trim().let { it.isNotEmpty() && it.length <= max }

    /** Returns the first problem with an address form, or null when the address can be sent. */
    fun addressProblem(fullName: String, phone: String, line1: String, city: String): String? = when {
        !nonBlank(fullName, 120) -> "Add the name the order should be delivered to."
        !isPhone(phone) -> "Enter a valid phone number (7 to 20 digits, spaces, + or -)."
        !nonBlank(line1, 200) -> "Add the street address or area."
        !nonBlank(city, 80) -> "Add the city."
        else -> null
    }
}

/** Price bands in paisa (the API's money unit): the same bands the web filter offers. */
enum class PriceBand(val label: String, val min: Long?, val max: Long?) {
    ANY("Any price", null, null),
    UNDER_500("Under Rs. 500", null, 50_000),
    FROM_500_TO_2000("Rs. 500 to 2,000", 50_000, 200_000),
    OVER_2000("Over Rs. 2,000", 200_000, null),
}

enum class SortOrder(val apiValue: String, val label: String) {
    NEWEST("newest", "Newest"),
    PRICE_ASC("price_asc", "Price: low to high"),
    PRICE_DESC("price_desc", "Price: high to low"),
    NAME("name", "Name"),
}

data class ProductQuery(
    val q: String = "",
    val categorySlug: String? = null,
    val band: PriceBand = PriceBand.ANY,
    val sort: SortOrder = SortOrder.NEWEST,
    val page: Int = 1,
    val pageSize: Int = 20,
    val onOffer: Boolean = false,
    val featured: Boolean = false,
) {
    /** Query string parameters exactly as the catalogue endpoint names them. */
    fun toParams(): Map<String, String> {
        val out = linkedMapOf("page" to page.toString(), "pageSize" to pageSize.toString(), "sort" to sort.apiValue)
        if (q.isNotBlank()) out["q"] = q.trim()
        categorySlug?.let { out["category"] = it }
        band.min?.let { out["minPrice"] = it.toString() }
        band.max?.let { out["maxPrice"] = it.toString() }
        if (onOffer) out["onOffer"] = "true"
        if (featured) out["featured"] = "true"
        return out
    }
}
