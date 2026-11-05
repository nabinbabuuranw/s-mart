package com.nabin.smart

import com.nabin.smart.data.PriceBand
import com.nabin.smart.data.ProductQuery
import com.nabin.smart.data.SortOrder
import com.nabin.smart.data.Validation
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ValidationTest {
    @Test fun emailRules() {
        assertTrue(Validation.isEmail("nabin@example.com"))
        assertTrue(Validation.isEmail("  a.b@c.np "))
        assertFalse(Validation.isEmail("no-at-sign"))
        assertFalse(Validation.isEmail("a@b"))
        assertFalse(Validation.isEmail("two words@x.com"))
    }

    @Test fun phoneMatchesApiRule() {
        assertTrue(Validation.isPhone("+977 9800000000"))
        assertTrue(Validation.isPhone("(01) 4444-555"))
        assertFalse(Validation.isPhone("123"))
        assertFalse(Validation.isPhone("phone number"))
    }

    @Test fun passwordNeedsTenCharacters() {
        assertFalse(Validation.isNewPassword("123456789"))
        assertTrue(Validation.isNewPassword("1234567890"))
    }

    @Test fun addressProblemOrderOfChecks() {
        assertEquals("Add the name the order should be delivered to.", Validation.addressProblem("", "9800000000", "x", "y"))
        assertEquals("Enter a valid phone number (7 to 20 digits, spaces, + or -).", Validation.addressProblem("A", "abc", "x", "y"))
        assertEquals("Add the street address or area.", Validation.addressProblem("A", "9800000000", " ", "y"))
        assertEquals("Add the city.", Validation.addressProblem("A", "9800000000", "x", ""))
        assertNull(Validation.addressProblem("A", "9800000000", "Street 1", "Kathmandu"))
    }

    @Test fun productQueryParams() {
        val params = ProductQuery(q = "  rice ", categorySlug = "grocery", band = PriceBand.UNDER_500, sort = SortOrder.PRICE_ASC, page = 2, pageSize = 20).toParams()
        assertEquals("rice", params["q"])
        assertEquals("grocery", params["category"])
        assertEquals("50000", params["maxPrice"])
        assertEquals(null, params["minPrice"])
        assertEquals("price_asc", params["sort"])
        assertEquals("2", params["page"])
        assertFalse(params.containsKey("onOffer"))
    }

    @Test fun priceBandRanges() {
        val params = ProductQuery(band = PriceBand.FROM_500_TO_2000).toParams()
        assertEquals("50000", params["minPrice"])
        assertEquals("200000", params["maxPrice"])
        val over = ProductQuery(band = PriceBand.OVER_2000).toParams()
        assertEquals("200000", over["minPrice"])
        assertEquals(null, over["maxPrice"])
    }

    @Test fun blankSearchIsOmitted() {
        assertFalse(ProductQuery(q = "   ").toParams().containsKey("q"))
    }
}
