package com.nabin.smart

import com.nabin.smart.data.AuthSession
import com.nabin.smart.data.AuthUser
import com.nabin.smart.data.TokenStore

/** In-memory token store for JVM tests (the Android store needs a Context). */
class MemoryTokenStore : TokenStore {
    override var accessToken: String? = null
    override var refreshToken: String? = null
    private var user: AuthUser? = null

    override fun save(session: AuthSession) {
        accessToken = session.accessToken
        refreshToken = session.refreshToken
        user = session.user
    }

    override fun updateTokens(accessToken: String, refreshToken: String) {
        this.accessToken = accessToken
        this.refreshToken = refreshToken
    }

    override fun clear() {
        accessToken = null
        refreshToken = null
        user = null
    }

    override fun signedInUser(): AuthUser? = user
}
