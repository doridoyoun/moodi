import BaseKeyboardSafeModal from './BaseKeyboardSafeModal';

/**
 * Preset: bottom-aligned host (sheet-style), keyboard-aware.
 * Caller owns sheet chrome (radius, handle, drag, etc.).
 */
export default function BottomSheetKeyboardFormModal({
  scrollEnabled = true,
  keyboardAware = true,
  useInnerPadding = false,
  ...rest
}) {
  return (
    <BaseKeyboardSafeModal
      variant="bottom-sheet"
      scrollEnabled={scrollEnabled}
      centerScrollContent={false}
      keyboardAware={keyboardAware}
      useInnerPadding={useInnerPadding}
      {...rest}
    />
  );
}
