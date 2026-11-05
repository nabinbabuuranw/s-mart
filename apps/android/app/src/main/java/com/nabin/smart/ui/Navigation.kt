package com.nabin.smart.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.List
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Badge
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.nabin.smart.ui.screens.AccountScreen
import com.nabin.smart.ui.screens.AddressesScreen
import com.nabin.smart.ui.screens.AuthScreen
import com.nabin.smart.ui.screens.CartScreen
import com.nabin.smart.ui.screens.CheckoutScreen
import com.nabin.smart.ui.screens.HomeScreen
import com.nabin.smart.ui.screens.OrderDetailScreen
import com.nabin.smart.ui.screens.OrdersScreen
import com.nabin.smart.ui.screens.ProductScreen
import com.nabin.smart.ui.screens.ShopScreen
import com.nabin.smart.ui.screens.SplashScreen
import com.nabin.smart.ui.screens.WishlistScreen

/** Every screen the app can show. Tabs are the five bottom destinations; the rest are pushed on top. */
sealed class Route {
    data object Splash : Route()
    data object Home : Route()
    data object Shop : Route()
    data object Cart : Route()
    data object Orders : Route()
    data object Account : Route()
    data class Product(val slug: String) : Route()
    data object Checkout : Route()
    data class Auth(val startInRegister: Boolean = false) : Route()
    data class OrderDetail(val id: String) : Route()
    data object Wishlist : Route()
    data object Addresses : Route()

    val isTab: Boolean get() = this == Home || this == Shop || this == Cart || this == Orders || this == Account
}

/** Simple back stack. Switching tabs resets it; pushing keeps the tab underneath for Back. */
class Nav(start: Route) {
    val stack = mutableStateListOf(start)
    val current: Route get() = stack.last()

    fun tab(route: Route) {
        stack.clear()
        stack.add(route)
    }

    fun push(route: Route) {
        stack.add(route)
    }

    fun replace(route: Route) {
        stack[stack.lastIndex] = route
    }

    fun pop(): Boolean {
        if (stack.size <= 1) return false
        stack.removeAt(stack.lastIndex)
        return true
    }
}

private data class TabItem(val route: Route, val label: String, val icon: ImageVector)

private val tabs = listOf(
    TabItem(Route.Home, "Home", Icons.Filled.Home),
    TabItem(Route.Shop, "Shop", Icons.Filled.Search),
    TabItem(Route.Cart, "Cart", Icons.Filled.ShoppingCart),
    TabItem(Route.Orders, "Orders", Icons.AutoMirrored.Filled.List),
    TabItem(Route.Account, "Account", Icons.Filled.Person),
)

@Composable
fun SMartRoot(vm: AppViewModel = viewModel()) {
    val nav = remember { Nav(Route.Splash) }
    val cartCount by vm.cartCount.collectAsState()
    val snackbar = remember { SnackbarHostState() }

    LaunchedEffect(Unit) {
        vm.notices.collect { snackbar.showSnackbar(it) }
    }

    BackHandler(enabled = nav.stack.size > 1) { nav.pop() }

    val current = nav.current
    Scaffold(
        contentWindowInsets = WindowInsets(0, 0, 0, 0),
        snackbarHost = { SnackbarHost(snackbar) },
        bottomBar = {
            if (current.isTab) {
                NavigationBar {
                    tabs.forEach { item ->
                        NavigationBarItem(
                            selected = current == item.route,
                            onClick = { if (current != item.route) nav.tab(item.route) },
                            icon = {
                                if (item.route == Route.Cart && cartCount > 0) {
                                    BadgedBox(badge = { Badge { Text("$cartCount") } }) { Icon(item.icon, contentDescription = item.label) }
                                } else {
                                    Icon(item.icon, contentDescription = item.label)
                                }
                            },
                            label = { Text(item.label) },
                        )
                    }
                }
            }
        },
    ) { padding ->
        val contentInsets = WindowInsets.safeDrawing.only(WindowInsetsSides.Top + WindowInsetsSides.Horizontal)
        Box(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .windowInsetsPadding(contentInsets)
                .then(if (current.isTab) Modifier else Modifier.windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Bottom)))
        ) {
            Screen(nav, vm, current)
        }
    }
}

@Composable
private fun Screen(nav: Nav, vm: AppViewModel, route: Route) {
    when (route) {
        Route.Splash -> SplashScreen(onDone = { nav.replace(Route.Home) })
        Route.Home -> HomeScreen(nav, vm)
        Route.Shop -> ShopScreen(nav, vm)
        Route.Cart -> CartScreen(nav, vm)
        Route.Orders -> OrdersScreen(nav, vm)
        Route.Account -> AccountScreen(nav, vm)
        is Route.Product -> ProductScreen(route.slug, nav, vm)
        Route.Checkout -> CheckoutScreen(nav, vm)
        is Route.Auth -> AuthScreen(route.startInRegister, nav, vm)
        is Route.OrderDetail -> OrderDetailScreen(route.id, nav, vm)
        Route.Wishlist -> WishlistScreen(nav, vm)
        Route.Addresses -> AddressesScreen(nav, vm)
    }
}
