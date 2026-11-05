package com.nabin.smart.data

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/** Where the session tokens live. The Android app uses encrypted preferences; tests use memory. */
interface TokenStore {
    val accessToken: String?
    val refreshToken: String?
    fun save(session: AuthSession)
    fun updateTokens(accessToken: String, refreshToken: String)
    fun clear()
    fun signedInUser(): AuthUser?
}

/** Tokens live in encrypted preferences (Android Keystore-backed), never in plain files. */
class SessionStore(context: Context) : TokenStore {
    private val prefs = EncryptedSharedPreferences.create(
        context,
        "smart_session",
        MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    override val accessToken: String?
        get() = prefs.getString(KEY_ACCESS, null)

    override val refreshToken: String?
        get() = prefs.getString(KEY_REFRESH, null)

    override fun save(session: AuthSession) {
        prefs.edit()
            .putString(KEY_ACCESS, session.accessToken)
            .putString(KEY_REFRESH, session.refreshToken)
            .putString(KEY_USER_ID, session.user.id)
            .putString(KEY_USER_NAME, session.user.name)
            .putString(KEY_USER_EMAIL, session.user.email)
            .apply()
    }

    override fun updateTokens(accessToken: String, refreshToken: String) {
        prefs.edit().putString(KEY_ACCESS, accessToken).putString(KEY_REFRESH, refreshToken).apply()
    }

    override fun clear() {
        prefs.edit().clear().apply()
    }

    override fun signedInUser(): AuthUser? {
        val id = prefs.getString(KEY_USER_ID, null) ?: return null
        return AuthUser(
            id = id,
            email = prefs.getString(KEY_USER_EMAIL, "") ?: "",
            name = prefs.getString(KEY_USER_NAME, "") ?: "",
            role = "customer",
        )
    }

    private companion object {
        const val KEY_ACCESS = "access"
        const val KEY_REFRESH = "refresh"
        const val KEY_USER_ID = "user_id"
        const val KEY_USER_NAME = "user_name"
        const val KEY_USER_EMAIL = "user_email"
    }
}
