package com.nabin.smart.ui.search

import com.nabin.smart.data.Product

/**
 * Search suggestions for the Home search field. The candidates come from the catalogue API
 * (`/catalog/products?q=`), never from a made-up list; this only orders them for the typed text.
 *
 * Ranking, best first: the name starts with the query, a word in the name starts with it,
 * the brand or category contains it, the name or description contains it. Ties keep the API's order.
 */
object SearchSuggestions {
    const val MIN_CHARS = 2

    fun normalize(text: String): String = text.trim().lowercase().replace(Regex("\\s+"), " ")

    fun shouldSearch(text: String): Boolean = normalize(text).length >= MIN_CHARS

    fun rank(text: String, candidates: List<Product>, limit: Int = 6): List<Product> {
        val q = normalize(text)
        if (q.length < MIN_CHARS) return emptyList()
        val scored = candidates.mapIndexedNotNull { index, p ->
            val score = score(q, p) ?: return@mapIndexedNotNull null
            Triple(score, index, p)
        }
        return scored
            .sortedWith(compareBy<Triple<Int, Int, Product>> { it.first }.thenBy { it.second })
            .map { it.third }
            .distinctBy { it.id }
            .take(limit)
    }

    /** Lower is better; null means no match. */
    internal fun score(q: String, p: Product): Int? {
        val name = normalize(p.name)
        val brand = p.brand?.let(::normalize).orEmpty()
        val category = p.categoryName?.let(::normalize).orEmpty()
        val description = normalize(p.description)
        return when {
            name.startsWith(q) -> 0
            name.split(' ').any { it.startsWith(q) } -> 1
            brand.contains(q) || category.contains(q) -> 2
            name.contains(q) -> 3
            description.contains(q) -> 4
            else -> null
        }
    }
}
