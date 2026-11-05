package com.nabin.smart.data

import kotlin.math.abs

/** Money in the API is an integer in paisa (minor units). Formats like the web: "Rs. 1,23,450.50" (en-IN grouping). */
fun formatNpr(minor: Long): String {
    val rupees = abs(minor) / 100
    val paisa = abs(minor) % 100
    val grouped = groupIndian(rupees)
    val body = if (paisa == 0L) grouped else "$grouped." + paisa.toString().padStart(2, '0')
    return (if (minor < 0) "-" else "") + "Rs. " + body
}

internal fun groupIndian(n: Long): String {
    val digits = n.toString()
    if (digits.length <= 3) return digits
    val last3 = digits.takeLast(3)
    var rest = digits.dropLast(3)
    val parts = ArrayList<String>()
    while (rest.length > 2) {
        parts.add(0, rest.takeLast(2))
        rest = rest.dropLast(2)
    }
    if (rest.isNotEmpty()) parts.add(0, rest)
    return parts.joinToString(",") + "," + last3
}
