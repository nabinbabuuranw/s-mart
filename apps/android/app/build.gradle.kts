plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

// API base URL: gradle property smartApiBaseUrl (see gradle.properties). Placeholder until deployed.
val apiBaseUrl: String = (project.findProperty("smartApiBaseUrl") as String?)?.trim()
    ?: "http://localhost:4100/api/v1"

android {
    namespace = "com.nabin.smart"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.nabin.smart"
        minSdk = 26
        targetSdk = 35
        versionCode = 2
        versionName = "0.1.0-m2"
        buildConfigField("String", "API_BASE_URL", "\"$apiBaseUrl\"")
        // Cleartext HTTP is allowed only when the configured API URL itself is http:// (LAN / localhost testing).
        manifestPlaceholders["usesCleartext"] = apiBaseUrl.startsWith("http://")
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    // Release signing is read from environment variables so no secret lives in the repo.
    // SMART_KEYSTORE (path), SMART_KEYSTORE_PASSWORD, SMART_KEY_ALIAS, SMART_KEY_PASSWORD.
    signingConfigs {
        create("release") {
            val ks = System.getenv("SMART_KEYSTORE")
            if (!ks.isNullOrBlank()) {
                storeFile = file(ks)
                storePassword = System.getenv("SMART_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("SMART_KEY_ALIAS") ?: "smart"
                keyPassword = System.getenv("SMART_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            isShrinkResources = false
            if (!System.getenv("SMART_KEYSTORE").isNullOrBlank()) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    testOptions {
        unitTests.isReturnDefaultValues = false
    }

    packaging {
        resources.excludes += setOf("/META-INF/{AL2.0,LGPL2.1}", "META-INF/versions/9/previous-compilation-data.bin")
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2025.05.00")
    implementation(composeBom)
    androidTestImplementation(composeBom)

    implementation("androidx.core:core-ktx:1.16.0")
    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-core")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.9.0")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.9.0")
    implementation("androidx.security:security-crypto:1.1.0-alpha06")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")

    testImplementation("junit:junit:4.13.2")
    // org.json is a stub on the JVM unit-test classpath; the real implementation is used here only.
    testImplementation("org.json:json:20240303")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.10.2")
}
