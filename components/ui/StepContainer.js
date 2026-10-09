import { AnimatePresence, MotiView } from "moti";
import { View } from "react-native";

/**
 * Animates between signup steps.
 *
 * The incoming step slides in from the side you're travelling towards —
 * right when going forward, left when going back — so Back feels like going
 * back. The outgoing step only fades: its exit is decided when it was last
 * rendered, before we knew which way the user would go, so a directional exit
 * would point the wrong way half the time.
 *
 * No flex:1 on the wrapper — inside the signup ScrollView that forces the
 * container to the viewport height and clips anything below it.
 */
const StepContainer = ({ step, direction = 1, children }) => (
  <View style={{ width: "100%", overflow: "hidden" }}>
    <AnimatePresence exitBeforeEnter>
      <MotiView
        key={step}
        from={{ opacity: 0, translateX: 36 * direction }}
        animate={{ opacity: 1, translateX: 0 }}
        exit={{ opacity: 0 }}
        transition={{ type: "timing", duration: 260 }}
        exitTransition={{ type: "timing", duration: 110 }}
        style={{ width: "100%" }}
      >
        {children}
      </MotiView>
    </AnimatePresence>
  </View>
);

export default StepContainer;
