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
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.foundation.BorderStroke
import androidx.compose.ui.text.style.TextOverflow
import com.nabin.smart.ui.search.SearchSuggestions
import com.nabin.smart.data.*
import com.nabin.smart.ui.*
import com.nabin.smart.ui.components.*

@Composable
fun HomeScreen(nav: Nav, vm: AppViewModel) {
    val repo = vm.repo
    var categories by remember { mutableStateOf<List<Category>?>(null) }
    var featured by remember { mutableStateOf<List<Product>?>(null) }
    var offers by remember { mutableStateOf<List<Product>?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var reload by remember { mutableStateOf(0) }

    LaunchedEffect(reload) {
        error = null
        try {
            categories = repo.categories()
            featured = repo.products(ProductQuery(featured = true, pageSize = 10)).items
            offers = repo.products(ProductQuery(onOffer = true, pageSize = 10)).items
        } catch (e: Exception) {
            error = e.message ?: "Could not load the shop."
        }
    }

    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 24.dp)) {
        item { HomeSearch(nav, vm) }

        item { SectionTitle("Categories") }
        item {
            when {
                categories == null && error == null -> Loading()
                categories.isNullOrEmpty() && error == null -> Text(
                    "No categories yet.",
                    modifier = Modifier.padding(horizontal = 16.dp),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                else -> LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(categories.orEmpty()) { c ->
                        AssistChip(
                            onClick = {
                                vm.requestShop(ProductQuery(categorySlug = c.slug))
                                nav.tab(Route.Shop)
                            },
                            label = { Text(c.name) },
                        )
                    }
                }
            }
        }

        item { SectionTitle("Featured") }
        item {
            ProductRow(featured, vm.repo.imageOrigin, nav, emptyText = "Nothing is featured right now.")
        }

        item { SectionTitle("On offer") }
        item {
            ProductRow(offers, vm.repo.imageOrigin, nav, emptyText = "No offers running right now.")
        }

        if (error != null) {
            item { ErrorState(error!!, onRetry = { reload++ }) }
        }
    }
}

@Composable
private fun ProductRow(products: List<Product>?, origin: String, nav: Nav, emptyText: String) {
    if (products == null) {
        Loading()
        return
    }
    if (products.isEmpty()) {
        Text(emptyText, modifier = Modifier.padding(horizontal = 16.dp), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        return
    }
    LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        items(products, key = { it.id }) { p ->
            ProductTile(
                name = p.name,
                brand = p.brand,
                priceFrom = p.priceFrom,
                listPrice = p.variants.minOfOrNull { it.listPrice },
                onOffer = p.onOffer,
                image = p.firstImage,
                origin = origin,
                onClick = { nav.push(Route.Product(p.slug)) },
                modifier = Modifier.width(160.dp),
            )
        }
    }
}

/** Search field with live suggestions. Suggestions come from the catalogue API and are ranked by SearchSuggestions. */
@Composable
private fun HomeSearch(nav: Nav, vm: AppViewModel) {
    var typed by rememberSaveable { mutableStateOf("") }
    var suggestions by remember { mutableStateOf<List<Product>>(emptyList()) }
    var searching by remember { mutableStateOf(false) }
    var failed by remember { mutableStateOf(false) }

    LaunchedEffect(typed) {
        if (!SearchSuggestions.shouldSearch(typed)) {
            suggestions = emptyList()
            searching = false
            failed = false
            return@LaunchedEffect
        }
        searching = true
        delay(250)
        try {
            val page = vm.repo.products(ProductQuery(q = typed.trim(), pageSize = 20))
            suggestions = SearchSuggestions.rank(typed, page.items)
            failed = false
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            suggestions = emptyList()
            failed = true
        }
        searching = false
    }

    Column(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text("Find it fast", style = MaterialTheme.typography.headlineSmall)
        OutlinedTextField(
            value = typed,
            onValueChange = { typed = it },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            placeholder = { Text("Search the shop") },
            leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            keyboardActions = KeyboardActions(onSearch = {
                vm.requestShop(ProductQuery(q = typed.trim()))
                nav.tab(Route.Shop)
            }),
            trailingIcon = {
                if (typed.isNotEmpty()) TextButton(onClick = { typed = "" }) { Text("Clear") }
            },
        )
        if (SearchSuggestions.shouldSearch(typed)) {
            when {
                searching && suggestions.isEmpty() -> Text(
                    "Searching…",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                failed -> Text(
                    "Search is not available right now. Try again in a moment.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.error,
                )
                suggestions.isEmpty() -> Text(
                    "No products match \"${typed.trim()}\".",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                else -> Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = MaterialTheme.colorScheme.surface,
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
                ) {
                    Column {
                        suggestions.forEachIndexed { index, p ->
                            if (index > 0) HorizontalDivider(color = MaterialTheme.colorScheme.outline)
                            Column(
                                Modifier
                                    .fillMaxWidth()
                                    .clickable { nav.push(Route.Product(p.slug)) }
                                    .padding(horizontal = 14.dp, vertical = 12.dp),
                            ) {
                                Text(p.name, style = MaterialTheme.typography.titleSmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                val meta = listOfNotNull(p.brand?.takeIf { it.isNotBlank() }, p.categoryName).joinToString(" · ")
                                if (meta.isNotEmpty()) {
                                    Text(meta, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                }
                            }
                        }
                    }
                }
            }
            if (suggestions.isNotEmpty()) {
                TextButton(onClick = {
                    vm.requestShop(ProductQuery(q = typed.trim()))
                    nav.tab(Route.Shop)
                }) { Text("See all results") }
            }
        }
    }
}
