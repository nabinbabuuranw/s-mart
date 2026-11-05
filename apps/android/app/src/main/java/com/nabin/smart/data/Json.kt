package com.nabin.smart.data

import org.json.JSONArray
import org.json.JSONObject

// Null-safe JSON readers. org.json returns the literal "null" from optString on JSON null, so every
// string read goes through isNull first.

internal fun JSONObject.str(key: String): String = if (isNull(key) || !has(key)) "" else optString(key, "")

internal fun JSONObject.strOrNull(key: String): String? =
    if (isNull(key) || !has(key)) null else optString(key, "").takeIf { it.isNotBlank() }

internal fun JSONObject.long(key: String): Long = if (isNull(key)) 0L else optLong(key, 0L)

internal fun JSONObject.int(key: String): Int = if (isNull(key)) 0 else optInt(key, 0)

internal fun JSONObject.intOrNull(key: String): Int? = if (isNull(key) || !has(key)) null else optInt(key, 0)

internal fun JSONObject.bool(key: String): Boolean = if (isNull(key)) false else optBoolean(key, false)

internal fun JSONObject.objects(key: String): List<JSONObject> {
    val array = optJSONArray(key) ?: return emptyList()
    return array.objects()
}

internal fun JSONArray.objects(): List<JSONObject> = (0 until length()).mapNotNull { optJSONObject(it) }
