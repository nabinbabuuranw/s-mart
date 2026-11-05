package com.nabin.smart

import com.nabin.smart.data.formatNpr
import com.nabin.smart.data.groupIndian
import org.junit.Assert.assertEquals
import org.junit.Test

class MoneyTest {
    @Test fun zeroAndWholeRupees() {
        assertEquals("Rs. 0", formatNpr(0))
        assertEquals("Rs. 1,000", formatNpr(100_000))
    }

    @Test fun paisaShownOnlyWhenPresent() {
        assertEquals("Rs. 123.45", formatNpr(12_345))
        assertEquals("Rs. 0.05", formatNpr(5))
    }

    @Test fun indianGrouping() {
        assertEquals("Rs. 12,34,567.89", formatNpr(123_456_789))
        assertEquals("1,00,000", groupIndian(100_000))
        assertEquals("999", groupIndian(999))
    }

    @Test fun negativeAmount() {
        assertEquals("-Rs. 2.50", formatNpr(-250))
    }
}
