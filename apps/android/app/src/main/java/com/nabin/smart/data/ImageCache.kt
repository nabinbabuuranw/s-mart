package com.nabin.smart.data

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.LruCache
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

/** Small in-memory image cache for product photos. Decodes down to about 800 px so large uploads stay light. */
object ImageCache {
    private val maxKb = (Runtime.getRuntime().maxMemory() / 1024 / 8).toInt()
    private val cache = object : LruCache<String, Bitmap>(maxKb) {
        override fun sizeOf(key: String, value: Bitmap): Int = value.byteCount / 1024
    }
    private val http = OkHttpClient.Builder().callTimeout(30, TimeUnit.SECONDS).build()

    /** Returns the bitmap for an absolute or API-relative URL, or null when it cannot be loaded. */
    suspend fun load(url: String, origin: String): Bitmap? = withContext(Dispatchers.IO) {
        val absolute = when {
            url.startsWith("http://") || url.startsWith("https://") -> url
            url.startsWith("/") -> origin + url
            else -> return@withContext null
        }
        cache.get(absolute)?.let { return@withContext it }
        try {
            http.newCall(Request.Builder().url(absolute).build()).execute().use { response ->
                if (!response.isSuccessful) return@withContext null
                val bytes = response.body?.bytes() ?: return@withContext null
                val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
                var sample = 1
                while (bounds.outWidth / sample > 800 || bounds.outHeight / sample > 800) sample *= 2
                val opts = BitmapFactory.Options().apply { inSampleSize = sample }
                BitmapFactory.decodeByteArray(bytes, 0, bytes.size, opts)?.also { cache.put(absolute, it) }
            }
        } catch (e: Exception) {
            null
        }
    }
}
