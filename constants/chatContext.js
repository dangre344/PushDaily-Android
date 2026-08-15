// Lets a screen tell the floating trainer bubble what the user is looking at,
// so tapping Jack opens the chat with a relevant question already typed.
// Module-level (same pattern as constants/tabNavigation.js) to avoid threading
// props through the navigator.

let context = null; // { kind, title, prefill }

/**
 * @param ctx { kind: "exercise" | ..., title: string, prefill: string }
 * Pass null on unmount so the bubble goes back to a plain chat.
 */
export const setChatContext = (ctx) => {
  context = ctx || null;
};

export const getChatContext = () => context;

/** Question pre-typed when Jack is opened from an exercise screen. */
export const exercisePrefill = (name) =>
  `How do I perform "${name}" correctly? Please give me step-by-step form tips.`;
