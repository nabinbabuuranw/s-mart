package com.nabin.smart.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
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
fun ProductScreen(slug: String, nav: Nav, vm: AppViewModel) {
    val repo = vm.repo
    val user by vm.user.collectAsState()
    val wishlist by vm.wishlistIds.collectAsState()
    val scope = rememberCoroutineScope()

    var product by remember { mutableStateOf<Product?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var reload by remember { mutableStateOf(0) }
    var selected by remember { mutableStateOf<String?>(null) }
    var quantity by remember { mutableStateOf(1) }
    var busy by remember { mutableStateOf(false) }

    LaunchedEffect(slug, reload) {
        error = null
        try {
            val p = repo.product(slug)
            product = p
            selected = p.variants.firstOrNull { it.available }?.id ?: p.variants.firstOrNull()?.id
        } catch (e: Exception) {
            error = e.message ?: "Could not load this product."
        }
    }

    val p = product
    if (p == null) {
        if (error != null) ErrorState(error!!, onRetry = { reload++ }) else Loading()
        return
    }
    val variant = p.variants.firstOrNull { it.id == selected }
    val saved = p.id in wishlist

    Column(Modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = { nav.pop() }) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back") }
            Spacer(Modifier.weight(1f))
            IconButton(onClick = {
                if (user == null) { nav.push(Route.Auth()); return@IconButton }
                scope.launch {
                    busy = true
                    try {
                        if (saved) repo.removeFromWishlist(p.id) else repo.addToWishlist(p.id)
                        vm.setWishlist(if (saved) wishlist - p.id else wishlist + p.id)
                    } catch (e: Exception) {
                        vm.notice(e.message ?: "Could not update your saved items.")
                    }
                    busy = false
                }
            }) {
                Icon(
                    if (saved) Icons.Filled.Favorite else Icons.Filled.FavoriteBorder,
                    contentDescription = if (saved) "Remove from saved" else "Save for later",
                )
            }
        }

        Column(
            Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            ProductGallery(p.imageUrls, repo.imageOrigin, Modifier.fillMaxWidth())
            if (!p.brand.isNullOrBlank()) Text(p.brand!!, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(p.name, style = MaterialTheme.typography.headlineSmall)
            if (p.categoryName != null) Text(p.categoryName!!, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)

            if (variant != null) {
                PriceText(variant.price, variant.listPrice, large = true)
                if (variant.offerTitle != null) StatusPill(variant.offerTitle!!)
                if (variant.lowStock) Text("Only a few left", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
            }

            if (p.variants.size > 1) {
                Text("Choose an option", style = MaterialTheme.typography.titleMedium)
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(p.variants, key = { it.id }) { v ->
                        FilterChip(
                            selected = selected == v.id,
                            enabled = v.available,
                            onClick = { selected = v.id; quantity = 1 },
                            label = { Text(if (v.available) v.name else "${v.name} (out of stock)") },
                        )
                    }
                }
            }

            if (p.description.isNotBlank()) {
                Text(p.description, style = MaterialTheme.typography.bodyLarge)
            }
            Spacer(Modifier.height(8.dp))
        }

        Surface(color = MaterialTheme.colorScheme.surface, tonalElevation = 3.dp) {
            Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                if (variant != null && variant.available) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Quantity", Modifier.weight(1f), style = MaterialTheme.typography.titleMedium)
                        QuantityStepper(quantity, onChange = { quantity = it.coerceIn(1, 99) })
                    }
                    PrimaryButton(
                        if (user == null) "Sign in to add to cart" else "Add to cart",
                        enabled = !busy,
                        onClick = {
                            if (user == null) { nav.push(Route.Auth()); return@PrimaryButton }
                            scope.launch {
                                busy = true
                                try {
                                    val cart = repo.addToCart(variant.id, quantity)
                                    vm.setCartCount(cart.lines.sumOf { it.quantity })
                                    vm.notice("Added to your cart")
                                } catch (e: Exception) {
                                    vm.notice(e.message ?: "Could not add to cart.")
                                }
                                busy = false
                            }
                        },
                    )
                } else {
                    Text("This item is out of stock right now.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}

/**
 * Product photos: one image shows alone; several swipe in a pager with dots. Only the product's own
 * photos from the API are shown, and an empty list shows the placeholder frame.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun ProductGallery(urls: List<String>, origin: String, modifier: Modifier = Modifier) {
    if (urls.size <= 1) {
        RemoteImage(urls.firstOrNull(), origin, modifier.aspectRatio(1f))
        return
    }
    val pager = rememberPagerState(pageCount = { urls.size })
    Column(modifier) {
        HorizontalPager(
            state = pager,
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(1f)
                .semantics { contentDescription = "Photo ${pager.currentPage + 1} of ${urls.size}" },
        ) { page ->
            RemoteImage(urls[page], origin, Modifier.fillMaxSize())
        }
        Row(
            Modifier.fillMaxWidth().padding(top = 8.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            urls.indices.forEach { i ->
                val active = i == pager.currentPage
                Box(
                    Modifier
                        .padding(horizontal = 3.dp)
                        .size(if (active) 8.dp else 6.dp)
                        .clip(CircleShape)
                        .background(if (active) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline),
                )
            }
        }
    }
}
