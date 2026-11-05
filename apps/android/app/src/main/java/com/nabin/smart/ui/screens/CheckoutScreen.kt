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
import androidx.compose.runtime.saveable.rememberSaveable
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
fun CheckoutScreen(nav: Nav, vm: AppViewModel) {
    val repo = vm.repo
    val user by vm.user.collectAsState()
    val scope = rememberCoroutineScope()

    var addresses by remember { mutableStateOf<List<Address>?>(null) }
    var methods by remember { mutableStateOf<List<PaymentMethod>>(emptyList()) }
    var cart by remember { mutableStateOf<Cart?>(null) }
    var selectedAddress by remember { mutableStateOf<String?>(null) }
    var coupon by remember { mutableStateOf("") }
    var note by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    var reload by remember { mutableStateOf(0) }
    // One key per checkout attempt: a retry after a lost answer reuses it, so no second order is created.
    val idempotencyKey = rememberSaveable { java.util.UUID.randomUUID().toString() }

    LaunchedEffect(user, reload) {
        if (user == null) return@LaunchedEffect
        error = null
        try {
            val list = repo.addresses()
            addresses = list
            if (selectedAddress == null || list.none { it.id == selectedAddress }) selectedAddress = list.firstOrNull { it.isDefault }?.id ?: list.firstOrNull()?.id
            methods = repo.paymentMethods()
            cart = repo.cart()
        } catch (e: Exception) {
            error = e.message ?: "Could not load checkout."
        }
    }

    if (user == null) {
        EmptyState("Sign in to check out", "Your cart and addresses are kept with your account.", "Sign in", { nav.push(Route.Auth()) })
        return
    }
    val list = addresses
    val c = cart
    if (list == null || c == null) {
        if (error != null) ErrorState(error!!, onRetry = { reload++ }) else Loading()
        return
    }

    Column(Modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = { nav.pop() }) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back") }
            Text("Checkout", style = MaterialTheme.typography.headlineSmall)
        }
        Column(
            Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Text("Deliver to", style = MaterialTheme.typography.titleLarge)
            if (list.isEmpty()) {
                Text("Add a delivery address to continue.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                InfoCard {
                    AddressForm(repo, makeDefault = true, onSaved = { reload++ })
                }
            } else {
                list.forEach { a ->
                    Surface(
                        shape = RoundedCornerShape(14.dp),
                        color = MaterialTheme.colorScheme.surface,
                        modifier = Modifier.fillMaxWidth().clickable { selectedAddress = a.id },
                    ) {
                        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                            RadioButton(selected = selectedAddress == a.id, onClick = { selectedAddress = a.id })
                            Column(Modifier.weight(1f)) {
                                Text("${a.label} · ${a.fullName}", style = MaterialTheme.typography.titleMedium)
                                Text(a.oneLine(), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }
                }
                TextButton(onClick = { nav.push(Route.Addresses) }) { Text("Manage addresses") }
            }

            Text("Payment", style = MaterialTheme.typography.titleLarge)
            methods.forEach { m ->
                Surface(shape = RoundedCornerShape(14.dp), color = MaterialTheme.colorScheme.surface, modifier = Modifier.fillMaxWidth()) {
                    Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                        RadioButton(selected = m.enabled, onClick = null, enabled = m.enabled)
                        Column(Modifier.weight(1f)) {
                            Text(m.label, style = MaterialTheme.typography.titleMedium)
                            Text(
                                if (m.enabled) "Pay the driver in cash when the order arrives." else "Not enabled yet",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
            }

            OutlinedTextField(value = coupon, onValueChange = { coupon = it.uppercase() }, label = { Text("Coupon code (optional)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(value = note, onValueChange = { note = it }, label = { Text("Note for the shop (optional)") }, modifier = Modifier.fillMaxWidth())

            InfoCard {
                LabelValue("Items", "${c.lines.sumOf { it.quantity }}")
                LabelValue("Estimated total", formatNpr(c.total), emphasis = true)
                Text("The final total is calculated by the server when you place the order.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }

            if (error != null) Text(error!!, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium)
            Spacer(Modifier.height(8.dp))
        }

        Surface(color = MaterialTheme.colorScheme.surface, tonalElevation = 3.dp) {
            Column(Modifier.fillMaxWidth().padding(16.dp)) {
                PrimaryButton(
                    if (busy) "Placing order" else "Place order (cash on delivery)",
                    enabled = !busy && selectedAddress != null && c.lines.isNotEmpty() && c.lines.all { it.available },
                    onClick = {
                        val addressId = selectedAddress ?: return@PrimaryButton
                        scope.launch {
                            busy = true
                            error = null
                            try {
                                val order = repo.checkout(addressId, idempotencyKey, coupon.ifBlank { null }, note.ifBlank { null })
                                vm.setCartCount(0)
                                vm.notice("Order ${order.number} placed")
                                nav.tab(Route.Orders)
                                nav.push(Route.OrderDetail(order.id))
                            } catch (e: Exception) {
                                error = (e.message ?: "The order did not go through.") + " You can try again; nothing is charged for a failed order."
                            }
                            busy = false
                        }
                    },
                )
            }
        }
    }
}
