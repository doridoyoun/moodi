import { useCallback, useRef, useState } from 'react';
import {
  Alert,
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
import * as MediaLibrary from 'expo-media-library';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CloudRain,
  Download,
  Flame,
  Heart,
  Leaf,
  Smile,
} from 'lucide-react-native';
import { FAB, Portal } from 'react-native-paper';
import { captureRef } from 'react-native-view-shot';
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

function formatMoodiCanvasDate() {
  return new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
}

const modalEmotionIcons = {
  happy: Smile,
  flutter: Heart,
  calm: Leaf,
  gloom: CloudRain,
  annoyed: Flame,
};

const moodiCanvasStyles = StyleSheet.create({
  canvas: {
    width: 340,
    alignSelf: 'center',
    backgroundColor: notebook.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: notebook.gridLine,
    paddingTop: 16,
    paddingBottom: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  canvasTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: notebook.ink,
    textAlign: 'center',
    letterSpacing: 0.15,
    marginBottom: 10,
  },
  gridWrap: {
    width: '100%',
    gap: 5,
    marginBottom: 2,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 5,
    width: '100%',
  },
  slotOuter: {
    flex: 1,
    minWidth: 0,
  },
  slotFrame: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    borderWidth: 2,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  slotImg: {
    width: '100%',
    height: '100%',
  },
  slotEmpty: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: '#f4f6f8',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e8ecf0',
  },
  slotPlus: {
    fontSize: 26,
    color: notebook.inkLight,
    fontWeight: '300',
  },
  summaryBlock: {
    width: '100%',
    minHeight: 40,
    marginTop: 10,
    marginBottom: 10,
    paddingHorizontal: 6,
    paddingVertical: 6,
    justifyContent: 'center',
  },
  summaryInput: {
    fontSize: 14,
    fontWeight: '500',
    fontStyle: 'italic',
    color: '#5a6570',
    textAlign: 'center',
    lineHeight: 20,
    minHeight: 40,
    paddingVertical: 4,
  },
  summaryTextExport: {
    fontSize: 14,
    fontWeight: '500',
    fontStyle: 'italic',
    color: '#5a6570',
    textAlign: 'center',
    lineHeight: 20,
  },
  footerMeta: {
    width: '100%',
    alignItems: 'center',
    gap: 4,
    paddingTop: 2,
  },
  canvasDate: {
    fontSize: 10,
    fontWeight: '500',
    color: notebook.inkLight,
    letterSpacing: 0.2,
  },
  canvasBrand: {
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 0.9,
    color: notebook.inkLight,
    opacity: 0.65,
  },
});

function MoodiSlotPhoto({ item, onPress }) {
  const eid = item?.emotionId || 'happy';
  const pal = moodPalette[eid] ?? moodPalette.happy;
  const inner = item ? (
    <View style={[moodiCanvasStyles.slotFrame, { borderColor: pal.border }]}>
      <Image source={{ uri: item.imageUri }} style={moodiCanvasStyles.slotImg} resizeMode="cover" />
    </View>
  ) : (
    <View style={moodiCanvasStyles.slotEmpty}>
      <Text style={moodiCanvasStyles.slotPlus}>＋</Text>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [moodiCanvasStyles.slotOuter, pressed && { opacity: 0.92 }]}
      >
        {inner}
      </Pressable>
    );
  }
  return <View style={moodiCanvasStyles.slotOuter}>{inner}</View>;
}

function TodaysMoodiCanvas({ slots, summaryText, onSummaryChange, isExport, onSlotPress }) {
  return (
    <View style={moodiCanvasStyles.canvas} collapsable={false}>
      <Text style={moodiCanvasStyles.canvasTitle}>{"Today's Moodi"}</Text>
      <View style={moodiCanvasStyles.gridWrap}>
        <View style={moodiCanvasStyles.gridRow}>
          <MoodiSlotPhoto item={slots[0]} onPress={onSlotPress ? () => onSlotPress(0) : undefined} />
          <MoodiSlotPhoto item={slots[1]} onPress={onSlotPress ? () => onSlotPress(1) : undefined} />
        </View>
        <View style={moodiCanvasStyles.gridRow}>
          <MoodiSlotPhoto item={slots[2]} onPress={onSlotPress ? () => onSlotPress(2) : undefined} />
          <MoodiSlotPhoto item={slots[3]} onPress={onSlotPress ? () => onSlotPress(3) : undefined} />
        </View>
      </View>
      <View style={moodiCanvasStyles.summaryBlock}>
        {isExport ? (
          <Text style={moodiCanvasStyles.summaryTextExport}>{summaryText.trim() || ' '}</Text>
        ) : (
          <TextInput
            value={summaryText}
            onChangeText={onSummaryChange}
            placeholder="오늘 하루를 한 줄로 적어 보세요"
            placeholderTextColor="rgba(90, 101, 112, 0.45)"
            multiline
            maxLength={120}
            style={moodiCanvasStyles.summaryInput}
          />
        )}
      </View>
      <View style={moodiCanvasStyles.footerMeta}>
        <Text style={moodiCanvasStyles.canvasDate}>{formatMoodiCanvasDate()}</Text>
        <Text style={moodiCanvasStyles.canvasBrand}>Moodi</Text>
      </View>
    </View>
  );
}

/** Archive 폴라로이드 전용 */
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
        ellipsizeMode="tail"
      >
        {line}
      </Text>
      <Text style={[archiveCaptionStyles.time, { color: timeColor }]}>{time}</Text>
    </View>
  );
}

const archiveCaptionStyles = StyleSheet.create({
  centeredStrip: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeSolo: {
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  row: {
    flex: 1,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  memo: {
    flex: 1,
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 15,
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
    clearAllFourSlots,
    moodiDaySummary,
    setMoodiDaySummary,
    addAlbumItem,
    updateAlbumItem,
    deleteAlbumItem,
  } = useMood();

  const [emotionModalVisible, setEmotionModalVisible] = useState(false);
  const [editingAlbumId, setEditingAlbumId] = useState(null);
  const [pendingImageUri, setPendingImageUri] = useState(null);
  const [draftMemo, setDraftMemo] = useState('');
  const [pickedEmotion, setPickedEmotion] = useState(null);

  const [slotPickerVisible, setSlotPickerVisible] = useState(false);
  const [activeSlotIndex, setActiveSlotIndex] = useState(0);

  const moodiCaptureRef = useRef(null);
  const [savingMoodi, setSavingMoodi] = useState(false);

  const saveTodaysMoodiImage = useCallback(async () => {
    if (savingMoodi) return;
    setSavingMoodi(true);
    try {
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('알림', '사진을 저장하려면 갤러리 접근을 허용해 주세요.');
        return;
      }
      const node = moodiCaptureRef.current;
      if (!node) {
        Alert.alert('오류', '저장에 실패했습니다. 다시 시도해 주세요.');
        return;
      }
      const uri = await captureRef(node, {
        format: 'png',
        quality: 1,
      });
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('저장 완료', '저장이 완료되었습니다');
    } catch {
      Alert.alert('오류', '저장에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setSavingMoodi(false);
    }
  }, [savingMoodi]);

  const beginNewAlbumFromImageUri = useCallback((uri) => {
    setPendingImageUri(uri);
    setEditingAlbumId(null);
    setDraftMemo('');
    setPickedEmotion(null);
    setEmotionModalVisible(true);
  }, []);

  const openGalleryForNewAlbum = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('알림', '사진을 선택하려면 갤러리 접근을 허용해 주세요.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.88,
    });

    if (result.canceled || !result.assets?.[0]) return;
    beginNewAlbumFromImageUri(result.assets[0].uri);
  }, [beginNewAlbumFromImageUri]);

  const openCameraForNewAlbum = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('알림', '사진을 촬영하려면 카메라 접근을 허용해 주세요.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.88,
    });

    if (result.canceled || !result.assets?.[0]) return;
    beginNewAlbumFromImageUri(result.assets[0].uri);
  }, [beginNewAlbumFromImageUri]);

  const openAlbumPhotoSourceChooser = useCallback(() => {
    Alert.alert('사진 추가', '', [
      { text: '취소', style: 'cancel' },
      { text: '앨범에서 선택', onPress: () => void openGalleryForNewAlbum() },
      { text: '사진 찍기', onPress: () => void openCameraForNewAlbum() },
    ]);
  }, [openCameraForNewAlbum, openGalleryForNewAlbum]);

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

  const confirmDeletePolaroid = useCallback(() => {
    if (!editingAlbumId) return;
    Alert.alert('폴라로이드 삭제', '이 폴라로이드를 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => {
          deleteAlbumItem(editingAlbumId);
          resetEmotionModal();
        },
      },
    ]);
  }, [deleteAlbumItem, editingAlbumId, resetEmotionModal]);

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

  const confirmClearAllFourSlots = useCallback(() => {
    const hasAny = fourSlotIds.some(Boolean);
    if (!hasAny) return;
    Alert.alert('네컷 비우기', '오늘의 Moodi 슬롯을 모두 비울까요?', [
      { text: '취소', style: 'cancel' },
      { text: '비우기', style: 'destructive', onPress: clearAllFourSlots },
    ]);
  }, [clearAllFourSlots, fourSlotIds]);

  return (
    <NotebookLayout>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.pagePad}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.titleRow}>
          <Text style={styles.emoji}>📷</Text>
          <Text style={styles.pageTitle}>Mood Gallery</Text>
        </View>

        <View style={styles.sectionLabel}>
          <Text style={styles.sectionKicker}>Four-Cut</Text>
          <Text style={styles.sectionTitle}>{"Today's Moodi"}</Text>
          <Text style={styles.sectionHint}>
            슬롯을 눌러 앨범에서 사진·감정·메모 세트를 넣을 수 있어요
          </Text>
        </View>

        <View style={styles.fourCutCard}>
          <View style={styles.moodiCaptureOuter}>
            <TodaysMoodiCanvas
              slots={fourSlotIds.map((id) => (id ? resolveItem(id) : null))}
              summaryText={moodiDaySummary}
              onSummaryChange={setMoodiDaySummary}
              isExport={false}
              onSlotPress={openSlotPicker}
            />
          </View>
          <View style={styles.fourCutTitleRow}>
            <Pressable
              onPress={confirmClearAllFourSlots}
              hitSlop={8}
              style={({ pressed }) => [styles.clearAllSlotsBtn, pressed && { opacity: 0.75 }]}
              accessibilityRole="button"
              accessibilityLabel="네컷 슬롯 전체 비우기"
            >
              <Text style={styles.clearAllSlotsText}>전체 비우기</Text>
            </Pressable>
            <Pressable
              onPress={saveTodaysMoodiImage}
              disabled={savingMoodi}
              style={({ pressed }) => [
                styles.saveMoodiBtn,
                (pressed && !savingMoodi) && { opacity: 0.72 },
                savingMoodi && { opacity: 0.45 },
              ]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={"Today's Moodi 이미지로 저장"}
            >
              <Download size={20} color={notebook.inkMuted} strokeWidth={2} />
            </Pressable>
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

      <View style={styles.moodiShareOffscreen} pointerEvents="none">
        <View ref={moodiCaptureRef} collapsable={false} style={styles.moodiShareCaptureRoot}>
          <TodaysMoodiCanvas
            slots={fourSlotIds.map((id) => (id ? resolveItem(id) : null))}
            summaryText={moodiDaySummary}
            isExport
          />
        </View>
      </View>

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
            onPress={openAlbumPhotoSourceChooser}
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
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={resetEmotionModal}
            accessibilityRole="button"
            accessibilityLabel="닫기"
          />
          <KeyboardAvoidingView
            style={styles.modalKeyboardLayer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
            pointerEvents="box-none"
          >
            <View style={styles.modalSheetOuter} pointerEvents="box-none">
              <Pressable
                style={styles.emotionModalCard}
                onPress={(e) => e.stopPropagation()}
              >
                <ScrollView
                  style={styles.emotionModalScroll}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                  nestedScrollEnabled
                  contentContainerStyle={styles.emotionModalScrollContent}
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
                    <View style={styles.emotionRowModal}>
                      {moodOrder.map((id) => {
                        const m = moodPalette[id];
                        const Icon = modalEmotionIcons[id];
                        const selected = pickedEmotion === id;
                        return (
                          <Pressable
                            key={id}
                            onPress={() => setPickedEmotion(id)}
                            accessibilityLabel={m.label}
                            style={({ pressed }) => [
                              styles.emotionCircleBtn,
                              {
                                backgroundColor: m.bg,
                                borderColor: selected ? m.border : 'rgba(15, 23, 42, 0.12)',
                              },
                              selected && styles.emotionCircleBtnSelected,
                              pressed && { opacity: 0.88 },
                            ]}
                          >
                            <Icon
                              size={22}
                              color={m.ink}
                              strokeWidth={selected ? 2.35 : 2}
                            />
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
                    {editingAlbumId ? (
                      <Pressable
                        onPress={confirmDeletePolaroid}
                        style={({ pressed }) => [styles.modalDeleteBtn, pressed && { opacity: 0.85 }]}
                      >
                        <Text style={styles.modalDeleteText}>삭제</Text>
                      </Pressable>
                    ) : null}
                    <Pressable onPress={resetEmotionModal} style={styles.modalCancel}>
                      <Text style={styles.modalCancelText}>취소</Text>
                    </Pressable>
                  </View>
                </ScrollView>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
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
  fourCutTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  clearAllSlotsBtn: {
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  clearAllSlotsText: {
    fontSize: 13,
    fontWeight: '600',
    color: notebook.inkLight,
  },
  moodiShareOffscreen: {
    position: 'absolute',
    left: -12000,
    top: 0,
  },
  moodiShareCaptureRoot: {
    alignItems: 'center',
  },
  saveMoodiBtn: {
    width: 36,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodiCaptureOuter: {
    width: '100%',
    overflow: 'hidden',
  },
  fourCutCard: {
    borderRadius: 16,
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 36,
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
  archiveHeader: {
    marginTop: 28,
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
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  polaroidUnified: {
    borderRadius: 5,
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
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: '#f0f2f5',
  },
  polaroidImage: {
    width: '100%',
    height: '100%',
  },
  polaroidCaptionBar: {
    height: 54,
    paddingHorizontal: 10,
    paddingVertical: 6,
    justifyContent: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(15, 23, 42, 0.08)',
    opacity: 0.98,
  },
  fab: {
    position: 'absolute',
    margin: 0,
    backgroundColor: notebook.fabLight,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  modalKeyboardLayer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  modalSheetOuter: {
    width: '100%',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  emotionModalCard: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    marginBottom: 8,
  },
  emotionModalScroll: {
    width: '100%',
    maxWidth: '100%',
  },
  emotionModalScrollContent: {
    paddingBottom: 16,
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
  emotionRowModal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  emotionCircleBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  emotionCircleBtnSelected: {
    borderWidth: 2.5,
    transform: [{ scale: 1.06 }],
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
    }),
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
  modalDeleteBtn: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 10,
  },
  modalDeleteText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#c45c5c',
  },
  modalCancel: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 12,
    paddingBottom: 4,
  },
  modalCancelText: {
    fontSize: 15,
    color: notebook.inkLight,
    fontWeight: '600',
  },
  slotModalRoot: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  slotModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  slotSheet: {
    width: '100%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 18,
    maxHeight: '72%',
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
