import { ResizeMode, Video } from "expo-av";
import { Asset } from "expo-asset";
import { memo } from "react";
import { StyleSheet } from "react-native";

import EXERCISE_VIDEOS from "../../assets/exercise-videos";

// ─── Exercise videos ─────────────────────────────────────────────────────────
// The library's animations pre-rendered to short looping MP4s
// (scripts/render-exercise-videos.js). Played by the phone's hardware video
// decoder, they stay smooth on low-end devices, where drawing the same SVG live
// managed ~4 fps.

/** True when this exercise slug has a rendered video. */
export const hasExerciseVideo = (slug) => !!slug && !!EXERCISE_VIDEOS[slug];

/**
 * Fetches a clip into the local cache ahead of time (during the rest screen, or
 * when a workout opens) so the exercise screen can start it straight away.
 * Fire-and-forget; a failure just means the player fetches it itself.
 */
export const preloadExerciseVideo = (slug) => {
  const source = slug && EXERCISE_VIDEOS[slug];
  if (!source) return;
  Asset.fromModule(source)
    .downloadAsync()
    .catch(() => {});
};

/**
 * Loops one exercise video, muted (the voice coach and the user's music keep
 * the audio).
 *
 * @param {string}  slug     the exercise's `video` slug in constants/Constants.js
 * @param {boolean} playing  false pauses it (screen blurred, app backgrounded…)
 * @param {function} onError called when the clip can't play, so the caller can
 *                           show the exercise photo instead
 */
function ExerciseVideoPlayer({ slug, playing = true, style, onError }) {
  const source = EXERCISE_VIDEOS[slug];
  if (!source) return null;
  return (
    <Video
      // A new exercise is a new clip from its first frame.
      key={slug}
      source={source}
      style={[styles.video, style]}
      resizeMode={ResizeMode.CONTAIN}
      isLooping
      isMuted
      shouldPlay={playing}
      useNativeControls={false}
      onError={onError}
    />
  );
}

export default memo(ExerciseVideoPlayer);

const styles = StyleSheet.create({
  video: { width: "100%", height: "100%", backgroundColor: "#F5F5F5" },
});
