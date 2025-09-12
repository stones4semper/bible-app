import React from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

const Stack = createNativeStackNavigator()

export default function App(){
	return (
		<GestureHandlerRootView style={{flex:1}}>
			<NavigationContainer>
				<Stack.Navigator initialRouteName="Books" screenOptions={{headerTitleAlign:'center'}}>
					<Stack.Screen name="Books" options={{title:'Books'}} getComponent={()=>require('./src/screens/Books').default}/>
					<Stack.Screen name="Chapters" options={{title:'Chapters'}} getComponent={()=>require('./src/screens/Chapters').default}/>
					<Stack.Screen name="Verses" options={{title:'Verses'}} getComponent={()=>require('./src/screens/Verses').default}/>
					<Stack.Screen name="Search" options={{title:'Search'}} getComponent={()=>require('./src/screens/Search').default}/>
				</Stack.Navigator>
			</NavigationContainer>
		</GestureHandlerRootView>
	)
}
