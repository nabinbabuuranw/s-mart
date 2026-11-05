package com.nabin.smart

import com.nabin.smart.data.Product
import com.nabin.smart.ui.search.SearchSuggestions
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SearchSuggestionsTest {
    private fun product(id: String, name: String, brand: String? = null, category: String? = null, description: String = "") = Product(
        id = id,
        slug = id,
        name = name,
        brand = brand,
        description = description,
        imageUrls = emptyList(),
        variants = emptyList(),
        priceFrom = 0,
        onOffer = false,
        featured = false,
        categoryName = category,
        categorySlug = category?.lowercase(),
    )

    @Test
    fun shortQueriesDoNotSearch() {
        assertFalse(SearchSuggestions.shouldSearch(""))
        assertFalse(SearchSuggestions.shouldSearch(" a "))
        assertTrue(SearchSuggestions.shouldSearch("ab"))
        assertTrue(SearchSuggestions.shouldSearch("  ab  "))
    }

    @Test
    fun normalizeTrimsLowercasesAndCollapsesSpaces() {
        assertEquals("dola silk", SearchSuggestions.normalize("  Dola   SILK "))
    }

    @Test
    fun nameStartsWithRanksFirst() {
        val items = listOf(
            product("1", "Red Dola Silk"),
            product("2", "Dola Silk Saree"),
            product("3", "Kurta Dolanga"),
        )
        val ranked = SearchSuggestions.rank("dola", items).map { it.id }
        assertEquals(listOf("2", "1", "3"), ranked)
    }

    @Test
    fun wordStartBeatsBrandAndDescriptionMatches() {
        val items = listOf(
            product("brand", "Plain Top", brand = "Silkwear"),
            product("desc", "Plain Top 2", description = "made of silk"),
            product("word", "Pure Silk Top"),
        )
        assertEquals(listOf("word", "brand", "desc"), SearchSuggestions.rank("silk", items).map { it.id })
    }

    @Test
    fun noMatchGivesNothingAndKeepsApiOrderForTies() {
        val items = listOf(product("a", "Tea Cup"), product("b", "Tea Pot"))
        assertTrue(SearchSuggestions.rank("zzz", items).isEmpty())
        assertEquals(listOf("a", "b"), SearchSuggestions.rank("tea", items).map { it.id })
    }

    @Test
    fun limitAndDuplicatesAreHandled() {
        val items = (1..10).map { product("p$it", "Shirt $it") } + product("p1", "Shirt 1")
        val ranked = SearchSuggestions.rank("shirt", items, limit = 6)
        assertEquals(6, ranked.size)
        assertEquals(ranked.map { it.id }.distinct().size, ranked.size)
    }

    @Test
    fun categoryMatchCountsAsBrandLevel() {
        val items = listOf(product("c", "Blue Frock", category = "Dresses"))
        assertEquals(listOf("c"), SearchSuggestions.rank("dress", items).map { it.id })
    }

    @Test
    fun shortQueryRanksNothing() {
        assertTrue(SearchSuggestions.rank("a", listOf(product("x", "Apple"))).isEmpty())
    }
}
