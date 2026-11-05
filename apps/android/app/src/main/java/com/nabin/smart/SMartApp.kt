package com.nabin.smart

import android.app.Application
import com.nabin.smart.data.ApiClient
import com.nabin.smart.data.SessionStore
import com.nabin.smart.data.ShopRepository

class SMartApp : Application() {
    lateinit var repo: ShopRepository
        private set

    override fun onCreate() {
        super.onCreate()
        repo = ShopRepository(
            api = ApiClient(BuildConfig.API_BASE_URL),
            session = SessionStore(this),
        )
    }
}
