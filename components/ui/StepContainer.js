import { AnimatePresence, MotiView } from "moti";
import { View } from "react-native";

const StepContainer = ({ step, children }) => {
  return (
    <View style={{ flex: 1, overflow: "hidden" }}>
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
          style={{ flex: 1 }}
        >
          {children}
        </MotiView>
      </AnimatePresence>
    </View>
  );
};

export default StepContainer;
