import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <NavigationContainer>
          <Stack.Navigator 
            initialRouteName="Books" 
            screenOptions={{
              headerShown: false, 
              contentStyle: {
                backgroundColor: '#F8F6F2', 
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