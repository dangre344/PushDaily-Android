/**
 * Custom Expo config plugin: writes Push Daily's ProGuard/R8 rules into
 * android/app/proguard-rules.pro during `expo prebuild`.
 *
 * Why a plugin? The android/ folder is regenerated on `prebuild --clean`, which
 * would wipe any hand-edited proguard-rules.pro. This plugin re-applies the
 * rules every prebuild, so they always survive. Idempotent via a marker comment.
 *
 * NOTE: ProGuard/R8 only runs for RELEASE builds (minifyEnabled). DEBUG builds
 * are never minified, so debug can't be affected/crashed by these rules.
 */
const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const MARKER = "Push Daily — custom ProGuard rules";

const RULES = `
# ============================================================================
# ${MARKER} (managed by plugins/withProguardRules.js — do not edit by hand)
# ============================================================================

# ---- Global attributes (needed for reflection, serialization, JNI, crash logs)
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod,Exceptions
-keepattributes SourceFile,LineNumberTable,RuntimeVisible*Annotations,AnnotationDefault
-keepattributes JavascriptInterface
-renamesourcefileattribute SourceFile

# ---- Keep native methods + enums + Parcelables + Serializables
-keepclasseswithmembernames class * { native <methods>; }
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}
-keepnames class * implements android.os.Parcelable
-keepclassmembers class * implements android.os.Parcelable {
    public static final ** CREATOR;
}
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# ============================================================================
# React Native core + Hermes + JNI + Fabric (New Architecture)
# ============================================================================
-keep,allowobfuscation @interface com.facebook.proguard.annotations.DoNotStrip
-keep,allowobfuscation @interface com.facebook.proguard.annotations.KeepGettersAndSetters
-keep @com.facebook.proguard.annotations.DoNotStrip class *
-keepclassmembers class * { @com.facebook.proguard.annotations.DoNotStrip *; }
-keepclassmembers class * { @com.facebook.react.bridge.ReactMethod *; }
-keepclassmembers class * { @com.facebook.react.uimanager.annotations.ReactProp <methods>; }
-keepclassmembers class * { @com.facebook.react.uimanager.annotations.ReactPropGroup <methods>; }
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.yoga.** { *; }
-keep class com.facebook.soloader.** { *; }
-dontwarn com.facebook.react.**
-dontwarn com.facebook.hermes.**

# ============================================================================
# Expo (modules core + all expo-* native modules: sqlite, notifications, av,
# image, haptics, speech, sharing, application, localization, etc.)
# ============================================================================
-keep class expo.modules.** { *; }
-keep class expo.core.** { *; }
-keep class versioned.host.exp.exponent.** { *; }
-keep class host.exp.exponent.** { *; }
-keepclassmembers class * { @expo.modules.core.interfaces.ExpoMethod *; }
-dontwarn expo.modules.**

# ============================================================================
# Reanimated 4 + Worklets + Gesture Handler + Screens + Safe Area
# ============================================================================
-keep class com.swmansion.reanimated.** { *; }
-keep class com.swmansion.worklets.** { *; }
-keep class com.swmansion.common.** { *; }
-keep class com.swmansion.gesturehandler.** { *; }
-keep class com.swmansion.rnscreens.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }
-keep class com.th3rdwave.safeareacontext.** { *; }
-dontwarn com.swmansion.**

# ============================================================================
# Firebase (app / messaging / crashlytics / remote-config) + RNFirebase bridge
# ============================================================================
-keep class io.invertase.firebase.** { *; }
-dontwarn io.invertase.firebase.**
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**
# Crashlytics — keep exceptions + line info so stack traces stay readable
-keep public class * extends java.lang.Exception
-keep class com.google.firebase.crashlytics.** { *; }
-dontwarn com.google.firebase.crashlytics.**

# ============================================================================
# Google Mobile Ads (AdMob) + RN bridge
# ============================================================================
-keep class com.google.android.gms.ads.** { *; }
-keep class com.google.ads.** { *; }
-keep class io.invertase.googlemobileads.** { *; }
-dontwarn com.google.android.gms.ads.**

# ============================================================================
# Google Play Core / In-App Updates (sp-react-native-in-app-updates)
# ============================================================================
-keep class com.google.android.play.core.** { *; }
-keep class com.google.android.play.** { *; }
-dontwarn com.google.android.play.core.**
-dontwarn com.google.android.play.**

# ============================================================================
# MediaPipe pose detection (@thinksys/react-native-mediapipe + tasks-vision)
# R8 was stripping/obfuscating these in release, so PoseLandmarker.createFrom
# Options() threw → "Pose Landmarker failed to initialize" on ALL release
# builds (debug isn't minified, which is why it only broke in production).
# MediaPipe + its protobuf/AutoValue models rely heavily on reflection & JNI.
# ============================================================================
-keep class com.google.mediapipe.** { *; }
-keep interface com.google.mediapipe.** { *; }
-keep class com.google.mediapipe.framework.** { *; }
-keep class com.google.mediapipe.tasks.** { *; }
-keepclassmembers class com.google.mediapipe.** { *; }
-dontwarn com.google.mediapipe.**
# The thinksys native wrapper (view manager, fragment, pose helper)
-keep class com.tsmediapipe.** { *; }
-dontwarn com.tsmediapipe.**
# Protocol Buffers used by MediaPipe task graphs
-keep class com.google.protobuf.** { *; }
-keepclassmembers class com.google.protobuf.** { *; }
-dontwarn com.google.protobuf.**
# AutoValue (MediaPipe result/options classes are generated AutoValue types)
-keep class autovalue.shaded.** { *; }
-keep @com.google.auto.value.AutoValue class * { *; }
-dontwarn com.google.auto.value.**
# CameraX (used by the wrapper for the live preview)
-keep class androidx.camera.** { *; }
-dontwarn androidx.camera.**

# ============================================================================
# Mixpanel
# ============================================================================
-keep class com.mixpanel.android.** { *; }
-dontwarn com.mixpanel.android.**

# ============================================================================
# Lottie
# ============================================================================
-keep class com.airbnb.lottie.** { *; }
-dontwarn com.airbnb.lottie.**

# ============================================================================
# react-native-svg
# ============================================================================
-keep public class com.horcrux.svg.** { *; }
-dontwarn com.horcrux.svg.**

# ============================================================================
# react-native-view-shot
# ============================================================================
-keep class fr.greweb.reactnativeviewshot.** { *; }
-dontwarn fr.greweb.reactnativeviewshot.**

# ============================================================================
# AsyncStorage / Slider / Localize
# ============================================================================
-keep class com.reactnativecommunity.asyncstorage.** { *; }
-keep class com.reactnativecommunity.slider.** { *; }
-keep class com.zoontek.rnlocalize.** { *; }
-dontwarn com.reactnativecommunity.**
-dontwarn com.zoontek.**

# ============================================================================
# Networking stack used by RN / Mixpanel / Firebase (OkHttp + Okio + Gson)
# ============================================================================
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }
-keep class okio.** { *; }
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**
-keep class com.google.gson.** { *; }
-keepclassmembers,allowobfuscation class * { @com.google.gson.annotations.SerializedName <fields>; }
-dontwarn com.google.gson.**

# ============================================================================
# Kotlin runtime + coroutines (used by Expo modules + Firebase)
# ============================================================================
-keep class kotlin.Metadata { *; }
-keepclassmembers class **$WhenMappings { <fields>; }
-keep class kotlinx.coroutines.** { *; }
-dontwarn kotlin.**
-dontwarn kotlinx.coroutines.**

# ============================================================================
# Misc — silence warnings for optional/compile-only deps
# ============================================================================
-dontwarn javax.annotation.**
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**

# ============================================================================
# end ${MARKER}
# ============================================================================
`;

/** @type {import('@expo/config-plugins').ConfigPlugin} */
const withProguardRules = (config) => {
  return withDangerousMod(config, [
    "android",
    async (cfg) => {
      const file = path.join(
        cfg.modRequest.platformProjectRoot,
        "app",
        "proguard-rules.pro",
      );

      let contents = "";
      try {
        contents = fs.readFileSync(file, "utf8");
      } catch {
        contents = "";
      }

      // Replace (not just skip) the managed block so edits to these rules apply
      // on a plain `expo prebuild`, not only `--clean`. Our block is always the
      // tail of the file, so strip from its marker (and the decorative comment
      // line above it) to EOF, then re-append the current version.
      const startIdx = contents.indexOf(MARKER);
      if (startIdx !== -1) {
        const lineStart = contents.lastIndexOf("\n", startIdx);
        let before = lineStart === -1 ? "" : contents.slice(0, lineStart);
        before = before.replace(/\n#[=\s]*$/, ""); // drop trailing "# ====" line
        contents = before;
      }
      fs.writeFileSync(file, `${contents.trimEnd()}\n${RULES}\n`, "utf8");

      return cfg;
    },
  ]);
};

module.exports = withProguardRules;
