import BaseKeyboardSafeModal from './BaseKeyboardSafeModal';

/**
 * Preset: centered host, keyboard-aware, sensible defaults for a single floating card.
 * Override any BaseKeyboardSafeModal prop to specialize.
 */
export default function CenteredKeyboardFormModal({
  scrollEnabled = true,
  centerScrollContent = true,
  keyboardAware = true,
  useInnerPadding = false,
  ...rest
}) {
  return (
    <BaseKeyboardSafeModal
      variant="centered"
      scrollEnabled={scrollEnabled}
      centerScrollContent={centerScrollContent}
      keyboardAware={keyboardAware}
      useInnerPadding={useInnerPadding}
      {...rest}
    />
  );
}
