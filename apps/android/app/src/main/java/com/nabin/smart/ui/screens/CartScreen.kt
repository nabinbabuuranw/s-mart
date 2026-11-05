package com.nabin.smart.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items as gridItems
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import kotlinx.coroutines.launch
import com.nabin.smart.data.*
import com.nabin.smart.ui.*
import com.nabin.smart.ui.components.*

@Composable
fun CartScreen(nav: Nav, vm: AppViewModel) {
    val repo = vm.repo
    val user by vm.user.collectAsState()
    val scope = rememberCoroutineScope()
    var cart by remember { mutableStateOf<Cart?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    var reload by remember { mutableStateOf(0) }

    LaunchedEffect(user, reload) {
        if (user == null) return@LaunchedEffect
        error = null
        try {
            val c = repo.cart()
            cart = c
            vm.setCartCount(c.lines.sumOf { it.quantity })
        } catch (e: Exception) {
            error = e.message ?: "Could not load your cart."
        }
    }

    if (user == null) {
        EmptyState(
            title = "Sign in to see your cart",
            body = "Your cart is kept with your account, so it follows you across visits.",
            actionText = "Sign in",
            onAction = { nav.push(Route.Auth()) },
        )
        return
    }

    val c = cart
    if (c == null) {
        if (error != null) ErrorState(error!!, onRetry = { reload++ }) else Loading()
        return
    }

    fun applyCart(next: Cart) {
        cart = next
        vm.setCartCount(next.lines.sumOf { it.quantity })
    }

    if (c.lines.isEmpty()) {
        EmptyState(
            title = "Your cart is empty",
            body = "Add something from the shop and it will wait for you here.",
            actionText = "Browse the shop",
            onAction = { nav.tab(Route.Shop) },
        )
        return
    }

    val blocked = c.lines.any { !it.available }

    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        items(c.lines, key = { it.id }) { line ->
            Surface(shape = RoundedCornerShape(16.dp), color = MaterialTheme.colorScheme.surface, modifier = Modifier.fillMaxWidth()) {
                Row(Modifier.padding(12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    RemoteImage(line.image, repo.imageOrigin, Modifier.size(84.dp))
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(line.name, style = MaterialTheme.typography.titleMedium, maxLines = 2)
                        if (line.variantName.isNotBlank()) Text(line.variantName, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        PriceText(line.unitPrice, line.listPrice.takeIf { it != line.unitPrice })
                        if (line.offerTitle != null) StatusPill(line.offerTitle)
                        if (!line.available) Text("Not available right now", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
                        else if (line.stock != null && line.quantity > line.stock) Text("Only ${line.stock} left", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                            QuantityStepper(
                                quantity = line.quantity,
                                min = 1,
                                max = 99,
                                enabled = !busy,
                                onChange = { next ->
                                    scope.launch {
                                        busy = true
                                        try { applyCart(repo.setCartQuantity(line.variantId, next)) }
                                        catch (e: Exception) { vm.notice(e.message ?: "Could not update the cart.") }
                                        busy = false
                                    }
                                },
                            )
                            TextButton(
                                enabled = !busy,
                                onClick = {
                                    scope.launch {
                                        busy = true
                                        try { applyCart(repo.setCartQuantity(line.variantId, 0)) }
                                        catch (e: Exception) { vm.notice(e.message ?: "Could not remove the item.") }
                                        busy = false
                                    }
                                },
                            ) { Text("Remove") }
                        }
                    }
                }
            }
        }

        item {
            InfoCard {
                LabelValue("Subtotal", formatNpr(c.subtotal))
                if (c.discountTotal > 0) LabelValue("Offers", "-" + formatNpr(c.discountTotal))
                if (c.couponDiscount > 0) LabelValue("Coupon", "-" + formatNpr(c.couponDiscount))
                LabelValue("Delivery", if (c.shippingFee == 0L) "Free" else formatNpr(c.shippingFee))
                if (c.taxTotal > 0) LabelValue("Tax", formatNpr(c.taxTotal))
                Hairline()
                LabelValue("Total", formatNpr(c.total), emphasis = true)
                Text("Cash on delivery. The final amount is set when you place the order.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }

        item {
            if (blocked) {
                Text("Remove the unavailable items to continue.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.error)
            }
            PrimaryButton("Checkout", onClick = { nav.push(Route.Checkout) }, enabled = !blocked && !busy)
        }
        item { Spacer(Modifier.height(16.dp)) }
    }
}
