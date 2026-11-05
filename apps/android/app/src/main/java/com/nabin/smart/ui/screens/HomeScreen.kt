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
        item {
            Surface(
                Modifier.fillMaxWidth().padding(16.dp),
                shape = RoundedCornerShape(20.dp),
                color = MaterialTheme.colorScheme.primary,
            ) {
                Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Find it fast", style = MaterialTheme.typography.headlineSmall, color = MaterialTheme.colorScheme.onPrimary)
                    Text(
                        "Search the whole shop, add to your cart, and pay cash when it arrives.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onPrimary,
                    )
                    Button(
                        onClick = { nav.tab(Route.Shop) },
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.secondary, contentColor = MaterialTheme.colorScheme.onSecondary),
                    ) { Text("Search the shop") }
                }
            }
        }

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
                        AssistChip(onClick = { nav.tab(Route.Shop) }, label = { Text(c.name) })
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
