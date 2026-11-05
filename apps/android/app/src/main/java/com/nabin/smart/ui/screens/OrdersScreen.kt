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
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.*
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import kotlinx.coroutines.launch
import com.nabin.smart.data.*
import com.nabin.smart.ui.*
import com.nabin.smart.ui.components.*

@Composable
fun OrdersScreen(nav: Nav, vm: AppViewModel) {
    val repo = vm.repo
    val user by vm.user.collectAsState()
    var orders by remember { mutableStateOf<OrderPage?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var reload by remember { mutableStateOf(0) }

    LaunchedEffect(user, reload) {
        if (user == null) return@LaunchedEffect
        error = null
        try { orders = repo.orders() } catch (e: Exception) { error = e.message ?: "Could not load your orders." }
    }

    if (user == null) {
        EmptyState("Sign in to see your orders", "Orders you place appear here with live status.", "Sign in", { nav.push(Route.Auth()) })
        return
    }
    val page = orders
    when {
        page == null && error != null -> ErrorState(error!!, onRetry = { reload++ })
        page == null -> Loading()
        page.items.isEmpty() -> EmptyState("No orders yet", "When you place an order it will show here.", "Browse the shop", { nav.tab(Route.Shop) })
        else -> LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item { Text("Your orders", style = MaterialTheme.typography.headlineSmall) }
            items(page.items, key = { it.id }) { o ->
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = MaterialTheme.colorScheme.surface,
                    modifier = Modifier.fillMaxWidth().clickable { nav.push(Route.OrderDetail(o.id)) },
                ) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(o.number, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                            StatusPill(statusLabel(o.status))
                        }
                        Text(formatWhen(o.placedAt), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(o.itemsText, style = MaterialTheme.typography.bodyMedium, maxLines = 2)
                        Text(formatNpr(o.total), style = MaterialTheme.typography.titleMedium)
                    }
                }
            }
        }
    }
}

@Composable
fun OrderDetailScreen(id: String, nav: Nav, vm: AppViewModel) {
    val repo = vm.repo
    val scope = rememberCoroutineScope()
    var order by remember { mutableStateOf<OrderDetail?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var reload by remember { mutableStateOf(0) }
    var confirmCancel by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }

    LaunchedEffect(id, reload) {
        error = null
        try { order = repo.order(id) } catch (e: Exception) { error = e.message ?: "Could not load this order." }
    }

    Column(Modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = { nav.pop() }) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back") }
            Text("Order", style = MaterialTheme.typography.headlineSmall)
        }
        val o = order
        if (o == null) {
            if (error != null) ErrorState(error!!, onRetry = { reload++ }) else Loading()
            return
        }
        Column(
            Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(o.number, style = MaterialTheme.typography.titleLarge, modifier = Modifier.weight(1f))
                StatusPill(statusLabel(o.status))
            }
            Text("Placed ${formatWhen(o.placedAt)}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)

            if (o.status != "cancelled") {
                Text("Progress", style = MaterialTheme.typography.titleMedium)
                val idx = orderSteps.indexOf(o.status)
                orderSteps.forEachIndexed { i, step ->
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(if (idx >= i && idx >= 0) "●" else "○", color = MaterialTheme.colorScheme.secondary)
                        Spacer(Modifier.width(10.dp))
                        Text(statusLabel(step), color = if (idx >= i) MaterialTheme.colorScheme.onBackground else MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }

            o.shipments.forEach { s ->
                InfoCard {
                    Text("Shipment", style = MaterialTheme.typography.titleMedium)
                    LabelValue("Carrier", s.carrier)
                    if (!s.trackingNumber.isNullOrBlank()) LabelValue("Tracking number", s.trackingNumber)
                    LabelValue("Status", s.status.replace('_', ' '))
                }
            }

            if (o.events.isNotEmpty()) {
                InfoCard {
                    Text("History", style = MaterialTheme.typography.titleMedium)
                    o.events.forEach { e ->
                        Column {
                            Text(statusLabel(e.status), style = MaterialTheme.typography.bodyMedium)
                            Text(formatWhen(e.createdAt), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            if (!e.note.isNullOrBlank()) Text(e.note, style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
            }

            InfoCard {
                Text("Items", style = MaterialTheme.typography.titleMedium)
                o.items.forEach { line ->
                    Row(Modifier.fillMaxWidth()) {
                        Text(
                            "${line.name}${if (line.variantName.isNotBlank()) " (" + line.variantName + ")" else ""} × ${line.quantity}",
                            modifier = Modifier.weight(1f),
                            style = MaterialTheme.typography.bodyMedium,
                        )
                        Text(formatNpr(line.lineTotal), style = MaterialTheme.typography.bodyMedium)
                    }
                }
                Hairline()
                LabelValue("Subtotal", formatNpr(o.subtotal))
                if (o.discountTotal > 0) LabelValue("Offers", "-" + formatNpr(o.discountTotal))
                if (o.couponDiscount > 0) LabelValue("Coupon", "-" + formatNpr(o.couponDiscount))
                LabelValue("Delivery", if (o.shippingFee == 0L) "Free" else formatNpr(o.shippingFee))
                if (o.taxTotal > 0) LabelValue("Tax", formatNpr(o.taxTotal))
                LabelValue("Total", formatNpr(o.total), emphasis = true)
                LabelValue("Payment", "Cash on delivery · " + (if (o.paymentStatus == "paid") "paid" else "to be paid on delivery"))
            }

            if (isCancellable(o.status)) {
                SecondaryButton("Cancel order", onClick = { confirmCancel = true }, enabled = !busy)
            }
            Spacer(Modifier.height(16.dp))
        }
    }

    if (confirmCancel) {
        AlertDialog(
            onDismissRequest = { confirmCancel = false },
            title = { Text("Cancel this order?") },
            text = { Text("Items go back to stock. You can place a new order any time.") },
            confirmButton = {
                TextButton(onClick = {
                    confirmCancel = false
                    val current = order ?: return@TextButton
                    scope.launch {
                        busy = true
                        try {
                            order = repo.cancelOrder(current.id, null)
                            vm.notice("Order cancelled")
                        } catch (e: Exception) {
                            vm.notice(e.message ?: "The order could not be cancelled.")
                        }
                        busy = false
                    }
                }) { Text("Yes, cancel") }
            },
            dismissButton = { TextButton(onClick = { confirmCancel = false }) { Text("Keep order") } },
        )
    }
}
