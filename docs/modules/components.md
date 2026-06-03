# UI Components

## Location

All reusable components live under `components/`. Form-oriented controls are in `components/ui/`.

---

## Form Controls (`components/ui/`)

### `OptionCard.js`
Single-selection card used in the signup wizard.

```jsx
<OptionCard
  label="Male"
  icon={<ManIconSVG />}
  selected={value === 'male'}
  onPress={() => setValue('male')}
/>
```
- Works with React Hook Form via `Controller`
- Animated border/background highlight on selection

---

### `MultipleSelector.js`
Multi-select chip group — used for picking preferred workout days.

```jsx
<MultipleSelector
  options={['Monday', 'Tuesday', ...]}
  selected={selectedDays}
  onChange={setSelectedDays}
  minSelect={1}
/>
```

---

### `SliderSelector.js`
Horizontal slider for numeric range input.

---

### `RulerPickerField.js`
Scrollable ruler picker for precise measurements (height, weight).

- Supports unit toggling (cm ↔ ft/in, kg ↔ lbs)
- Haptic tick on each ruler increment

---

### `MeasurementStep.js`
Composite step component combining a `RulerPickerField` with a unit toggle and label. Used for both the height and weight steps in signup.

---

### `InputText.js`
Styled text input wrapper.

- Consistent border radius, padding, and font from `constants/colors.js`
- Forwards all standard `TextInput` props
- Optional leading icon slot

---

### `Button.js`
Primary action button.

```jsx
<Button label="Continue" onPress={handleNext} loading={isSubmitting} />
```
- Loading spinner state
- Disabled + opacity when `loading` or `disabled`
- Uses primary colour `#FF6B35`

---

### `ProgressBar.js`
Linear progress bar used in signup to show wizard step progress.

```jsx
<ProgressBar current={3} total={7} />
```

---

### `StepContainer.js`
Wrapper for each signup step. Provides consistent:
- Header with step title + subtitle
- Back button (disabled on step 1)
- Bottom "Next / Complete" button
- `ProgressBar` at top

---

### `NotificationDialog.js`
Permission request dialog for push notifications.

- Shown after step 7 of signup
- "Allow" → requests `expo-notifications` permission
- "Skip" → proceeds without notifications

---

### `CircularImage.js`
Circular avatar / image display with border and shadow.

---

### `IconWithText.js`
Small inline combination of an icon and a label — used in stat tiles and detail rows.

---

### `TitleText.js`
Styled heading text component. Thin wrapper around `Text` with font variant and colour applied.

---

## Structural Components (`components/`)

### `CustomSplashScreen.tsx`
See [app-entry.md](app-entry.md).

### `collapsible.tsx`
Animated expand/collapse section. Used in `workoutlisting.js` header.

```jsx
<Collapsible title="Chest Exercises" defaultOpen>
  {children}
</Collapsible>
```

### `parallax-scroll-view.tsx`
ScrollView with a parallax header image effect.

### `haptic-tab.tsx`
`TouchableOpacity` wrapper that fires `expo-haptics` on press.

### `external-link.tsx`
Opens a URL in the system browser via `expo-web-browser`.

### `themed-text.tsx` / `themed-view.tsx`
Theme-aware wrappers that switch colour based on `useColorScheme`.

### `icon-symbol.tsx` / `icon-symbol.ios.tsx`
Platform-specific icon resolver. Uses `@expo/vector-icons` (Ionicons, MaterialIcons, etc.) with a consistent interface.

---

## Design Tokens

All components reference values from `constants/colors.js` and `constants/useScaling.js`.

```js
// constants/colors.js
export const PRIMARY   = '#FF6B35';
export const SECONDARY = '#F7931E';
export const ACCENT    = '#FFD23F';
export const BG        = '#FFFFFF';
export const TEXT      = '#2D3436';
```

```js
// constants/useScaling.js
import { moderateScale } from 'react-native-size-matters';
// Used for responsive font sizes and spacing across all screen sizes
```
