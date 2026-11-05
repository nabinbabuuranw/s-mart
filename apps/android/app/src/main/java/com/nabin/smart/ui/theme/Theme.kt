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

/**
 * S Mart brand palette, taken from the official logo (the @smart.inaruwa profile picture):
 * logo red #ED3D22 and logo green #1C9A4E. Text-safe variants are darker so body text passes WCAG AA
 * (checked in palettes_log.md). Logo colours are used for graphics and large marks only.
 */
object SMartColors {
    // light
    val Paper = Color(0xFFF6F7F4)
    val Surface = Color(0xFFFFFFFF)
    val Ink = Color(0xFF15191E)
    val Muted = Color(0xFF5B6470)
    val Line = Color(0xFFE3E6E1)
    val Green = Color(0xFF167D3F)        // primary action, 5.2:1 with white
    val GreenDeep = Color(0xFF0F5F30)    // text on green-soft, 7.0:1
    val GreenSoft = Color(0xFFE8F6EE)
    val Red = Color(0xFFC42E16)          // accent / sale / secondary action, 5.6:1 with white
    val RedSoft = Color(0xFFFDECE9)
    val Error = Color(0xFFB3261E)        // 6.5:1 with white

    // dark
    val DarkPaper = Color(0xFF0F1411)
    val DarkSurface = Color(0xFF161D18)
    val DarkInk = Color(0xFFE9EFEA)
    val DarkMuted = Color(0xFF9AA79E)
    val DarkLine = Color(0xFF2A352E)
    val DarkGreen = Color(0xFF4CC27C)    // 8.3:1 on dark paper
    val DarkRed = Color(0xFFFF6B55)      // 6.6:1 on dark paper
    val DarkGreenSoft = Color(0xFF1B3324)
    val DarkRedSoft = Color(0xFF3A1D17)
}

private val Light = lightColorScheme(
    primary = SMartColors.Green,
    onPrimary = Color(0xFFFFFFFF),
    primaryContainer = SMartColors.GreenSoft,
    onPrimaryContainer = SMartColors.GreenDeep,
    secondary = SMartColors.Red,
    onSecondary = Color(0xFFFFFFFF),
    secondaryContainer = SMartColors.RedSoft,
    onSecondaryContainer = Color(0xFF8E2010),
    tertiary = SMartColors.Green,
    onTertiary = Color(0xFFFFFFFF),
    background = SMartColors.Paper,
    onBackground = SMartColors.Ink,
    surface = SMartColors.Surface,
    onSurface = SMartColors.Ink,
    surfaceVariant = Color(0xFFEEF1EC),
    onSurfaceVariant = SMartColors.Muted,
    outline = SMartColors.Line,
    outlineVariant = Color(0xFFEDEFEA),
    error = SMartColors.Error,
    onError = Color(0xFFFFFFFF),
)

private val Dark = darkColorScheme(
    primary = SMartColors.DarkGreen,
    onPrimary = SMartColors.DarkPaper,
    primaryContainer = SMartColors.DarkGreenSoft,
    onPrimaryContainer = Color(0xFFBFEBD0),
    secondary = SMartColors.DarkRed,
    onSecondary = SMartColors.DarkPaper,
    secondaryContainer = SMartColors.DarkRedSoft,
    onSecondaryContainer = Color(0xFFFFB4A8),
    tertiary = SMartColors.DarkGreen,
    onTertiary = SMartColors.DarkPaper,
    background = SMartColors.DarkPaper,
    onBackground = SMartColors.DarkInk,
    surface = SMartColors.DarkSurface,
    onSurface = SMartColors.DarkInk,
    surfaceVariant = Color(0xFF1E2822),
    onSurfaceVariant = SMartColors.DarkMuted,
    outline = SMartColors.DarkLine,
    outlineVariant = Color(0xFF222C25),
    error = Color(0xFFF2847C),
    onError = SMartColors.DarkPaper,
)

/**
 * DM Sans for everything: the logo's wordmark is a bold, rounded sans, so the headings follow it
 * instead of a serif. DM Sans is bundled (SIL OFL 1.1, see assets/licenses).
 */
private val DmSans = FontFamily(
    Font(R.font.dmsans_regular, FontWeight.Normal),
    Font(R.font.dmsans_medium, FontWeight.Medium),
    Font(R.font.dmsans_semibold, FontWeight.SemiBold),
)

private val SMartTypography = Typography(
    displaySmall = TextStyle(fontFamily = DmSans, fontWeight = FontWeight.SemiBold, fontSize = 36.sp, lineHeight = 42.sp),
    headlineLarge = TextStyle(fontFamily = DmSans, fontWeight = FontWeight.SemiBold, fontSize = 30.sp, lineHeight = 36.sp),
    headlineMedium = TextStyle(fontFamily = DmSans, fontWeight = FontWeight.SemiBold, fontSize = 26.sp, lineHeight = 32.sp),
    headlineSmall = TextStyle(fontFamily = DmSans, fontWeight = FontWeight.SemiBold, fontSize = 22.sp, lineHeight = 28.sp),
    titleLarge = TextStyle(fontFamily = DmSans, fontWeight = FontWeight.SemiBold, fontSize = 20.sp, lineHeight = 26.sp),
    titleMedium = TextStyle(fontFamily = DmSans, fontWeight = FontWeight.Medium, fontSize = 16.sp, lineHeight = 22.sp),
    titleSmall = TextStyle(fontFamily = DmSans, fontWeight = FontWeight.Medium, fontSize = 14.sp, lineHeight = 20.sp),
    bodyLarge = TextStyle(fontFamily = DmSans, fontSize = 16.sp, lineHeight = 24.sp),
    bodyMedium = TextStyle(fontFamily = DmSans, fontSize = 14.sp, lineHeight = 20.sp),
    bodySmall = TextStyle(fontFamily = DmSans, fontSize = 12.sp, lineHeight = 16.sp),
    labelLarge = TextStyle(fontFamily = DmSans, fontWeight = FontWeight.SemiBold, fontSize = 14.sp),
    labelMedium = TextStyle(fontFamily = DmSans, fontWeight = FontWeight.Medium, fontSize = 12.sp),
)

@Composable
fun SMartTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (isSystemInDarkTheme()) Dark else Light,
        typography = SMartTypography,
        content = content,
    )
}
