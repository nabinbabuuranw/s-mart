package com.nabin.smart.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.nabin.smart.SMartApp
import com.nabin.smart.data.AuthUser
import com.nabin.smart.data.ShopRepository
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** App-wide state: who is signed in, the cart count for the tab badge, saved product ids, and short notices. */
class AppViewModel(app: Application) : AndroidViewModel(app) {
    val repo: ShopRepository = (app as SMartApp).repo

    private val _user = MutableStateFlow(repo.signedInUser())
    val user: StateFlow<AuthUser?> = _user.asStateFlow()

    private val _cartCount = MutableStateFlow(0)
    val cartCount: StateFlow<Int> = _cartCount.asStateFlow()

    private val _wishlistIds = MutableStateFlow<Set<String>>(emptySet())
    val wishlistIds: StateFlow<Set<String>> = _wishlistIds.asStateFlow()

    private val _notices = MutableSharedFlow<String>(extraBufferCapacity = 8)
    val notices = _notices.asSharedFlow()

    init {
        refreshCounts()
        viewModelScope.launch {
            repo.sessionEnded.collect {
                _user.value = null
                _cartCount.value = 0
                _wishlistIds.value = emptySet()
                notice("Please sign in again")
            }
        }
    }

    fun onSignedIn(user: AuthUser) {
        _user.value = user
        refreshCounts()
    }

    fun signOut() {
        viewModelScope.launch {
            repo.logout()
            _user.value = null
            _cartCount.value = 0
            _wishlistIds.value = emptySet()
        }
    }

    fun setCartCount(count: Int) {
        _cartCount.value = count
    }

    fun setWishlist(ids: Set<String>) {
        _wishlistIds.value = ids
    }

    fun notice(text: String) {
        _notices.tryEmit(text)
    }

    /** Refreshes the cart badge and saved-product ids for a signed-in customer; no-op for guests. */
    fun refreshCounts() {
        if (_user.value == null) return
        viewModelScope.launch {
            runCatching { repo.cart() }.onSuccess { cart -> _cartCount.value = cart.lines.sumOf { it.quantity } }
            runCatching { repo.wishlist() }.onSuccess { list -> _wishlistIds.value = list.map { it.id }.toSet() }
        }
    }
}
