import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

export type RootStackParamList = {
  Home: undefined;
  Camera: { transformType: string };
  Training: { imageUri: string; transformType: string };
  Editor: { imageUri?: string };
  Generating: { newRequestId?: string };
  Settings: undefined;
  Results: {
    imageUrl: string;
    type: string;
    seed: number;
    requestId?: string;
    prompt?: string;
    localUri?: string;
  };
  History: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

import HomeScreen from './src/screens/HomeScreen';
import CameraScreen from './src/screens/CameraScreen';
import TrainingScreen from './src/screens/TrainingScreen';
import EditorScreen from './src/screens/EditorScreen';
import GeneratingScreen from './src/screens/GeneratingScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import ResultsScreen from './src/screens/ResultsScreen';
import HistoryScreen from './src/screens/HistoryScreen';

const DarkTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#0F1629',
    card: '#0F1629',
    text: '#FFFFFF',
    border: 'transparent',
    primary: '#FF4D6D',
  },
};

export default function App() {
  return (
    <NavigationContainer theme={DarkTheme}>
      <StatusBar style="light" />
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: '#0F1629' },
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen
          name="Camera"
          component={CameraScreen}
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen name="Training" component={TrainingScreen} />
        <Stack.Screen name="Editor" component={EditorScreen} />
        <Stack.Screen name="Generating" component={GeneratingScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="Results" component={ResultsScreen} />
        <Stack.Screen name="History" component={HistoryScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
