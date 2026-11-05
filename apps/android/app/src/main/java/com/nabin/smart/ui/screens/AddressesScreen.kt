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

/** Address form. Field rules match the API's addressSchema; the caller gets the saved address back. */
@Composable
fun AddressForm(repo: com.nabin.smart.data.ShopRepository, makeDefault: Boolean, onSaved: (Address) -> Unit, onCancel: (() -> Unit)? = null) {
    val scope = rememberCoroutineScope()
    var label by remember { mutableStateOf("Home") }
    var fullName by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var line1 by remember { mutableStateOf("") }
    var line2 by remember { mutableStateOf("") }
    var city by remember { mutableStateOf("") }
    var district by remember { mutableStateOf("") }
    var province by remember { mutableStateOf("") }
    var postal by remember { mutableStateOf("") }
    var default by remember { mutableStateOf(makeDefault) }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        OutlinedTextField(value = label, onValueChange = { label = it }, label = { Text("Label (Home, Office)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(value = fullName, onValueChange = { fullName = it }, label = { Text("Name for delivery") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(value = phone, onValueChange = { phone = it }, label = { Text("Phone") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone), modifier = Modifier.fillMaxWidth())
        OutlinedTextField(value = line1, onValueChange = { line1 = it }, label = { Text("Street address or area") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(value = line2, onValueChange = { line2 = it }, label = { Text("Landmark or line 2 (optional)") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(value = city, onValueChange = { city = it }, label = { Text("City") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(value = district, onValueChange = { district = it }, label = { Text("District (optional)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(value = province, onValueChange = { province = it }, label = { Text("Province (optional)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(value = postal, onValueChange = { postal = it }, label = { Text("Postal code (optional)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Use as my default address", Modifier.weight(1f))
            Switch(checked = default, onCheckedChange = { default = it })
        }
        if (error != null) Text(error!!, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium)
        PrimaryButton(
            if (busy) "Saving" else "Save address",
            enabled = !busy,
            onClick = {
                error = Validation.addressProblem(fullName, phone, line1, city)
                if (error != null) return@PrimaryButton
                scope.launch {
                    busy = true
                    try {
                        val saved = repo.addAddress(AddressDraft(label, fullName, phone, line1, line2, city, district, province, postal, default))
                        onSaved(saved)
                    } catch (e: Exception) {
                        error = e.message ?: "Could not save the address."
                    }
                    busy = false
                }
            },
        )
        if (onCancel != null) SecondaryButton("Cancel", onCancel)
    }
}

@Composable
fun AddressesScreen(nav: Nav, vm: AppViewModel) {
    val repo = vm.repo
    val user by vm.user.collectAsState()
    val scope = rememberCoroutineScope()
    var addresses by remember { mutableStateOf<List<Address>?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var adding by remember { mutableStateOf(false) }
    var reload by remember { mutableStateOf(0) }

    LaunchedEffect(user, reload) {
        if (user == null) return@LaunchedEffect
        error = null
        try { addresses = repo.addresses() } catch (e: Exception) { error = e.message ?: "Could not load addresses." }
    }

    Column(Modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = { nav.pop() }) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back") }
            Text("Addresses", style = MaterialTheme.typography.headlineSmall)
        }
        val list = addresses
        when {
            user == null -> EmptyState("Sign in to manage addresses", "Your addresses are saved with your account.", "Sign in", { nav.push(Route.Auth()) })
            error != null && list == null -> ErrorState(error!!, onRetry = { reload++ })
            list == null -> Loading()
            else -> LazyColumn(Modifier.weight(1f), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                items(list, key = { it.id }) { a ->
                    InfoCard {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(a.label, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                            if (a.isDefault) StatusPill("Default")
                        }
                        Text(a.fullName, style = MaterialTheme.typography.bodyMedium)
                        Text(a.oneLine(), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(a.phone, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        TextButton(onClick = {
                            scope.launch {
                                try { repo.deleteAddress(a.id); reload++ }
                                catch (e: Exception) { vm.notice(e.message ?: "Could not delete the address.") }
                            }
                        }) { Text("Delete") }
                    }
                }
                item {
                    if (adding) {
                        InfoCard {
                            AddressForm(repo, makeDefault = list.isEmpty(), onSaved = { adding = false; reload++ }, onCancel = { adding = false })
                        }
                    } else {
                        SecondaryButton("Add an address", onClick = { adding = true })
                    }
                }
            }
        }
    }
}
