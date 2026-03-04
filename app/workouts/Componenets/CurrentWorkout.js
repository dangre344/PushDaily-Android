import { Audio } from "expo-av";
import * as Speech from "expo-speech";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { colors } from "../../../constants/colors";
import { scaling } from "../../../constants/useScaling";

const { scaleHeight, scaleWidth, moderateScale } = scaling();

export default function CurrentWorkout({
  workout,
  onNext,
  index,
  setIndex,
  setLoadingPage,
}) {
  const [timeLeft, setTimeLeft] = useState(workout.duration || 30);
  const [isTimerActive, setIsTimerActive] = useState(true);
  const [showStepsModal, setShowStepsModal] = useState(false);
  const [isVoiceMuted, setIsVoiceMuted] = useState(false);

  const timerRef = useRef(null);
  const soundRef = useRef(null);
  const isActive = useRef(true);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideUpAnim = useRef(new Animated.Value(50)).current;
  const imageScale = useRef(new Animated.Value(1)).current;
  const timerPulse = useRef(new Animated.Value(1)).current;

  // Helper function for delays
  const delay = useCallback(
    (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    [],
  );

  useEffect(() => {
    // Component is active
    isActive.current = true;
    console.log(`CurrentWorkout ${workout.name} mounted`);

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(slideUpAnim, {
        toValue: 0,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // Start voice instructions when screen opens (if not muted)
    if (!isVoiceMuted) {
      startVoiceInstructions();
    }

    if (workout.hasTimer) {
      startTimer();
      startTimerPulse();
    }

    return () => {
      console.log(`CurrentWorkout ${workout.name} unmounting, cleaning up...`);
      isActive.current = false;

      // Stop all speech
      Speech.stop();

      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // Unload sound if exists
      const unloadSound = async () => {
        if (soundRef.current) {
          try {
            await soundRef.current.unloadAsync();
          } catch (error) {
            console.error("Error unloading sound:", error);
          }
          soundRef.current = null;
        }
      };
      unloadSound();
    };
  }, []);

  const playSoundFromAssets = useCallback(
    async (soundFileName) => {
      if (isVoiceMuted || !isActive.current) return;

      try {
        const soundFiles = {
          "workout_start.mp3": require("../../../assets/mp3/refree.mp3"),
        };

        // Unload previous sound if exists
        if (soundRef.current) {
          try {
            await soundRef.current.unloadAsync();
          } catch (error) {
            console.error("Error unloading previous sound:", error);
          }
        }

        // Play the new sound
        const { sound } = await Audio.Sound.createAsync(
          soundFiles[soundFileName] || soundFiles["workout_start.mp3"],
          { shouldPlay: true },
        );

        soundRef.current = sound;

        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.didJustFinish && isActive.current) {
            sound.unloadAsync();
            soundRef.current = null;
          }
        });

        return sound;
      } catch (error) {
        console.error(`Error playing sound ${soundFileName}:`, error);
      }
    },
    [isVoiceMuted],
  );

  const speakText = useCallback(
    (text) => {
      if (isVoiceMuted || !isActive.current) return Promise.resolve();

      return new Promise((resolve, reject) => {
        Speech.speak(text, {
          language: "en-US",
          pitch: 1.0,
          rate: 0.8,
          onDone: () => {
            if (isActive.current) resolve();
          },
          onStopped: () => {
            if (isActive.current) resolve();
          },
          onError: (error) => {
            if (isActive.current) reject(error);
          },
        });
      });
    },
    [isVoiceMuted],
  );

  const startVoiceInstructions = useCallback(async () => {
    // Check if component is still active before starting
    if (!isActive.current || isVoiceMuted) return;

    try {
      // Introduction
      const introText = `Starting ${workout.name}. You need to do ${workout.reps} repetitions.`;
      await speakText(introText);

      // Wait a moment
      await delay(1000);

      // Read steps
      const stepsText = workout.steps
        .map((step, index) => `Step ${index + 1}: ${step}`)
        .join(". ");

      await speakText(stepsText);

      // Timer announcement if applicable
      if (workout.hasTimer) {
        await delay(500);
        const timerText = `Hold this position for ${workout.duration} seconds. The timer starts now.`;
        await speakText(timerText);
      } else {
        await delay(500);
        const readyText = `Get ready to start. Begin when you hear the beep.`;
        await speakText(readyText);

        if (!isVoiceMuted && isActive.current) {
          await playSoundFromAssets("workout_start.mp3");
        }
      }
    } catch (error) {
      console.error("Error starting voice instructions:", error);
    }
  }, [workout, isVoiceMuted, speakText, playSoundFromAssets, delay]);

  const toggleVoiceMute = useCallback(() => {
    if (isVoiceMuted) {
      // Unmute - start voice instructions
      setIsVoiceMuted(false);
      startVoiceInstructions();
    } else {
      // Mute - stop current speech
      setIsVoiceMuted(true);
      Speech.stop();
    }
  }, [isVoiceMuted, startVoiceInstructions]);

  const startTimer = useCallback(() => {
    setIsTimerActive(true);
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      // Check if component is still active
      if (!isActive.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        return;
      }

      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          setIsTimerActive(false);
          playTimerComplete();

          // Announce timer completion (if not muted and active)
          if (!isVoiceMuted && isActive.current) {
            Speech.speak("Time's up! Great job holding the position.", {
              language: "en-US",
              pitch: 1.1,
              rate: 0.8,
            });
          }

          return 0;
        }

        // Announce time at intervals (if not muted and active)
        if (
          !isVoiceMuted &&
          isActive.current &&
          (prev === 10 || prev === 5 || prev === 3 || prev === 2 || prev === 1)
        ) {
          const timeText = `${prev} second${prev > 1 ? "s" : ""} remaining`;
          Speech.speak(timeText, {
            language: "en-US",
            pitch: prev <= 3 ? 1.2 : 1.0,
            rate: 0.8,
          });
        }

        return prev - 1;
      });
    }, 1000);
  }, [isVoiceMuted]);

  const startTimerPulse = useCallback(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(timerPulse, {
          toValue: 1.05,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(timerPulse, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  const playTimerComplete = useCallback(() => {
    Animated.sequence([
      Animated.timing(timerPulse, {
        toValue: 1.3,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(timerPulse, {
        toValue: 0.9,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(timerPulse, {
        toValue: 1.1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(timerPulse, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const formatTime = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }, []);

  const handleImagePress = useCallback(() => {
    Animated.sequence([
      Animated.timing(imageScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(imageScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowStepsModal(true);
    });
  }, []);

  // Add useEffect to handle component visibility changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState !== "active" && isActive.current) {
        // App went to background - stop speech
        Speech.stop();
      }
    };

    // You might want to add AppState listener if needed
    // AppState.addEventListener('change', handleAppStateChange);

    return () => {
      // AppState.removeEventListener('change', handleAppStateChange);
    };
  }, []);

  // Force speech stop when modal opens
  useEffect(() => {
    if (showStepsModal && !isVoiceMuted) {
      Speech.stop();
    }
  }, [showStepsModal, isVoiceMuted]);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Exercise Image with Question Mark */}
        <Animated.View
          style={[
            styles.imageContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideUpAnim }],
            },
          ]}
        >
          <Animated.Image
            source={{ uri: workout.image }}
            style={[
              styles.exerciseImage,
              {
                transform: [{ scale: imageScale }],
              },
            ]}
            resizeMode="cover"
          />

          <View style={styles.imageGradient}>
            <Image
              source={{ uri: workout.photo }}
              style={styles.exerciseImage}
              resizeMode="cover"
            />
          </View>

          {/* Mute Button - Left Side */}
          <TouchableOpacity
            style={styles.muteButton}
            onPress={toggleVoiceMute}
            activeOpacity={0.8}
          >
            <View style={styles.muteButtonCircle}>
              <Ionicons
                name={isVoiceMuted ? "volume-mute" : "volume-high"}
                size={32}
                color="white"
              />
            </View>
          </TouchableOpacity>

          {/* Help Button - Right Side */}
          <TouchableOpacity
            style={styles.helpButton}
            onPress={handleImagePress}
            activeOpacity={0.8}
          >
            <View style={styles.helpButtonCircle}>
              <Ionicons name="help-circle" size={32} color="white" />
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* Exercise Info */}
        <Animated.View
          style={[
            styles.infoContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideUpAnim }],
            },
          ]}
        >
          {/* Exercise Name and Reps */}
          <View style={styles.titleContainer}>
            <Text
              style={styles.exerciseName}
            >{`${workout.name} X ${workout.reps}`}</Text>
          </View>

          <View style={styles.tagsContainer}>
            {workout.focus.map((muscle, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>{muscle}</Text>
              </View>
            ))}
          </View>

          {workout.hasTimer && (
            <Animated.View
              style={[
                styles.timerContainer,
                {
                  transform: [{ scale: timerPulse }],
                },
              ]}
            >
              <View style={styles.timerHeader}>
                <Ionicons name="timer-outline" size={24} color="#4F46E5" />
                <Text style={styles.timerTitle}>Hold For</Text>
              </View>

              <Text
                style={[
                  styles.timerDisplay,
                  timeLeft <= 10 && styles.timerWarning,
                  timeLeft === 0 && styles.timerComplete,
                ]}
              >
                {formatTime(timeLeft)}
              </Text>

              <View style={styles.timerStatus}>
                <View
                  style={[
                    styles.statusDot,
                    isTimerActive ? styles.activeDot : styles.completeDot,
                  ]}
                />
                <Text style={styles.statusText}>
                  {isTimerActive ? "Timer Running" : "Hold Complete"}
                </Text>
              </View>
            </Animated.View>
          )}
        </Animated.View>
      </ScrollView>

      <Modal
        animationType="fade"
        transparent={true}
        visible={showStepsModal}
        onRequestClose={() => setShowStepsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Steps & Tips</Text>
              <TouchableOpacity onPress={() => setShowStepsModal(false)}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {workout.steps.map((step, index) => (
                <View key={index} style={styles.stepItem}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}

              {workout.tips && workout.tips.length > 0 && (
                <View style={styles.tipsContainer}>
                  <Text style={styles.tipsTitle}>Pro Tips</Text>
                  {workout.tips.map((tip, index) => (
                    <View key={index} style={styles.tipItem}>
                      <Ionicons
                        name="bulb-outline"
                        size={20}
                        color={colors.lightColor}
                      />
                      <Text style={styles.tipText}>{tip}</Text>
                    </View>
                  ))}
                </View>
              )}

              <TouchableOpacity style={styles.videoButton}>
                <Ionicons name="play-circle" size={28} color={colors.white} />
                <Text style={styles.videoButtonText}>Watch Video Tutorial</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 100,
  },
  imageContainer: {
    height: scaleHeight(400),
    width: "100%",
    position: "relative",
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    overflow: "hidden",
    backgroundColor: "#E2E8F0",
  },
  exerciseImage: {
    width: "100%",
    height: "100%",
  },
  imageGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  // Mute Button Styles (Left Side)
  muteButton: {
    position: "absolute",
    left: 20,
    bottom: 20,
    zIndex: 10,
  },
  muteButtonCircle: {
    width: scaleWidth(60),
    height: scaleHeight(60),
    borderRadius: scaleHeight(50) / 2,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.5)",
  },
  // Help Button Styles (Right Side)
  helpButton: {
    position: "absolute",
    right: 20,
    bottom: 20,
    zIndex: 10,
  },
  helpButtonCircle: {
    width: scaleWidth(60),
    height: scaleHeight(60),
    borderRadius: scaleHeight(50) / 2,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.5)",
  },
  // Rest of the styles remain unchanged...
  exerciseBadge: {
    position: "absolute",
    bottom: 20,
    left: 20,
    backgroundColor: "rgba(79, 70, 229, 0.9)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  badgeText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
  },
  infoContainer: {
    padding: 20,
    paddingTop: 20,
  },
  titleContainer: {
    marginBottom: 10,
    alignItems: "center",
  },
  exerciseName: {
    fontFamily: "OpenSans_700Bold",
    fontSize: moderateScale(24),
    color: "#1E293B",
    marginBottom: 8,
  },
  repsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  repsText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#4F46E5",
  },
  tagsContainer: {
    flexDirection: "row",
    alignContent: "center",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 30,
  },
  tag: {
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  tagText: {
    color: colors.primary,
    fontFamily: "OpenSans_700Bold",
    fontSize: 12,
  },
  timerContainer: {
    backgroundColor: "white",
    borderRadius: 24,
    padding: 24,
    marginBottom: 30,
    alignItems: "center",
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  timerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  timerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1E293B",
  },
  timerDisplay: {
    fontSize: 64,
    fontWeight: "700",
    color: "#4F46E5",
    marginBottom: 16,
  },
  timerWarning: {
    color: "#F59E0B",
  },
  timerComplete: {
    color: "#10B981",
  },
  timerStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  activeDot: {
    backgroundColor: "#10B981",
  },
  completeDot: {
    backgroundColor: "#F59E0B",
  },
  statusText: {
    fontSize: 14,
    color: "#64748B",
    fontWeight: "500",
  },
  instructionsContainer: {
    backgroundColor: "white",
    borderRadius: 24,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  instructionsTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 20,
  },
  instructionsList: {
    gap: 16,
  },
  instructionItem: {
    flexDirection: "row",
    gap: 16,
    alignItems: "flex-start",
  },
  instructionNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#4F46E5",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  instructionNumberText: {
    color: "white",
    fontWeight: "700",
    fontSize: 16,
  },
  instructionText: {
    flex: 1,
    fontSize: 16,
    color: "#475569",
    lineHeight: 24,
  },
  nextButtonContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 40,
    backgroundColor: "white",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  nextButton: {
    backgroundColor: "#4F46E5",
    borderRadius: 20,
    paddingVertical: 20,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  nextButtonText: {
    color: "white",
    fontSize: 18,
    fontFamily: "OpenSans_600SemiBold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: scaleHeight(600),
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  modalTitle: {
    fontSize: 24,
    fontFamily: "OpenSans_700Bold",
    color: "#1E293B",
  },
  modalBody: {
    padding: 24,
  },
  stepItem: {
    flexDirection: "row",
    gap: 16,
    alignItems: "flex-start",
    marginBottom: 20,
  },
  stepNumber: {
    width: scaleWidth(36),
    height: scaleHeight(36),
    borderRadius: 18,
    backgroundColor: colors.grey,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  stepNumberText: {
    color: colors.text,
    fontFamily: "OpenSans_700Bold",
    fontSize: 16,
  },
  stepText: {
    flex: 1,
    fontSize: 16,
    fontFamily: "OpenSans_400Regular",
    color: "#475569",
    lineHeight: 24,
  },
  tipsContainer: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  tipsTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 16,
  },
  tipItem: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    marginBottom: 16,
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 16,
  },
  tipText: {
    flex: 1,
    fontSize: 15,
    fontFamily: "OpenSans_400Regular",
    color: colors.white,
  },
  videoButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: colors.gradient2,
    padding: 20,
    borderRadius: 20,
    marginTop: 24,
  },
  videoButtonText: {
    color: colors.white,
    fontSize: 16,
    fontFamily: "OpenSans_600SemiBold",
  },
});
