import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  TextInput,
  Modal,
  Image,
  FlatList,
} from 'react-native';
import useAppStore from '../stores/appStore';
import apiService from '../services/api';

interface Props {
  navigation: {
    navigate: (screen: string, params?: any) => void;
    goBack: () => void;
  };
}

export default function SettingsScreen({ navigation }: Props) {
  const {
    models,
    activeModelId,
    setActiveModel,
    updateModelName,
    deleteModel,
    addModel,
    generationRequests,
  } = useAppStore();

  const [expandedModelId, setExpandedModelId] = useState<string | null>(null);
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [viewingPhotosModelId, setViewingPhotosModelId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleModelPress = (modelId: string) => {
    if (expandedModelId === modelId) {
      setExpandedModelId(null);
    } else {
      setExpandedModelId(modelId);
    }
  };

  const handleSetActive = (modelId: string) => {
    setActiveModel(modelId);
    setExpandedModelId(null);
  };

  const handleStartRename = (modelId: string, currentName: string) => {
    setEditingModelId(modelId);
    setEditingName(currentName);
  };

  const handleSaveRename = () => {
    if (editingModelId && editingName.trim()) {
      updateModelName(editingModelId, editingName.trim());
      setEditingModelId(null);
      setEditingName('');
    }
  };

  const handleCancelRename = () => {
    setEditingModelId(null);
    setEditingName('');
  };

  const handleDeleteModel = (modelId: string, modelName: string) => {
    Alert.alert(
      'Delete Model',
      `Are you sure you want to delete "${modelName}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteModel(modelId);
            setExpandedModelId(null);
          },
        },
      ]
    );
  };

  const handleViewPhotos = (modelId: string) => {
    setViewingPhotosModelId(modelId);
  };

  const handleClosePhotos = () => {
    setViewingPhotosModelId(null);
  };

  const handleTrainNewModel = () => {
    navigation.navigate('Camera');
  };

  const handleSyncModels = async () => {
    if (isSyncing) return;
    
    try {
      setIsSyncing(true);
      const result = await apiService.getCompletedModels();
      
      if (result?.success && result.models.length > 0) {
        let addedCount = 0;
        
        for (const model of result.models) {
          // Check if model already exists
          const existingModel = models.find(m => m.modelVersion === model.modelVersion);
          if (!existingModel) {
            addModel({
              name: model.modelName,
              modelVersion: model.modelVersion,
              triggerWord: model.triggerWord,
              trainingPhotos: [], // No training photos available from recovery
              createdAt: model.createdAt,
              isActive: models.length === 0, // Set as active if no other models
            });
            addedCount++;
          }
        }
        
        if (addedCount > 0) {
          Alert.alert(
            '✅ Models Synced',
            `Added ${addedCount} completed model${addedCount === 1 ? '' : 's'} to your collection.`
          );
        } else {
          Alert.alert(
            'ℹ️ All Caught Up',
            'No new completed models found to sync.'
          );
        }
      } else {
        Alert.alert(
          'ℹ️ No Models Found',
          'No completed training models found on the server.'
        );
      }
    } catch (error) {
      console.error('Sync models error:', error);
      Alert.alert(
        '❌ Sync Failed',
        'Could not sync models from server. Please try again.'
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const renderModelPhotos = (photos: string[]) => {
    return (
      <View style={styles.photoGrid}>
        {photos.map((photo, index) => (
          <View key={index} style={styles.photoThumbnailContainer}>
            <Image source={{ uri: photo }} style={styles.photoThumbnail} />
          </View>
        ))}
      </View>
    );
  };

  const viewingModel = models.find(m => m.id === viewingPhotosModelId);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Your AI Models</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Generations link */}
          <TouchableOpacity
            style={styles.navRow}
            onPress={() => navigation.navigate('Generating')}
            activeOpacity={0.7}
          >
            <Text style={styles.navRowIcon}>✨</Text>
            <View style={styles.navRowContent}>
              <Text style={styles.navRowLabel}>Generations</Text>
              <Text style={styles.navRowSub}>
                View in-progress &amp; completed images
              </Text>
            </View>
            {generationRequests.filter(
              (r) => r.status === 'pending' || r.status === 'generating'
            ).length > 0 && (
              <View style={styles.navBadge}>
                <Text style={styles.navBadgeText}>
                  {generationRequests.filter(
                    (r) => r.status === 'pending' || r.status === 'generating'
                  ).length}
                </Text>
              </View>
            )}
            <Text style={styles.navArrow}>→</Text>
          </TouchableOpacity>

          {/* MY MODELS Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>MY MODELS</Text>
            
            {models.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateIcon}>🤖</Text>
                <Text style={styles.emptyStateTitle}>No Models Yet</Text>
                <Text style={styles.emptyStateSubtitle}>
                  Train your first AI model to start creating transformations
                </Text>
              </View>
            ) : (
              models.map((model) => (
                <View key={model.id} style={styles.modelContainer}>
                  <TouchableOpacity
                    style={[
                      styles.modelRow,
                      model.isActive && styles.modelRowActive,
                      expandedModelId === model.id && styles.modelRowExpanded,
                    ]}
                    onPress={() => handleModelPress(model.id)}
                  >
                    {/* Photo thumbnails */}
                    <View style={styles.thumbnailsRow}>
                      {model.trainingPhotos.slice(0, 5).map((photo, index) => (
                        <View key={index} style={styles.thumbnailContainer}>
                          <Image source={{ uri: photo }} style={styles.thumbnail} />
                        </View>
                      ))}
                    </View>

                    {/* Model info */}
                    <View style={styles.modelInfo}>
                      {editingModelId === model.id ? (
                        <View style={styles.editingContainer}>
                          <TextInput
                            style={styles.editInput}
                            value={editingName}
                            onChangeText={setEditingName}
                            placeholder="Model name"
                            placeholderTextColor="rgba(255, 255, 255, 0.4)"
                            autoFocus
                          />
                          <View style={styles.editButtons}>
                            <TouchableOpacity onPress={handleSaveRename} style={styles.editButton}>
                              <Text style={styles.editButtonText}>✓</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleCancelRename} style={styles.editButton}>
                              <Text style={styles.editButtonText}>✕</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : (
                        <>
                          <View style={styles.modelHeader}>
                            <Text style={styles.modelName}>{model.name}</Text>
                            {model.isActive && (
                              <View style={styles.activeIndicator}>
                                <Text style={styles.activeIndicatorText}>✓</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.modelTrigger}>Trigger: {model.triggerWord}</Text>
                          <Text style={styles.modelDate}>
                            Created {new Date(model.createdAt).toLocaleDateString()}
                          </Text>
                        </>
                      )}
                    </View>

                    {/* Expand indicator */}
                    <Text style={styles.expandIcon}>
                      {expandedModelId === model.id ? '▼' : '▶'}
                    </Text>
                  </TouchableOpacity>

                  {/* Expanded actions */}
                  {expandedModelId === model.id && (
                    <View style={styles.actionsContainer}>
                      {!model.isActive && (
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={() => handleSetActive(model.id)}
                        >
                          <Text style={styles.actionButtonIcon}>✓</Text>
                          <Text style={styles.actionButtonText}>Set as Active</Text>
                        </TouchableOpacity>
                      )}
                      
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleStartRename(model.id, model.name)}
                      >
                        <Text style={styles.actionButtonIcon}>✏️</Text>
                        <Text style={styles.actionButtonText}>Rename</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleViewPhotos(model.id)}
                      >
                        <Text style={styles.actionButtonIcon}>📸</Text>
                        <Text style={styles.actionButtonText}>View Training Photos</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.actionButton, styles.deleteButton]}
                        onPress={() => handleDeleteModel(model.id, model.name)}
                      >
                        <Text style={styles.actionButtonIcon}>🗑️</Text>
                        <Text style={[styles.actionButtonText, styles.deleteButtonText]}>
                          Delete Model
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        </ScrollView>

        {/* Sync Button */}
        <View style={styles.syncSection}>
          <TouchableOpacity 
            style={[styles.syncButton, isSyncing && styles.syncButtonDisabled]} 
            onPress={handleSyncModels}
            disabled={isSyncing}
          >
            <Text style={styles.syncButtonText}>
              {isSyncing ? '🔄 Syncing...' : '📥 Sync Missing Models'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Train New Model Button */}
        <View style={styles.bottomSection}>
          <TouchableOpacity style={styles.trainButton} onPress={handleTrainNewModel}>
            <Text style={styles.trainButtonText}>+ Train New Model</Text>
          </TouchableOpacity>
        </View>

        {/* Photo Viewing Modal */}
        <Modal
          visible={viewingPhotosModelId !== null}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <View style={styles.modalContainer}>
            <SafeAreaView style={styles.modalSafeArea}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  Training Photos - {viewingModel?.name}
                </Text>
                <TouchableOpacity onPress={handleClosePhotos}>
                  <Text style={styles.modalCloseButton}>✕</Text>
                </TouchableOpacity>
              </View>
              
              {viewingModel && (
                <ScrollView style={styles.modalContent}>
                  <View style={styles.largePhotoGrid}>
                    {viewingModel.trainingPhotos.map((photo, index) => (
                      <View key={index} style={styles.largePhotoContainer}>
                        <Image source={{ uri: photo }} style={styles.largePhoto} />
                      </View>
                    ))}
                  </View>
                </ScrollView>
              )}
            </SafeAreaView>
          </View>
        </Modal>
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
    width: 24,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  navRowIcon: {
    fontSize: 22,
  },
  navRowContent: {
    flex: 1,
  },
  navRowLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  navRowSub: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.4)',
  },
  navBadge: {
    backgroundColor: '#FF4D6D',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  navBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  navArrow: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.3)',
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.6)',
    letterSpacing: 1,
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    lineHeight: 20,
  },
  modelContainer: {
    marginBottom: 12,
  },
  modelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  modelRowActive: {
    borderColor: '#FF4D6D',
    backgroundColor: 'rgba(255, 77, 109, 0.1)',
  },
  modelRowExpanded: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  thumbnailsRow: {
    flexDirection: 'row',
    marginRight: 12,
  },
  thumbnailContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    marginRight: -8,
    borderWidth: 2,
    borderColor: '#FF4D6D',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  modelInfo: {
    flex: 1,
    marginRight: 12,
  },
  modelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  modelName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  activeIndicator: {
    backgroundColor: '#FF4D6D',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  activeIndicatorText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  modelTrigger: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 2,
  },
  modelDate: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.4)',
  },
  expandIcon: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  editingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#FFFFFF',
    fontSize: 16,
    marginRight: 8,
  },
  editButtons: {
    flexDirection: 'row',
  },
  editButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginLeft: 4,
  },
  editButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  actionsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  actionButtonIcon: {
    fontSize: 16,
    marginRight: 12,
    width: 20,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  deleteButton: {},
  deleteButtonText: {
    color: '#FF6B6B',
  },
  syncSection: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  syncButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  syncButtonDisabled: {
    opacity: 0.6,
  },
  syncButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  bottomSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 24,
  },
  trainButton: {
    backgroundColor: '#FF4D6D',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  trainButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#0F1629',
  },
  modalSafeArea: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalCloseButton: {
    fontSize: 18,
    color: '#FFFFFF',
    padding: 4,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  largePhotoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  largePhotoContainer: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  largePhoto: {
    width: '100%',
    height: '100%',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoThumbnailContainer: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
  },
  photoThumbnail: {
    width: '100%',
    height: '100%',
  },
});