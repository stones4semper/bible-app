import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { colors } from './src/utils/colors';

const Stack = createNativeStackNavigator();

export default function App() { 
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>          
        <StatusBar 
          style={"dark"}
          backgroundColor={colors.primary}
        />
        
        <NavigationContainer>
          <Stack.Navigator 
            initialRouteName="Books" 
            screenOptions={{
              headerShown: false, 
              contentStyle: {
                backgroundColor: colors.primary,
              },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen 
              name="Books" 
              getComponent={() => require('./src/screens/Books').default}
            />
            <Stack.Screen 
              name="Chapters" 
              getComponent={() => require('./src/screens/Chapters').default}
            />
            <Stack.Screen 
              name="Verses" 
              getComponent={() => require('./src/screens/Verses').default}
            />
            <Stack.Screen 
              name="Search" 
              getComponent={() => require('./src/screens/Search').default}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}