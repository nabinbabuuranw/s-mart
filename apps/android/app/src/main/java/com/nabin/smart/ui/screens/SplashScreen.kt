package com.nabin.smart.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.nabin.smart.R
import kotlinx.coroutines.delay

/**
 * Brief brand moment on launch, then Home. The logo is the official S Mart mark. Nothing here is
 * loaded from the network.
 */
@Composable
fun SplashScreen(onDone: () -> Unit) {
    LaunchedEffect(Unit) {
        delay(1100)
        onDone()
    }
    Column(
        Modifier.fillMaxSize().semantics { contentDescription = "S Mart" },
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Image(
            painter = painterResource(R.drawable.brand_logo),
            contentDescription = "S Mart logo",
            modifier = Modifier.size(168.dp),
        )
        Spacer(Modifier.height(16.dp))
        Text(
            "Shop from your phone. Pay cash on delivery.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}
