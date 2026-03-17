import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  FlatList,
  Image,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import useAppStore, {
  GenerationRequest,
  GenerationRequestStatus,
} from '../stores/appStore';
import apiService from '../services/api';

const { width } = Dimensions.get('window');

interface Props {
  navigation: {
    navigate: (screen: string, params?: any) => void;
    goBack: () => void;
  };
  route?: {
    params?: {
      newRequestId?: string;
    };
  };
}

function StatusBadge({ status }: { status: GenerationRequestStatus }) {
  const config: Record<
    GenerationRequestStatus,
    { bg: string; text: string; label: string }
  > = {
    pending: {
      bg: 'rgba(255, 193, 7, 0.15)',
      text: '#FFC107',
      label: 'Queued',
    },
    generating: {
      bg: 'rgba(255, 77, 109, 0.15)',
      text: '#FF4D6D',
      label: 'Generating...',
    },
    completed: {
      bg: 'rgba(76, 217, 100, 0.15)',
      text: '#4CD964',
      label: 'Ready',
    },
    failed: {
      bg: 'rgba(255, 59, 48, 0.15)',
      text: '#FF3B30',
      label: 'Failed',
    },
  };

  const c = config[status];

  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      {status === 'generating' && (
        <ActivityIndicator size={10} color={c.text} style={{ marginRight: 4 }} />
      )}
      <Text style={[styles.badgeText, { color: c.text }]}>{c.label}</Text>
    </View>
  );
}

function PulsingDot() {
  const anim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={[styles.pulsingDot, { opacity: anim }]}
    />
  );
}

export default function GeneratingScreen({ navigation, route }: Props) {
  const {
    generationRequests,
    updateGenerationRequest,
    addToHistory,
    clearCompletedRequests,
    removeGenerationRequest,
    getActiveModel,
  } = useAppStore();

  const processedRef = useRef<Set<string>>(new Set());

  // Process any pending requests
  useEffect(() => {
    const pendingRequests = generationRequests.filter(
      (r) => r.status === 'pending' && !processedRef.current.has(r.id)
    );

    pendingRequests.forEach((req) => {
      processedRef.current.add(req.id);
      runGeneration(req);
    });
  }, [generationRequests]);

  const runGeneration = async (req: GenerationRequest) => {
    console.log(`🚀 Generating: model="${req.modelName}" version="${req.modelVersion}" trigger="${req.triggerWord}"`);
    console.log(`📝 Prompt: "${req.prompt}"`);
    updateGenerationRequest(req.id, { status: 'generating' });

    try {
      const result = await apiService.generateTransformation(
        req.modelVersion,
        'custom',
        req.prompt,
        req.triggerWord
      );

      updateGenerationRequest(req.id, {
        status: 'completed',
        imageUrl: result.imageUrl,
        localUri: result.localUri || result.imageUrl,
        seed: result.seed,
        requestId: result.requestId,
        completedAt: new Date().toISOString(),
      });

      addToHistory({
        type: 'custom' as any,
        localUri: result.localUri || result.imageUrl,
        imageUrl: result.imageUrl,
        seed: result.seed,
      });
    } catch (error: any) {
      updateGenerationRequest(req.id, {
        status: 'failed',
        error: error.message || 'Generation failed',
      });
    }
  };

  const handleRetry = (req: GenerationRequest) => {
    processedRef.current.delete(req.id);
    updateGenerationRequest(req.id, {
      status: 'pending',
      error: undefined,
    });
  };

  const handleViewResult = (req: GenerationRequest) => {
    if (req.status === 'completed' && req.imageUrl) {
      navigation.navigate('Results', {
        imageUrl: req.imageUrl,
        type: 'custom',
        seed: req.seed || 0,
        requestId: req.requestId,
        localUri: req.localUri,
        prompt: req.prompt,
      });
    }
  };

  const inProgress = generationRequests.filter(
    (r) => r.status === 'pending' || r.status === 'generating'
  );
  const completed = generationRequests.filter(
    (r) => r.status === 'completed'
  );
  const failed = generationRequests.filter((r) => r.status === 'failed');

  const renderRequest = ({ item }: { item: GenerationRequest }) => {
    const isActive =
      item.status === 'pending' || item.status === 'generating';
    const isDone = item.status === 'completed';
    const isFailed = item.status === 'failed';

    return (
      <TouchableOpacity
        style={[styles.requestCard, isDone && styles.requestCardCompleted]}
        onPress={() => isDone && handleViewResult(item)}
        activeOpacity={isDone ? 0.7 : 1}
        disabled={!isDone}
      >
        <View style={styles.requestCardContent}>
          {/* Thumbnail or spinner */}
          <View style={styles.requestThumb}>
            {isDone && item.imageUrl ? (
              <Image
                source={{ uri: item.localUri || item.imageUrl }}
                style={styles.thumbImage}
              />
            ) : isActive ? (
              <View style={styles.spinnerContainer}>
                <PulsingDot />
              </View>
            ) : (
              <View style={styles.failedThumb}>
                <Text style={styles.failedIcon}>!</Text>
              </View>
            )}
          </View>

          {/* Info */}
          <View style={styles.requestInfo}>
            <Text style={styles.requestPrompt} numberOfLines={2}>
              {item.chipLabel || item.prompt}
            </Text>
            <View style={styles.requestMeta}>
              <Text style={styles.requestModel}>{item.modelName}</Text>
              <StatusBadge status={item.status} />
            </View>
            {isFailed && item.error && (
              <Text style={styles.errorText} numberOfLines={1}>
                {item.error}
              </Text>
            )}
          </View>

          {/* Actions */}
          <View style={styles.requestActions}>
            {isDone && (
              <Text style={styles.viewArrow}>→</Text>
            )}
            {isFailed && (
              <TouchableOpacity
                style={styles.retrySmall}
                onPress={() => handleRetry(item)}
              >
                <Text style={styles.retrySmallText}>↻</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const allRequests = [
    ...inProgress,
    ...failed,
    ...completed,
  ];

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Generations</Text>
          {completed.length > 0 ? (
            <TouchableOpacity onPress={clearCompletedRequests}>
              <Text style={styles.clearText}>Clear Done</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.headerSpacer} />
          )}
        </View>

        {/* Active generation banner */}
        {inProgress.length > 0 && (
          <View style={styles.activeBanner}>
            <ActivityIndicator size="small" color="#FF4D6D" />
            <Text style={styles.activeBannerText}>
              {inProgress.length === 1
                ? '1 generation in progress'
                : `${inProgress.length} generations in progress`}
            </Text>
          </View>
        )}

        {allRequests.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>✨</Text>
            <Text style={styles.emptyTitle}>No Generations Yet</Text>
            <Text style={styles.emptySubtitle}>
              Go to the editor and create a transformation
            </Text>
            <TouchableOpacity
              style={styles.editorButton}
              onPress={() => navigation.navigate('Editor')}
              activeOpacity={0.8}
            >
              <Text style={styles.editorButtonText}>Open Editor</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={allRequests}
            renderItem={renderRequest}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        )}

        {/* Bottom bar */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.newGenerationButton}
            onPress={() => navigation.navigate('Editor')}
            activeOpacity={0.8}
          >
            <Text style={styles.newGenIcon}>✨</Text>
            <Text style={styles.newGenText}>New Generation</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1629',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButton: {
    fontSize: 24,
    color: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerSpacer: {
    width: 60,
  },
  clearText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '500',
  },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 77, 109, 0.1)',
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 77, 109, 0.15)',
  },
  activeBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FF4D6D',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  separator: {
    height: 8,
  },
  requestCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  requestCardCompleted: {
    borderWidth: 1,
    borderColor: 'rgba(76, 217, 100, 0.15)',
  },
  requestCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  requestThumb: {
    width: 52,
    height: 52,
    borderRadius: 12,
    overflow: 'hidden',
  },
  thumbImage: {
    width: 52,
    height: 52,
    borderRadius: 12,
  },
  spinnerContainer: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 77, 109, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulsingDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF4D6D',
  },
  failedThumb: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  failedIcon: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FF3B30',
  },
  requestInfo: {
    flex: 1,
  },
  requestPrompt: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 6,
    lineHeight: 18,
  },
  requestMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requestModel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.35)',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  errorText: {
    fontSize: 11,
    color: '#FF3B30',
    marginTop: 4,
  },
  requestActions: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 32,
  },
  viewArrow: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.4)',
    fontWeight: '600',
  },
  retrySmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 77, 109, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  retrySmallText: {
    fontSize: 18,
    color: '#FF4D6D',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.4)',
    textAlign: 'center',
    marginBottom: 32,
  },
  editorButton: {
    backgroundColor: '#FF4D6D',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 14,
  },
  editorButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  newGenerationButton: {
    flexDirection: 'row',
    backgroundColor: '#FF4D6D',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  newGenIcon: {
    fontSize: 16,
  },
  newGenText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
