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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShopScreen(nav: Nav, vm: AppViewModel) {
    val repo = vm.repo
    var categories by remember { mutableStateOf<List<Category>>(emptyList()) }
    var typed by remember { mutableStateOf("") }
    var query by remember { mutableStateOf(ProductQuery()) }
    var items by remember { mutableStateOf<List<Product>>(emptyList()) }
    var total by remember { mutableStateOf(0) }
    var loading by remember { mutableStateOf(true) }
    var loadingMore by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var sortMenu by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        runCatching { repo.categories() }.onSuccess { categories = it }
    }

    LaunchedEffect(query) {
        loading = true
        error = null
        try {
            val page = repo.products(query)
            items = if (query.page == 1) page.items else items + page.items
            total = page.total
        } catch (e: Exception) {
            error = e.message ?: "Could not load products."
        }
        loading = false
        loadingMore = false
    }

    Column(Modifier.fillMaxSize()) {
        OutlinedTextField(
            value = typed,
            onValueChange = { typed = it },
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            singleLine = true,
            label = { Text("Search the shop") },
            leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search, keyboardType = KeyboardType.Text),
            keyboardActions = KeyboardActions(onSearch = { query = query.copy(q = typed, page = 1) }),
            trailingIcon = {
                if (typed.isNotEmpty()) {
                    TextButton(onClick = { typed = ""; query = query.copy(q = "", page = 1) }) { Text("Clear") }
                }
            },
        )

        LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            item {
                FilterChip(
                    selected = query.categorySlug == null,
                    onClick = { query = query.copy(categorySlug = null, page = 1) },
                    label = { Text("All") },
                )
            }
            items(categories, key = { it.id }) { c ->
                FilterChip(
                    selected = query.categorySlug == c.slug,
                    onClick = { query = query.copy(categorySlug = c.slug, page = 1) },
                    label = { Text(c.name) },
                )
            }
        }
        Spacer(Modifier.height(8.dp))
        LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            items(PriceBand.values().toList(), key = { it.name }) { band ->
                FilterChip(
                    selected = query.band == band,
                    onClick = { query = query.copy(band = band, page = 1) },
                    label = { Text(band.label) },
                )
            }
        }

        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(
                if (loading && items.isEmpty()) "Loading products" else "$total products",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.weight(1f),
            )
            Box {
                TextButton(onClick = { sortMenu = true }) { Text(query.sort.label) }
                DropdownMenu(expanded = sortMenu, onDismissRequest = { sortMenu = false }) {
                    SortOrder.values().forEach { s ->
                        DropdownMenuItem(
                            text = { Text(s.label) },
                            onClick = { sortMenu = false; query = query.copy(sort = s, page = 1) },
                        )
                    }
                }
            }
        }

        when {
            error != null && items.isEmpty() -> ErrorState(error!!, onRetry = { query = query.copy() })
            loading && items.isEmpty() -> Loading()
            items.isEmpty() -> EmptyState(
                title = "No products match",
                body = "Try another word or clear a filter.",
            )
            else -> LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                contentPadding = PaddingValues(16.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
                modifier = Modifier.fillMaxSize(),
            ) {
                gridItems(items, key = { it.id }) { p ->
                    ProductTile(
                        name = p.name,
                        brand = p.brand,
                        priceFrom = p.priceFrom,
                        listPrice = p.variants.minOfOrNull { it.listPrice },
                        onOffer = p.onOffer,
                        image = p.firstImage,
                        origin = repo.imageOrigin,
                        onClick = { nav.push(Route.Product(p.slug)) },
                    )
                }
                if (items.size < total) {
                    item(span = { GridItemSpan(2) }) {
                        SecondaryButton(
                            if (loadingMore) "Loading" else "Load more",
                            onClick = {
                                loadingMore = true
                                query = query.copy(page = query.page + 1)
                            },
                            enabled = !loadingMore,
                        )
                    }
                }
            }
        }
    }
}
