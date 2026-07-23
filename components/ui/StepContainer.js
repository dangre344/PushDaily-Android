import { AnimatePresence, MotiView } from "moti";
import { View } from "react-native";

const StepContainer = ({ step, children }) => {
  // `overflow: hidden` clips the horizontal slide overshoot. We must NOT use
  // flex:1 here — inside the signup ScrollView that forces the container to the
  // viewport height and clips anything below it, which was hiding the Weight
  // card on the (tall) Measurements step. No flex → the container grows to its
  // content height and the ScrollView scrolls both cards into view.
  return (
    <View style={{ width: "100%", overflow: "hidden" }}>
      <AnimatePresence exitBeforeEnter>
        <MotiView
          key={step}
          from={{
            opacity: 0,
            translateX: 50, // start from right
          }}
          animate={{
            opacity: 1,
            translateX: 0, // move to center
          }}
          exit={{
            opacity: 0,
            translateX: -50, // exit to left
          }}
          transition={{
            type: "timing",
            duration: 100,
          }}
          style={{ width: "100%" }}
        >
          {children}
        </MotiView>
      </AnimatePresence>
    </View>
  );
};

export default StepContainer;
