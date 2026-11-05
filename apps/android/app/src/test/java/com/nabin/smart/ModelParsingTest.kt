package com.nabin.smart

import com.nabin.smart.data.toAddress
import com.nabin.smart.data.toAuthSession
import com.nabin.smart.data.toCart
import com.nabin.smart.data.toOrderDetail
import com.nabin.smart.data.toOrderSummary
import com.nabin.smart.data.toProduct
import com.nabin.smart.data.strOrNull
import com.nabin.smart.ui.formatWhen
import com.nabin.smart.ui.isCancellable
import com.nabin.smart.ui.statusLabel
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ModelParsingTest {
    private val product = JSONObject(
        """
        {"id":"p1","slug":"basmati-5kg","name":"Basmati rice 5 kg","brand":null,"description":"DEMO item",
         "images":[{"url":"/uploads/a.jpg"}],
         "variants":[
           {"id":"v1","sku":"B5","name":"5 kg","price":95000,"listPrice":100000,"offer":{"id":"o1","title":"Weekend offer"},"available":true,"lowStock":true},
           {"id":"v2","sku":"B10","name":"10 kg","price":180000,"listPrice":180000,"offer":null,"available":false,"lowStock":false}],
         "priceFrom":95000,"onOffer":true,"featured":false,"category":{"id":"c1","slug":"grocery","name":"Grocery"}}
        """.trimIndent(),
    )

    @Test fun productParsesVariantsAndOffer() {
        val p = product.toProduct()
        assertEquals("basmati-5kg", p.slug)
        assertNull(p.brand)
        assertEquals(listOf("/uploads/a.jpg"), p.imageUrls)
        assertEquals(2, p.variants.size)
        assertEquals("Weekend offer", p.variants[0].offerTitle)
        assertNull(p.variants[1].offerTitle)
        assertTrue(p.anyAvailable)
        assertEquals("Grocery", p.categoryName)
        assertEquals(95_000L, p.priceFrom)
    }

    @Test fun productWithNoImagesHasNoFirstImage() {
        val p = JSONObject(product.toString().replace("\"images\":[{\"url\":\"/uploads/a.jpg\"}]", "\"images\":[]")).toProduct()
        assertNull(p.firstImage)
    }

    @Test fun cartParsesLinesAndTotals() {
        val cart = JSONObject(
            """
            {"items":[{"id":"ci1","variantId":"v1","productId":"p1","slug":"basmati-5kg","name":"Basmati rice 5 kg",
              "variantName":"5 kg","image":null,"quantity":2,"unitPrice":95000,"listPrice":100000,"offerTitle":"Weekend offer",
              "lineTotal":190000,"available":true,"stock":null}],
             "subtotal":200000,"discountTotal":10000,"couponDiscount":0,"shippingFee":0,"taxTotal":0,"total":190000}
            """.trimIndent(),
        ).toCart()
        assertEquals(1, cart.lines.size)
        assertEquals(2, cart.lines[0].quantity)
        assertNull(cart.lines[0].stock)
        assertEquals(190_000L, cart.total)
        assertEquals(10_000L, cart.discountTotal)
    }

    @Test fun addressOneLineSkipsBlankParts() {
        val a = JSONObject(
            """{"id":"a1","label":"Home","fullName":"Nabin","phone":"9800000000","line1":"Baneshwor 4","line2":null,
               "city":"Kathmandu","district":"","province":"Bagmati","postalCode":null,"isDefault":true}""",
        ).toAddress()
        assertEquals("Baneshwor 4, Kathmandu, Bagmati", a.oneLine())
        assertTrue(a.isDefault)
    }

    @Test fun orderSummaryBuildsItemsText() {
        val o = JSONObject(
            """{"id":"o1","number":"SM-1001","status":"placed","paymentMethod":"cod","paymentStatus":"unpaid","total":190000,
               "placedAt":"2026-11-05T03:30:00.000Z","items":[{"name":"Basmati rice","quantity":2,"unitPrice":95000}]}""",
        ).toOrderSummary()
        assertEquals("Basmati rice x2", o.itemsText)
        assertEquals("SM-1001", o.number)
    }

    @Test fun orderDetailParsesEventsAndShipments() {
        val d = JSONObject(
            """{"id":"o1","number":"SM-1001","status":"shipped","paymentMethod":"cod","paymentStatus":"unpaid",
               "subtotal":100,"discountTotal":0,"couponDiscount":0,"shippingFee":0,"taxTotal":0,"total":100,
               "placedAt":"2026-11-05T03:30:00.000Z","note":null,
               "items":[{"name":"Tea","variantName":"250 g","quantity":1,"unitPrice":100,"lineTotal":100}],
               "events":[{"status":"placed","note":null,"createdAt":"2026-11-05T03:30:00.000Z"}],
               "shipments":[{"carrier":"Local courier","trackingNumber":null,"status":"in_transit","shippedAt":"2026-11-05T05:00:00.000Z"}]}""",
        ).toOrderDetail()
        assertEquals(1, d.items.size)
        assertEquals(1, d.events.size)
        assertNull(d.shipments[0].trackingNumber)
        assertNull(d.note)
    }

    @Test fun authSessionParsesUser() {
        val s = JSONObject(
            """{"accessToken":"a.b.c","refreshToken":"r-token-value-long-enough-0123456789","expiresIn":900,
               "user":{"id":"u1","email":"n@example.com","name":"Nabin","role":"customer","isStaff":false,"permissions":[]}}""",
        ).toAuthSession()
        assertEquals("a.b.c", s.accessToken)
        assertEquals("Nabin", s.user.name)
        assertEquals("customer", s.user.role)
    }

    @Test fun nullStringsAreNullNotTheWordNull() {
        val o = JSONObject("""{"a":null}""")
        assertNull(o.strOrNull("a"))
        assertNull(o.strOrNull("missing"))
    }

    @Test fun statusWordsAndCancelRule() {
        assertEquals("Out for delivery", statusLabel("out_for_delivery"))
        assertEquals("Awaiting payment", statusLabel("pending_payment"))
        assertTrue(isCancellable("placed"))
        assertTrue(isCancellable("confirmed"))
        assertFalse(isCancellable("shipped"))
        assertFalse(isCancellable("delivered"))
    }

    @Test fun blankTimeIsEmptyAndBadTimeIsKept() {
        assertEquals("", formatWhen(null))
        assertEquals("not a date", formatWhen("not a date"))
    }
}
