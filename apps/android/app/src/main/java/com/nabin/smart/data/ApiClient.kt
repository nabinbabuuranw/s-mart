package com.nabin.smart.data

import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/** Raw HTTP answer: status code and body text. */
data class HttpResult(val status: Int, val body: String)

/** An API refusal or a network failure, carrying the API's own error code and message. */
class ApiException(val status: Int, val code: String, message: String) : Exception(message)

/**
 * Turns an error answer into an ApiException. The API answers {code, message} or, for validation,
 * {code: "validation_error", message, details: [{path, message}]}. Non-JSON answers become a generic message.
 */
fun parseApiError(status: Int, body: String): ApiException {
    val fallback = when (status) {
        401 -> "Please sign in again."
        403 -> "You do not have access to this."
        404 -> "We could not find that."
        429 -> "Too many attempts. Wait a minute and try again."
        in 500..599 -> "The S Mart server had a problem. Try again shortly."
        else -> "Something did not work (HTTP $status)."
    }
    return try {
        val json = JSONObject(body)
        val code = json.optString("code", "").ifBlank { "http_$status" }
        var message = json.optString("message", "").ifBlank { fallback }
        val details = json.optJSONArray("details")
        if (details != null && details.length() > 0) {
            val first = details.optJSONObject(0)
            val detail = first?.optString("message", "").orEmpty()
            if (detail.isNotBlank()) message = detail
        }
        ApiException(status, code, message)
    } catch (e: Exception) {
        ApiException(status, "http_$status", fallback)
    }
}

/** Plain HTTP client for the S Mart REST API (/api/v1). Bearer tokens only; no cookies. */
class ApiClient(baseUrl: String) {
    private val base = baseUrl.trimEnd('/')

    private val http = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(25, TimeUnit.SECONDS)
        .callTimeout(45, TimeUnit.SECONDS)
        .build()

    /** Blocking call; callers run it on Dispatchers.IO. */
    fun call(
        method: String,
        path: String,
        body: JSONObject? = null,
        token: String? = null,
        idempotencyKey: String? = null,
        query: Map<String, String> = emptyMap(),
    ): HttpResult {
        val httpUrl = "$base$path".toHttpUrl().newBuilder().apply {
            query.forEach { (k, v) -> addQueryParameter(k, v) }
        }.build()
        val needsBody = method == "POST" || method == "PUT" || method == "PATCH"
        val requestBody = when {
            body != null -> body.toString().toRequestBody("application/json; charset=utf-8".toMediaType())
            needsBody -> "{}".toRequestBody("application/json; charset=utf-8".toMediaType())
            else -> null
        }
        val builder = Request.Builder().url(httpUrl).method(method, requestBody).header("Accept", "application/json")
        if (token != null) builder.header("Authorization", "Bearer $token")
        if (idempotencyKey != null) builder.header("Idempotency-Key", idempotencyKey)
        return try {
            http.newCall(builder.build()).execute().use { response ->
                HttpResult(response.code, response.body?.string().orEmpty())
            }
        } catch (e: java.io.IOException) {
            throw ApiException(0, "network", "Could not reach S Mart. Check your connection and try again.")
        }
    }

    /** Absolute URL for an image path the API returned (relative paths resolve against the API origin). */
    fun originOf(): String = base.removeSuffix("/api/v1")
}
