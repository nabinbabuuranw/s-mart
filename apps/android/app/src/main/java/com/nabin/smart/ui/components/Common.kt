package com.nabin.smart.ui.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nabin.smart.data.ImageCache
import com.nabin.smart.data.formatNpr
import androidx.compose.material.icons.Icons

/** Money line: the price, with the list price struck through when it is higher. */
@Composable
fun PriceText(amount: Long, listPrice: Long? = null, large: Boolean = false, modifier: Modifier = Modifier) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            formatNpr(amount),
            style = if (large) MaterialTheme.typography.headlineSmall else MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onBackground,
        )
        if (listPrice != null && listPrice > amount) {
            Text(
                formatNpr(listPrice),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textDecoration = androidx.compose.ui.text.style.TextDecoration.LineThrough,
            )
        }
    }
}

/** Product or cart photo. Empty box when there is no image; never a stock or invented picture. */
@Composable
fun RemoteImage(url: String?, origin: String, modifier: Modifier = Modifier) {
    val bitmap: ImageBitmap? by produceState<ImageBitmap?>(initialValue = null, url, origin) {
        value = if (url.isNullOrBlank()) null else ImageCache.load(url, origin)?.asImageBitmap()
    }
    Box(modifier.background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(12.dp)), contentAlignment = Alignment.Center) {
        bitmap?.let { Image(it, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize()) }
    }
}

@Composable
fun PrimaryButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true) {
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier.fillMaxWidth().height(50.dp),
        shape = RoundedCornerShape(14.dp),
        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary, contentColor = MaterialTheme.colorScheme.onPrimary),
    ) {
        Text(text, style = MaterialTheme.typography.labelLarge)
    }
}

@Composable
fun SecondaryButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true) {
    OutlinedButton(onClick = onClick, enabled = enabled, modifier = modifier.fillMaxWidth().height(48.dp), shape = RoundedCornerShape(14.dp)) {
        Text(text, style = MaterialTheme.typography.labelLarge)
    }
}

@Composable
fun Loading(modifier: Modifier = Modifier) {
    Box(modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
        CircularProgressIndicator(color = MaterialTheme.colorScheme.secondary)
    }
}

@Composable
fun ErrorState(message: String, onRetry: (() -> Unit)?, modifier: Modifier = Modifier) {
    Column(modifier.fillMaxWidth().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(message, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.error, textAlign = TextAlign.Center)
        if (onRetry != null) SecondaryButton("Try again", onRetry, modifier = Modifier.width(200.dp))
    }
}

@Composable
fun EmptyState(title: String, body: String, actionText: String? = null, onAction: (() -> Unit)? = null, modifier: Modifier = Modifier) {
    Column(modifier.fillMaxWidth().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(title, style = MaterialTheme.typography.titleLarge, textAlign = TextAlign.Center)
        Text(body, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center)
        if (actionText != null && onAction != null) {
            Spacer(Modifier.height(8.dp))
            PrimaryButton(actionText, onAction, modifier = Modifier.width(220.dp))
        }
    }
}

@Composable
fun SectionTitle(text: String, modifier: Modifier = Modifier) {
    Text(text, style = MaterialTheme.typography.titleLarge, modifier = modifier.padding(horizontal = 16.dp, vertical = 8.dp))
}

@Composable
fun StatusPill(label: String, modifier: Modifier = Modifier) {
    Surface(modifier, shape = RoundedCornerShape(50), color = MaterialTheme.colorScheme.secondaryContainer) {
        Text(
            label,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
            style = MaterialTheme.typography.bodySmall,
            fontWeight = FontWeight.Medium,
            color = MaterialTheme.colorScheme.onSecondaryContainer,
        )
    }
}

/** Quantity stepper. The caller decides what a change does (cart write, or local choice). */
@Composable
fun QuantityStepper(quantity: Int, onChange: (Int) -> Unit, min: Int = 1, max: Int = 99, enabled: Boolean = true) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        OutlinedButton(onClick = { onChange(quantity - 1) }, enabled = enabled && quantity > min, shape = RoundedCornerShape(10.dp), modifier = Modifier.size(44.dp), contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp)) {
            Text("\u2212", style = MaterialTheme.typography.titleLarge)
        }
        Text("$quantity", modifier = Modifier.padding(horizontal = 16.dp), style = MaterialTheme.typography.titleMedium)
        OutlinedButton(onClick = { onChange(quantity + 1) }, enabled = enabled && quantity < max, shape = RoundedCornerShape(10.dp), modifier = Modifier.size(44.dp), contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp)) {
            Text("+", style = MaterialTheme.typography.titleLarge)
        }
    }
}

/** Product tile used in grids and rows. */
@Composable
fun ProductTile(name: String, brand: String?, priceFrom: Long, listPrice: Long?, onOffer: Boolean, image: String?, origin: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Column(modifier.clickable(onClick = onClick), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        RemoteImage(image, origin, Modifier.fillMaxWidth().aspectRatio(1f))
        if (!brand.isNullOrBlank()) Text(brand, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(name, style = MaterialTheme.typography.titleMedium, maxLines = 2)
        PriceText(priceFrom, listPrice)
        if (onOffer) StatusPill("On offer")
    }
}

/** A plain card surface with the app's rounded corners. */
@Composable
fun InfoCard(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Surface(modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp), color = MaterialTheme.colorScheme.surface) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp), content = content)
    }
}

@Composable
fun Hairline() {
    Box(Modifier.fillMaxWidth().height(1.dp).background(MaterialTheme.colorScheme.outline))
}

/** A label next to a value, used in totals and details. */
@Composable
fun LabelValue(label: String, value: String, emphasis: Boolean = false) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, style = if (emphasis) MaterialTheme.typography.titleMedium else MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = if (emphasis) MaterialTheme.typography.titleMedium else MaterialTheme.typography.bodyMedium, fontWeight = if (emphasis) FontWeight.SemiBold else FontWeight.Normal)
    }
}
