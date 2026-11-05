package com.nabin.smart

import com.nabin.smart.data.parseApiError
import org.junit.Assert.assertEquals
import org.junit.Test

class ApiErrorTest {
    @Test fun validationDetailWinsOverGenericMessage() {
        val body = """{"code":"validation_error","message":"Invalid input","details":[{"path":"password","message":"String must contain at least 10 character(s)"}]}"""
        val e = parseApiError(400, body)
        assertEquals("validation_error", e.code)
        assertEquals("String must contain at least 10 character(s)", e.message)
        assertEquals(400, e.status)
    }

    @Test fun apiCodeAndMessageAreKept() {
        val e = parseApiError(401, """{"code":"invalid_credentials","message":"Email or password is wrong"}""")
        assertEquals("invalid_credentials", e.code)
        assertEquals("Email or password is wrong", e.message)
    }

    @Test fun nonJsonAnswerFallsBackToPlainWords() {
        val e = parseApiError(503, "<html>gateway</html>")
        assertEquals("http_503", e.code)
        assertEquals("The S Mart server had a problem. Try again shortly.", e.message)
    }

    @Test fun rateLimitWording() {
        assertEquals("Too many attempts. Wait a minute and try again.", parseApiError(429, "").message)
    }
}
