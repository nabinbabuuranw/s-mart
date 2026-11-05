package com.nabin.smart.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.nabin.smart.R

// Ink & Marigold: the customer web palette (apps/customer-web/app/globals.css), light and dark.
private val Light = lightColorScheme(
    primary = Color(0xFF1E2B3A),
    onPrimary = Color(0xFFFFFFFF),
    primaryContainer = Color(0xFFE6EAEF),
    onPrimaryContainer = Color(0xFF15191E),
    secondary = Color(0xFFD98E04),
    onSecondary = Color(0xFF15191E),
    secondaryContainer = Color(0xFFFBEFD2),
    onSecondaryContainer = Color(0xFF8A5A00),
    tertiary = Color(0xFF1F7A4C),
    background = Color(0xFFF6F4EE),
    onBackground = Color(0xFF15191E),
    surface = Color(0xFFFFFFFF),
    onSurface = Color(0xFF15191E),
    surfaceVariant = Color(0xFFE6EAEF),
    onSurfaceVariant = Color(0xFF566070),
    outline = Color(0xFFE2DED3),
    error = Color(0xFFB3261E),
    onError = Color(0xFFFFFFFF),
)

private val Dark = darkColorScheme(
    primary = Color(0xFFA9BDD3),
    onPrimary = Color(0xFF101418),
    primaryContainer = Color(0xFF1F2A35),
    onPrimaryContainer = Color(0xFFE9EDF1),
    secondary = Color(0xFFF0B33C),
    onSecondary = Color(0xFF101418),
    secondaryContainer = Color(0xFF3A2E12),
    onSecondaryContainer = Color(0xFFF0B33C),
    tertiary = Color(0xFF5FBF8A),
    background = Color(0xFF101418),
    onBackground = Color(0xFFE9EDF1),
    surface = Color(0xFF182029),
    onSurface = Color(0xFFE9EDF1),
    surfaceVariant = Color(0xFF1F2A35),
    onSurfaceVariant = Color(0xFF9AA6B2),
    outline = Color(0xFF28323D),
    error = Color(0xFFF2847C),
    onError = Color(0xFF101418),
)

/** Fraunces (headings) and DM Sans (body), the web's faces, bundled as static instances (SIL OFL 1.1). */
private val Fraunces = FontFamily(
    Font(R.font.fraunces_regular, FontWeight.Normal),
    Font(R.font.fraunces_semibold, FontWeight.SemiBold),
)

private val DmSans = FontFamily(
    Font(R.font.dmsans_regular, FontWeight.Normal),
    Font(R.font.dmsans_medium, FontWeight.Medium),
    Font(R.font.dmsans_semibold, FontWeight.SemiBold),
)

private val SMartTypography = Typography(
    headlineLarge = TextStyle(fontFamily = Fraunces, fontWeight = FontWeight.SemiBold, fontSize = 32.sp),
    headlineMedium = TextStyle(fontFamily = Fraunces, fontWeight = FontWeight.SemiBold, fontSize = 26.sp),
    headlineSmall = TextStyle(fontFamily = Fraunces, fontWeight = FontWeight.SemiBold, fontSize = 22.sp),
    titleLarge = TextStyle(fontFamily = Fraunces, fontWeight = FontWeight.SemiBold, fontSize = 20.sp),
    titleMedium = TextStyle(fontFamily = DmSans, fontWeight = FontWeight.Medium, fontSize = 16.sp),
    bodyLarge = TextStyle(fontFamily = DmSans, fontSize = 16.sp),
    bodyMedium = TextStyle(fontFamily = DmSans, fontSize = 14.sp),
    bodySmall = TextStyle(fontFamily = DmSans, fontSize = 12.sp),
    labelLarge = TextStyle(fontFamily = DmSans, fontWeight = FontWeight.Medium, fontSize = 14.sp),
)

@Composable
fun SMartTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (isSystemInDarkTheme()) Dark else Light,
        typography = SMartTypography,
        content = content,
    )
}
