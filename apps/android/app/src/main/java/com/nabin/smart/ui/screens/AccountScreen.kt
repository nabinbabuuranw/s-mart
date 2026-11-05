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
fun AccountScreen(nav: Nav, vm: AppViewModel) {
    val repo = vm.repo
    val user by vm.user.collectAsState()
    val scope = rememberCoroutineScope()
    var profile by remember { mutableStateOf<Profile?>(null) }
    var editing by remember { mutableStateOf(false) }
    var editName by remember { mutableStateOf("") }
    var editPhone by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(user) {
        if (user == null) { profile = null; return@LaunchedEffect }
        try { profile = repo.profile() } catch (e: Exception) { error = e.message }
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Text("Account", style = MaterialTheme.typography.headlineSmall)

        if (user == null) {
            InfoCard {
                Text("Sign in to see your cart, orders and saved items.", style = MaterialTheme.typography.bodyLarge)
                PrimaryButton("Sign in", onClick = { nav.push(Route.Auth()) })
                SecondaryButton("Create an account", onClick = { nav.push(Route.Auth(startInRegister = true)) })
            }
        } else {
            InfoCard {
                Text(profile?.name?.ifBlank { null } ?: user!!.name, style = MaterialTheme.typography.titleLarge)
                Text(user!!.email, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                if (!profile?.phone.isNullOrBlank()) Text(profile!!.phone!!, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                TextButton(onClick = {
                    editName = profile?.name ?: user!!.name
                    editPhone = profile?.phone ?: ""
                    editing = true
                }) { Text("Edit name and phone") }
            }

            if (editing) {
                InfoCard {
                    OutlinedTextField(value = editName, onValueChange = { editName = it }, label = { Text("Name") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = editPhone, onValueChange = { editPhone = it }, label = { Text("Phone (optional)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    PrimaryButton("Save", onClick = {
                        if (!Validation.nonBlank(editName, 120)) { error = "Enter your name."; return@PrimaryButton }
                        if (editPhone.isNotBlank() && !Validation.isPhone(editPhone)) { error = "Enter a valid phone number, or leave it empty."; return@PrimaryButton }
                        scope.launch {
                            try {
                                profile = repo.updateProfile(editName, editPhone.ifBlank { null })
                                editing = false
                                error = null
                                vm.notice("Profile saved")
                            } catch (e: Exception) { error = e.message ?: "Could not save." }
                        }
                    })
                    SecondaryButton("Cancel", onClick = { editing = false })
                }
            }

            InfoCard {
                ListRow("My orders") { nav.tab(Route.Orders) }
                ListRow("Saved items") { nav.push(Route.Wishlist) }
                ListRow("Addresses") { nav.push(Route.Addresses) }
            }

            SecondaryButton("Sign out", onClick = { vm.signOut() })
        }

        if (error != null) Text(error!!, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium)

        Spacer(Modifier.height(12.dp))
        Text(
            "Cash on delivery is the only payment on this build. Card and wallet payments show as not enabled yet.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            "Server: " + com.nabin.smart.BuildConfig.API_BASE_URL,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun ListRow(text: String, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().clickable(onClick = onClick).padding(vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(text, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
        Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = null)
    }
}

@Composable
fun WishlistScreen(nav: Nav, vm: AppViewModel) {
    val repo = vm.repo
    val user by vm.user.collectAsState()
    val scope = rememberCoroutineScope()
    var saved by remember { mutableStateOf<List<Product>?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var reload by remember { mutableStateOf(0) }

    LaunchedEffect(user, reload) {
        if (user == null) return@LaunchedEffect
        error = null
        try {
            val list = repo.wishlist()
            saved = list
            vm.setWishlist(list.map { it.id }.toSet())
        } catch (e: Exception) { error = e.message ?: "Could not load saved items." }
    }

    Column(Modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = { nav.pop() }) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back") }
            Text("Saved items", style = MaterialTheme.typography.headlineSmall)
        }
        when {
            user == null -> EmptyState("Sign in to see saved items", "Saved items are kept with your account.", "Sign in", { nav.push(Route.Auth()) })
            saved == null && error != null -> ErrorState(error!!, onRetry = { reload++ })
            saved == null -> Loading()
            saved!!.isEmpty() -> EmptyState("Nothing saved yet", "Tap the heart on a product to keep it here.", "Browse the shop", { nav.tab(Route.Shop) })
            else -> LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                items(saved!!, key = { it.id }) { p ->
                    Surface(shape = RoundedCornerShape(16.dp), color = MaterialTheme.colorScheme.surface, modifier = Modifier.fillMaxWidth()) {
                        Row(Modifier.padding(12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                            RemoteImage(p.firstImage, repo.imageOrigin, Modifier.size(72.dp).clickable { nav.push(Route.Product(p.slug)) })
                            Column(Modifier.weight(1f).clickable { nav.push(Route.Product(p.slug)) }) {
                                Text(p.name, style = MaterialTheme.typography.titleMedium, maxLines = 2)
                                PriceText(p.priceFrom)
                            }
                            IconButton(onClick = {
                                scope.launch {
                                    try {
                                        repo.removeFromWishlist(p.id)
                                        saved = saved!!.filterNot { it.id == p.id }
                                        vm.setWishlist(saved!!.map { it.id }.toSet())
                                    } catch (e: Exception) { vm.notice(e.message ?: "Could not remove it.") }
                                }
                            }) { Icon(Icons.Filled.Favorite, contentDescription = "Remove from saved") }
                        }
                    }
                }
            }
        }
    }
}
