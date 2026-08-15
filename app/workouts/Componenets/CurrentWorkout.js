import { Audio } from "expo-av";
import { useFocusEffect } from "expo-router";
import * as Speech from "expo-speech";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
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
import { Logger } from "../../../constants/Logger";
import { scaling } from "../../../constants/useScaling";

const { scaleHeight, scaleWidth, moderateScale } = scaling();

export default function CurrentWorkout({
  workout,
  onNext,
  index,
  setIndex,
  setLoadingPage,
}) {
  const timerRef = useRef(null);
  const soundRef = useRef(null);
  const isActive = useRef(true);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideUpAnim = useRef(new Animated.Value(50)).current;
  const imageScale = useRef(new Animated.Value(1)).current;
  const timerPulse = useRef(new Animated.Value(1)).current;

  const isTimedWorkout = !!workout?.time;
  const isRepsWorkout = !!workout?.reps;

  const getWorkoutSeconds = useCallback(() => {
    if (!workout?.time) return 0;

    const value = String(workout.time).toLowerCase().trim();

    if (value.includes("m")) {
      return parseInt(value, 10) * 60 || 0;
    }

    return parseInt(value.replace(/[^0-9]/g, ""), 10) || 0;
  }, [workout?.time]);

  const [timeLeft, setTimeLeft] = useState(() => {
    if (!workout?.time) return 0;

    const value = String(workout.time).toLowerCase().trim();

    if (value.includes("m")) {
      return parseInt(value, 10) * 60 || 0;
    }

    return parseInt(value.replace(/[^0-9]/g, ""), 10) || 0;
  });

  const [isTimerActive, setIsTimerActive] = useState(false);
  // Set when a blur paused the timer / interrupted the voice.
  const pausedByBlurRef = useRef(false);
  const wasSpeakingRef = useRef(false);
  const [showStepsModal, setShowStepsModal] = useState(false);
  const [isVoiceMuted, setIsVoiceMuted] = useState(false);

  const delay = useCallback(
    (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    [],
  );

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
  }, [timerPulse]);

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
  }, [timerPulse]);

  const startTimer = useCallback(() => {
    if (!workout?.time) {
      setIsTimerActive(false);
      return;
    }

    setIsTimerActive(true);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    timerRef.current = setInterval(() => {
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

          if (!isVoiceMuted && isActive.current) {
            Speech.speak("Time's up! Moving to the next exercise.", {
              language: "en-US",
              pitch: 1.1,
              rate: 0.8,
              onDone: () => {
                Logger.log("isActive.current--->" + isActive.current);
                Logger.log("onNext--->" + onNext);
                if (isActive.current && onNext) {
                  onNext();
                }
              },
            });
          } else if (isActive.current && onNext) {
            Logger.log("isActive.current--onNext->" + isActive.current);
            Logger.log("onNext--->" + onNext);
            onNext();
          }

          return 0;
        }

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
  }, [workout?.time, isVoiceMuted, onNext, playTimerComplete]);

  const playSoundFromAssets = useCallback(
    async (soundFileName) => {
      if (isVoiceMuted || !isActive.current) return;

      try {
        const soundFiles = {
          "workout_start.mp3": require("../../../assets/mp3/refree.mp3"),
        };

        if (soundRef.current) {
          try {
            await soundRef.current.unloadAsync();
          } catch (e) {}
        }

        return new Promise(async (resolve, reject) => {
          try {
            const { sound } = await Audio.Sound.createAsync(
              soundFiles[soundFileName] || soundFiles["workout_start.mp3"],
              { shouldPlay: true },
            );

            soundRef.current = sound;

            sound.setOnPlaybackStatusUpdate(async (status) => {
              if (!status.isLoaded) return;

              if (status.didJustFinish) {
                try {
                  await sound.unloadAsync();
                } catch (e) {}

                soundRef.current = null;
                resolve();
              }
            });
          } catch (error) {
            reject(error);
          }
        });
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
    if (!isActive.current || isVoiceMuted) return;

    try {
      const introText = `Starting ${workout.name}. You need to perform ${
        workout.reps
          ? `${workout.reps} repetitions.`
          : `${workout.time} seconds.`
      }`;

      await speakText(introText);
      await delay(1000);

      const stepsText = workout.steps
        .map((step, stepIndex) => `Step ${stepIndex + 1}: ${step}`)
        .join(". ");

      await speakText(stepsText);
      await delay(500);

      if (workout.time) {
        const timerText = `Hold this position for ${workout.time}. The timer starts now.`;
        await speakText(timerText);

        if (!isVoiceMuted && isActive.current) {
          await playSoundFromAssets("workout_start.mp3");
        }

        if (isActive.current) {
          startTimer();
          startTimerPulse();
        }
      } else if (workout.reps) {
        const readyText = `Get ready to start. Complete ${workout.reps} repetitions. Begin when you hear the beep.`;
        await speakText(readyText);

        if (!isVoiceMuted && isActive.current) {
          await playSoundFromAssets("workout_start.mp3");
        }

        setIsTimerActive(false);
      }
    } catch (error) {
      console.error("Error starting voice instructions:", error);
    }
  }, [
    workout,
    isVoiceMuted,
    speakText,
    playSoundFromAssets,
    delay,
    startTimer,
    startTimerPulse,
  ]);

  const toggleVoiceMute = useCallback(() => {
    if (isVoiceMuted) {
      setIsVoiceMuted(false);
      startVoiceInstructions();
    } else {
      setIsVoiceMuted(true);
      Speech.stop();
    }
  }, [isVoiceMuted, startVoiceInstructions]);

  const formatTime = useCallback((seconds) => {
    const safeSeconds = Number(seconds) || 0;
    const mins = Math.floor(safeSeconds / 60);
    const secs = safeSeconds % 60;

    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
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
  }, [imageScale]);

  useEffect(() => {
    isActive.current = true;

    Logger.log(`CurrentWorkout ${workout.name} mounted`);

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

    if (!isVoiceMuted) {
      startVoiceInstructions();
    }

    return () => {
      Logger.log(`CurrentWorkout ${workout.name} unmounting, cleaning up...`);

      isActive.current = false;

      Speech.stop();

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

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

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (workout?.time) {
      setTimeLeft(getWorkoutSeconds());
      setIsTimerActive(false);
    } else {
      setTimeLeft(0);
      setIsTimerActive(false);
    }
  }, [workout, getWorkoutSeconds]);

  // ── Leaving the screen (e.g. tapping Jack to open the chat) ──────────────
  // Silence the coach and freeze the countdown, then pick both back up on
  // return. expo-speech has no working pause() on Android, so the cue is
  // re-spoken rather than resumed mid-sentence.
  useFocusEffect(
    useCallback(() => {
      isActive.current = true;
      // Re-announce where we are so the user isn't dropped back into silence.
      if (!isVoiceMuted && wasSpeakingRef.current) {
        wasSpeakingRef.current = false;
        Speech.speak(`Resuming. ${workout?.name || "Keep going"}.`, {
          language: "en-US",
        });
      }
      if (pausedByBlurRef.current) {
        pausedByBlurRef.current = false;
        startTimer();
      }

      return () => {
        // Blur: stop the voice and stop the clock.
        Speech.isSpeakingAsync()
          .then((speaking) => {
            wasSpeakingRef.current = speaking;
          })
          .catch(() => {});
        Speech.stop();

        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          pausedByBlurRef.current = true;
          setIsTimerActive(false);
        }
      };
    }, [isVoiceMuted, workout?.name, startTimer]),
  );

  // Backgrounding the whole app should silence it too.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next !== "active") Speech.stop();
    });
    return () => sub.remove();
  }, []);

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
        <Animated.View
          style={[
            styles.imageContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideUpAnim }],
              height: isTimedWorkout ? scaleHeight(300) : scaleHeight(400),
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
              source={workout?.photo}
              style={styles.exerciseImage}
              resizeMode="contain"
            />
          </View>

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

        <Animated.View
          style={[
            styles.infoContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideUpAnim }],
            },
          ]}
        >
          <View style={styles.titleContainer}>
            <Text style={styles.exerciseName}>
              {isRepsWorkout
                ? `${workout.name} X ${workout.reps}`
                : `${workout.name} - ${workout.time}`}
            </Text>
          </View>

          {isTimedWorkout && (
            <Animated.View
              style={[
                styles.timerContainer,
                {
                  transform: [{ scale: timerPulse }],
                },
              ]}
            >
              <View style={styles.timerTopRow}>
                <View style={styles.timerIconBox}>
                  <Ionicons
                    name="timer-outline"
                    size={22}
                    color={colors.primary}
                  />
                </View>

                <View style={styles.timerTextBox}>
                  <Text style={styles.timerLabel}>Hold Time</Text>
                  <Text style={styles.timerSubLabel}>
                    {isTimerActive ? "Keep going" : "Let's get ready!"}
                  </Text>
                </View>
              </View>

              <Text
                style={[
                  styles.timerDisplay,
                  timeLeft <= 10 && timeLeft > 0 && styles.timerWarning,
                  timeLeft === 0 && styles.timerComplete,
                ]}
              >
                {formatTime(timeLeft)}
              </Text>

              <View style={styles.timerProgressTrack}>
                <View
                  style={[
                    styles.timerProgressFill,
                    {
                      width: `${
                        workout?.time
                          ? Math.max(
                              0,
                              Math.min(
                                100,
                                (timeLeft / getWorkoutSeconds()) * 100,
                              ),
                            )
                          : 0
                      }%`,
                    },
                  ]}
                />
              </View>

              <View style={styles.timerStatusPill}>
                <View
                  style={[
                    styles.statusDot,
                    isTimerActive ? styles.activeDot : styles.completeDot,
                  ]}
                />

                <Text style={styles.statusText}>
                  {isTimerActive ? "Timer Running" : "Let's get ready!"}
                </Text>
              </View>
            </Animated.View>
          )}

          <View style={styles.tagsContainer}>
            {workout.focus.map((muscle, muscleIndex) => (
              <View key={muscleIndex} style={styles.tag}>
                <Text style={styles.tagText}>{muscle}</Text>
              </View>
            ))}
          </View>
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
              {workout.steps.map((step, stepIndex) => (
                <View key={stepIndex} style={styles.stepItem}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>{stepIndex + 1}</Text>
                  </View>

                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}

              {workout.tips && workout.tips.length > 0 && (
                <View style={styles.tipsContainer}>
                  <Text style={styles.tipsTitle}>Pro Tips</Text>

                  {workout.tips.map((tip, tipIndex) => (
                    <View key={tipIndex} style={styles.tipItem}>
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
    width: "100%",
    position: "relative",
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  exerciseImage: {
    width: "100%",
    height: "100%",
  },
  imageGradient: {
    ...StyleSheet.absoluteFillObject,
  },
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
    fontSize: moderateScale(20),
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
    backgroundColor: colors.white,
    borderRadius: 28,
    padding: 22,
    marginBottom: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 6,
    borderWidth: 1,
    borderColor: "#EEF2F7",
  },

  timerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },

  timerIconBox: {
    width: scaleWidth(46),
    height: scaleHeight(46),
    borderRadius: 16,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  timerTextBox: {
    flex: 1,
  },

  timerLabel: {
    fontSize: scaling().moderateScale(14),
    fontFamily: "OpenSans_700Bold",
    color: "#1E293B",
  },

  timerSubLabel: {
    marginTop: 2,
    fontSize: scaling().moderateScale(13),
    fontFamily: "OpenSans_400Regular",
    color: "#64748B",
  },

  timerDisplay: {
    textAlign: "center",
    fontSize: moderateScale(40),
    fontFamily: "OpenSans_700Bold",
    color: colors.primary,
    letterSpacing: 1,
    marginBottom: 18,
  },

  timerWarning: {
    color: "#F59E0B",
  },

  timerComplete: {
    color: "#10B981",
  },

  timerProgressTrack: {
    width: "100%",
    height: scaleHeight(8),
    borderRadius: 20,
    backgroundColor: "#E5E7EB",
    overflow: "hidden",
    marginBottom: 16,
  },

  timerProgressFill: {
    height: "100%",
    borderRadius: 20,
    backgroundColor: colors.primary,
  },

  timerStatusPill: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },

  activeDot: {
    backgroundColor: "#10B981",
  },

  completeDot: {
    backgroundColor: "#94A3B8",
  },

  statusText: {
    fontSize: 13,
    color: "#475569",
    fontFamily: "OpenSans_600SemiBold",
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
