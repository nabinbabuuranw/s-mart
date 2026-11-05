package com.nabin.smart.ui

import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/** Order and event times: "5 Nov 2026, 09:05". Falls back to the raw text when it is not an ISO instant. */
fun formatWhen(iso: String?): String {
    if (iso.isNullOrBlank()) return ""
    return try {
        Instant.parse(iso).atZone(ZoneId.systemDefault()).format(DateTimeFormatter.ofPattern("d MMM yyyy, HH:mm", Locale.ENGLISH))
    } catch (e: Exception) {
        iso
    }
}

/** Status codes from the API, in plain English (the web app's STATUS_LABEL). */
fun statusLabel(status: String): String = when (status) {
    "pending_payment" -> "Awaiting payment"
    "placed" -> "Placed"
    "confirmed" -> "Confirmed"
    "packed" -> "Packed"
    "shipped" -> "Shipped"
    "out_for_delivery" -> "Out for delivery"
    "delivered" -> "Delivered"
    "cancelled" -> "Cancelled"
    "return_requested" -> "Return requested"
    "returned" -> "Returned"
    "refunded" -> "Refunded"
    else -> status.replace('_', ' ').replaceFirstChar { it.uppercase() }
}

/** Orders the customer can still cancel, as the API allows (placed, confirmed, pending payment). */
fun isCancellable(status: String): Boolean = status == "pending_payment" || status == "placed" || status == "confirmed"

/** Order progress steps, in the order the web app draws them. */
val orderSteps = listOf("placed", "confirmed", "packed", "shipped", "out_for_delivery", "delivered")
