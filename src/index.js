import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import SettingsScreen from './settings';
import WatchingScreen from './watch';
import StreamingScreen from './stream';
import { LogBox } from 'react-native';
LogBox.ignoreLogs(['new NativeEventEmitter']); // Ignore log notification by message
LogBox.ignoreAllLogs(); //Ignore all log notifications

const Tab = createBottomTabNavigator();

export default function App() {
    return (
        <NavigationContainer>
            <Tab.Navigator>
                <Tab.Screen name="Settings" component={SettingsScreen} />
                <Tab.Screen name="Stream" component={StreamingScreen} />
                <Tab.Screen name="Watch" component={WatchingScreen} />
            </Tab.Navigator>
        </NavigationContainer>
    );
}
