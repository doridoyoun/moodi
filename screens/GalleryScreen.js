import { useCallback, useState } from 'react';
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FAB, Portal } from 'react-native-paper';
import NotebookLayout from '../components/NotebookLayout';
import { useMood } from '../src/context/MoodContext';
import { moodOrder, moodPalette, notebook } from '../constants/theme';

function formatTimeShort(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function MemoTimeCaption({ memo, timestamp, memoColor, timeColor }) {
  const line = (memo || '').trim();
  const time = formatTimeShort(timestamp);
  return (
    <View style={memoTimeStyles.row}>
      <Text style={[memoTimeStyles.memo, { color: memoColor }]} numberOfLines={2}>
        {line || '\u00a0'}
      </Text>
      <Text style={[memoTimeStyles.time, { color: timeColor }]}>{time}</Text>
    </View>
  );
}

const memoTimeStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    width: '100%',
    marginTop: 6,
  },
  memo: {
    flex: 1,
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 14,
  },
  time: {
    fontSize: 10,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    flexShrink: 0,
  },
});

/** Archive 폴라로이드 전용 — Four-Cut은 MemoTimeCaption 유지 */
function ArchiveMemoTimeCaption({ memo, timestamp, memoColor, timeColor }) {
  const line = (memo || '').trim();
  const time = formatTimeShort(timestamp);

  if (!line) {
    return (
      <View style={archiveCaptionStyles.centeredStrip}>
        <Text style={[archiveCaptionStyles.timeSolo, { color: timeColor }]}>{time}</Text>
      </View>
    );
  }

  return (
    <View style={archiveCaptionStyles.row}>
      <Text
        style={[archiveCaptionStyles.memo, { color: memoColor }]}
        numberOfLines={2}
      >
        {line}
      </Text>
      <Text style={[archiveCaptionStyles.time, { color: timeColor }]}>{time}</Text>
    </View>
  );
}

const archiveCaptionStyles = StyleSheet.create({
  centeredStrip: {
    width: '100%',
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 2,
  },
  timeSolo: {
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    width: '100%',
  },
  memo: {
    flex: 1,
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 16,
  },
  time: {
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    flexShrink: 0,
  },
});

export default function GalleryScreen() {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const {
    albumItems,
    fourSlotIds,
    setFourSlotAt,
    addAlbumItem,
    updateAlbumItem,
  } = useMood();

  const [emotionModalVisible, setEmotionModalVisible] = useState(false);
  const [editingAlbumId, setEditingAlbumId] = useState(null);
  const [pendingImageUri, setPendingImageUri] = useState(null);
  const [draftMemo, setDraftMemo] = useState('');
  const [pickedEmotion, setPickedEmotion] = useState(null);

  const [slotPickerVisible, setSlotPickerVisible] = useState(false);
  const [activeSlotIndex, setActiveSlotIndex] = useState(0);

  const openImagePickerForNewAlbum = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.88,
    });

    if (result.canceled || !result.assets?.[0]) return;
    setPendingImageUri(result.assets[0].uri);
    setEditingAlbumId(null);
    setDraftMemo('');
    setPickedEmotion(null);
    setEmotionModalVisible(true);
  }, []);

  const openEditAlbum = useCallback((item) => {
    setEditingAlbumId(item.id);
    setPendingImageUri(item.imageUri);
    setDraftMemo(item.memo || '');
    setPickedEmotion(item.emotionId || 'happy');
    setEmotionModalVisible(true);
  }, []);

  const resetEmotionModal = useCallback(() => {
    setEditingAlbumId(null);
    setPendingImageUri(null);
    setDraftMemo('');
    setPickedEmotion(null);
    setEmotionModalVisible(false);
  }, []);

  const submitAlbumEntry = useCallback(() => {
    if (!pickedEmotion) return;
    if (editingAlbumId) {
      updateAlbumItem(editingAlbumId, {
        emotionId: pickedEmotion,
        memo: draftMemo,
      });
      resetEmotionModal();
      return;
    }
    if (!pendingImageUri) return;
    addAlbumItem({
      imageUri: pendingImageUri,
      emotionId: pickedEmotion,
      memo: draftMemo,
    });
    resetEmotionModal();
  }, [
    addAlbumItem,
    draftMemo,
    editingAlbumId,
    pendingImageUri,
    pickedEmotion,
    resetEmotionModal,
    updateAlbumItem,
  ]);

  const openSlotPicker = useCallback((slotIndex) => {
    setActiveSlotIndex(slotIndex);
    setSlotPickerVisible(true);
  }, []);

  const selectAlbumForSlot = useCallback(
    (albumId) => {
      setFourSlotAt(activeSlotIndex, albumId);
      setSlotPickerVisible(false);
    },
    [activeSlotIndex, setFourSlotAt],
  );

  const clearActiveSlot = useCallback(() => {
    setFourSlotAt(activeSlotIndex, null);
    setSlotPickerVisible(false);
  }, [activeSlotIndex, setFourSlotAt]);

  const resolveItem = useCallback(
    (id) => albumItems.find((a) => a.id === id),
    [albumItems],
  );

  return (
    <NotebookLayout>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.pagePad}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleRow}>
          <Text style={styles.emoji}>📷</Text>
          <Text style={styles.pageTitle}>Mood Gallery</Text>
        </View>

        <View style={styles.sectionLabel}>
          <Text style={styles.sectionKicker}>Four-Cut</Text>
          <Text style={styles.sectionTitle}>오늘의 네컷</Text>
          <Text style={styles.sectionHint}>
            슬롯을 눌러 앨범에서 사진·감정·메모 세트를 넣을 수 있어요
          </Text>
        </View>

        <View style={styles.fourCutCard}>
          <Text style={styles.shotTitle}>오늘의 네컷</Text>
          <View style={styles.grid2x2}>
            <View style={styles.gridRow}>
              {[0, 1].map((i) => (
                <FourCutSlot
                  key={i}
                  item={fourSlotIds[i] ? resolveItem(fourSlotIds[i]) : null}
                  onPress={() => openSlotPicker(i)}
                />
              ))}
            </View>
            <View style={styles.gridRow}>
              {[2, 3].map((i) => (
                <FourCutSlot
                  key={i}
                  item={fourSlotIds[i] ? resolveItem(fourSlotIds[i]) : null}
                  onPress={() => openSlotPicker(i)}
                />
              ))}
            </View>
          </View>
        </View>

        <View style={styles.archiveHeader}>
          <Text style={styles.sectionKicker}>Archive</Text>
          <Text style={styles.sectionTitle}>감정 폴라로이드 앨범</Text>
        </View>

        {albumItems.length === 0 ? (
          <Text style={styles.emptyArchive}>
            사진 추가 버튼으로 감정과 메모를 남겨 보세요.
          </Text>
        ) : (
          <View style={styles.archiveGrid}>
            {albumItems.map((item) => (
              <AlbumPolaroid key={item.id} item={item} onPress={() => openEditAlbum(item)} />
            ))}
          </View>
        )}
      </ScrollView>

      {isFocused ? (
        <Portal>
          <FAB
            icon="plus"
            color={notebook.fabLightInk}
            style={[
              styles.fab,
              {
                bottom: insets.bottom + 76,
                right: Math.max(20, insets.right + 10),
              },
            ]}
            onPress={openImagePickerForNewAlbum}
            accessibilityLabel="감정 폴라로이드 사진 추가"
          />
        </Portal>
      ) : null}

      <Modal
        visible={emotionModalVisible}
        transparent
        animationType="fade"
        onRequestClose={resetEmotionModal}
      >
        <KeyboardAvoidingView
          style={styles.modalKeyboardRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
        >
          <Pressable style={styles.modalBackdrop} onPress={resetEmotionModal}>
            <Pressable style={styles.emotionModalInner} onPress={(e) => e.stopPropagation()}>
              <ScrollView
                style={styles.emotionModalScroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bounces={false}
                nestedScrollEnabled
                contentContainerStyle={[
                  styles.emotionModalScrollContent,
                  { paddingBottom: Math.max(16, insets.bottom + 12) },
                ]}
              >
                <View style={styles.emotionSheet}>
                  <Text style={styles.modalTitle}>
                    {editingAlbumId ? '폴라로이드 수정' : '메모와 감정을 남겨 주세요'}
                  </Text>
                  <TextInput
                    value={draftMemo}
                    onChangeText={setDraftMemo}
                    placeholder="짧은 메모..."
                    placeholderTextColor={notebook.inkLight}
                    maxLength={120}
                    multiline
                    style={styles.memoField}
                  />
                  <Text style={styles.modalSub}>감정 선택</Text>
                  <View style={styles.emotionGrid}>
                    {moodOrder.map((id) => {
                      const m = moodPalette[id];
                      const selected = pickedEmotion === id;
                      return (
                        <Pressable
                          key={id}
                          onPress={() => setPickedEmotion(id)}
                          style={({ pressed }) => [
                            styles.emotionChip,
                            { backgroundColor: m.bg, borderColor: m.border },
                            selected && styles.emotionChipSelected,
                            pressed && { opacity: 0.88 },
                          ]}
                        >
                          <Text style={[styles.emotionChipLabel, { color: m.ink }]}>{m.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Pressable
                    onPress={submitAlbumEntry}
                    disabled={!pickedEmotion}
                    style={({ pressed }) => [
                      styles.submitBtn,
                      !pickedEmotion && styles.submitBtnDisabled,
                      pressed && pickedEmotion && { opacity: 0.9 },
                    ]}
                  >
                    <Text style={styles.submitBtnText}>{editingAlbumId ? '저장' : '앨범에 추가'}</Text>
                  </Pressable>
                  <Pressable onPress={resetEmotionModal} style={styles.modalCancel}>
                    <Text style={styles.modalCancelText}>취소</Text>
                  </Pressable>
                </View>
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={slotPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSlotPickerVisible(false)}
      >
        <View style={styles.slotModalRoot}>
          <Pressable style={styles.slotModalBackdrop} onPress={() => setSlotPickerVisible(false)} />
          <View style={[styles.slotSheet, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.modalTitle}>앨범에서 선택</Text>
            <Text style={styles.slotModalSub}>
              네컷 {activeSlotIndex + 1}번 슬롯 (사진·감정·메모)
            </Text>
            {fourSlotIds[activeSlotIndex] ? (
              <Pressable style={styles.clearSlotBtn} onPress={clearActiveSlot}>
                <Text style={styles.clearSlotBtnText}>이 슬롯 비우기</Text>
              </Pressable>
            ) : null}
            {albumItems.length === 0 ? (
              <Text style={styles.emptyPicker}>앨범에 사진을 먼저 추가해 주세요.</Text>
            ) : (
              <FlatList
                data={albumItems}
                keyExtractor={(it) => it.id}
                numColumns={3}
                contentContainerStyle={styles.pickerGrid}
                columnWrapperStyle={styles.pickerRow}
                renderItem={({ item }) => {
                  const eid = item.emotionId || 'happy';
                  const border = moodPalette[eid]?.border ?? moodPalette.happy.border;
                  return (
                    <Pressable
                      style={({ pressed }) => [
                        styles.pickerThumbWrap,
                        { borderColor: border },
                        pressed && { opacity: 0.9 },
                      ]}
                      onPress={() => selectAlbumForSlot(item.id)}
                    >
                      <Image source={{ uri: item.imageUri }} style={styles.pickerThumb} />
                    </Pressable>
                  );
                }}
              />
            )}
            <Pressable style={styles.modalCloseBtn} onPress={() => setSlotPickerVisible(false)}>
              <Text style={styles.modalCloseText}>닫기</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </NotebookLayout>
  );
}

function FourCutSlot({ item, onPress }) {
  const eid = item?.emotionId || 'happy';
  const pal = moodPalette[eid] ?? moodPalette.happy;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.emptySlotOuter,
        pressed && { opacity: 0.92 },
      ]}
    >
      {item ? (
        <View style={styles.slotColumn}>
          <View style={[styles.slotPolaroidInner, { borderColor: pal.border }]}>
            <Image source={{ uri: item.imageUri }} style={styles.slotImage} resizeMode="cover" />
          </View>
          <MemoTimeCaption
            memo={item.memo}
            timestamp={item.timestamp}
            memoColor={pal.ink}
            timeColor={notebook.inkMuted}
          />
        </View>
      ) : (
        <View style={styles.emptySlotInner}>
          <Text style={styles.plus}>＋</Text>
        </View>
      )}
    </Pressable>
  );
}

function AlbumPolaroid({ item, onPress }) {
  const eid = item.emotionId || 'happy';
  const pal = moodPalette[eid] ?? moodPalette.happy;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.polaroid, pressed && { opacity: 0.94 }]}
      accessibilityRole="button"
      accessibilityLabel="폴라로이드 수정"
    >
      <View
        style={[
          styles.polaroidUnified,
          {
            borderColor: pal.border,
            shadowColor: pal.border,
          },
        ]}
      >
        <View style={styles.polaroidPhotoSection}>
          <View style={styles.polaroidArchivePhotoInner}>
            <Image source={{ uri: item.imageUri }} style={styles.polaroidImage} resizeMode="cover" />
          </View>
        </View>
        <View style={[styles.polaroidCaptionBar, { backgroundColor: pal.bg }]}>
          <ArchiveMemoTimeCaption
            memo={item.memo}
            timestamp={item.timestamp}
            memoColor={pal.ink}
            timeColor={notebook.inkMuted}
          />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  pagePad: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 112,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 18,
  },
  emoji: {
    fontSize: 18,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: notebook.ink,
  },
  sectionLabel: {
    marginBottom: 12,
  },
  sectionKicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: notebook.inkLight,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: notebook.ink,
    marginTop: 2,
  },
  sectionHint: {
    marginTop: 6,
    fontSize: 13,
    color: notebook.inkMuted,
  },
  fourCutCard: {
    borderRadius: 16,
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 28,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.07,
        shadowRadius: 12,
      },
      android: { elevation: 3 },
    }),
  },
  shotTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: notebook.ink,
    textAlign: 'center',
    marginBottom: 14,
  },
  grid2x2: {
    gap: 10,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 10,
  },
  emptySlotOuter: {
    flex: 1,
  },
  slotColumn: {
    flex: 1,
  },
  emptySlotInner: {
    aspectRatio: 1,
    borderRadius: 14,
    backgroundColor: '#f4f6f8',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e8ecf0',
  },
  slotPolaroidInner: {
    aspectRatio: 1,
    width: '100%',
    borderRadius: 14,
    borderWidth: 3,
    padding: 3,
    backgroundColor: '#fff',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
    }),
  },
  slotImage: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  plus: {
    fontSize: 28,
    color: notebook.inkLight,
    fontWeight: '300',
  },
  archiveHeader: {
    marginBottom: 14,
  },
  emptyArchive: {
    fontSize: 14,
    color: notebook.inkMuted,
    textAlign: 'center',
    paddingVertical: 24,
    lineHeight: 20,
  },
  archiveGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 16,
  },
  polaroid: {
    width: '48%',
    marginBottom: 4,
  },
  polaroidUnified: {
    borderRadius: 14,
    borderWidth: 3,
    backgroundColor: '#fff',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  polaroidPhotoSection: {
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: '#fff',
  },
  polaroidArchivePhotoInner: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#f0f2f5',
  },
  polaroidImage: {
    width: '100%',
    height: '100%',
  },
  polaroidCaptionBar: {
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 12,
    minHeight: 48,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(15, 23, 42, 0.08)',
    opacity: 0.98,
  },
  fab: {
    position: 'absolute',
    margin: 0,
    backgroundColor: notebook.fabLight,
  },
  modalKeyboardRoot: {
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  emotionModalInner: {
    width: '100%',
    maxWidth: '100%',
  },
  emotionModalScroll: {
    width: '100%',
    maxWidth: '100%',
  },
  emotionModalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emotionSheet: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: notebook.ink,
    textAlign: 'center',
    marginBottom: 12,
  },
  modalSub: {
    fontSize: 13,
    fontWeight: '600',
    color: notebook.inkMuted,
    marginBottom: 8,
  },
  memoField: {
    borderWidth: 1,
    borderColor: notebook.gridLine,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: notebook.ink,
    minHeight: 72,
    textAlignVertical: 'top',
    marginBottom: 14,
  },
  emotionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  emotionChip: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 2,
    minWidth: '28%',
    alignItems: 'center',
  },
  emotionChipSelected: {
    borderWidth: 3,
    transform: [{ scale: 1.02 }],
  },
  emotionChipLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  submitBtn: {
    marginTop: 16,
    backgroundColor: notebook.ink,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.4,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  modalCancel: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 10,
  },
  modalCancelText: {
    fontSize: 15,
    color: notebook.inkLight,
    fontWeight: '600',
  },
  slotModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  slotModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  slotSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 18,
    maxHeight: '72%',
  },
  slotModalSub: {
    fontSize: 13,
    color: notebook.inkMuted,
    textAlign: 'center',
    marginBottom: 10,
  },
  clearSlotBtn: {
    alignSelf: 'center',
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  clearSlotBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#c45c5c',
  },
  emptyPicker: {
    textAlign: 'center',
    color: notebook.inkMuted,
    paddingVertical: 24,
  },
  pickerGrid: {
    paddingBottom: 8,
  },
  pickerRow: {
    gap: 8,
    marginBottom: 8,
    justifyContent: 'space-between',
  },
  pickerThumbWrap: {
    flexGrow: 1,
    flexBasis: '31%',
    maxWidth: '32%',
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 3,
    padding: 2,
    backgroundColor: '#fff',
  },
  pickerThumb: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  modalCloseBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: '700',
    color: notebook.ink,
  },
});
