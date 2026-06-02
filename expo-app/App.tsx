import 'react-native-url-polyfill/auto';
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFonts, Montserrat_700Bold, Montserrat_800ExtraBold } from '@expo-google-fonts/montserrat';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { StatusBar } from 'expo-status-bar';
import type { Session } from '@supabase/supabase-js';

import { supabase } from './lib/supabase';
import { C } from './lib/theme';

import LoginScreen    from './screens/LoginScreen';
import DashboardScreen from './screens/DashboardScreen';
import CRMScreen      from './screens/CRMScreen';
import MIRScreen      from './screens/MIRScreen';
import ComunidadScreen from './screens/ComunidadScreen';
import ForoScreen     from './screens/ForoScreen';
import EventosScreen  from './screens/EventosScreen';
import PerfilScreen   from './screens/PerfilScreen';

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const NAV_THEME = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    background:   C.bg,
    card:         'rgba(5,5,5,0.98)',
    text:         '#ffffff',
    border:       'rgba(255,255,255,0.07)',
    primary:      C.red,
    notification: C.red,
  },
};

function ComunidadStack() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: 'rgba(5,5,5,0.98)' }, headerTintColor: '#fff', headerTitleStyle: { fontFamily: 'Montserrat_700Bold' } }}>
      <Stack.Screen name="Comunidad" component={ComunidadScreen} options={{ title: 'Comunidad' }} />
      <Stack.Screen name="Foro"      component={ForoScreen}      options={{ title: 'Foro GFI' }} />
      <Stack.Screen name="Eventos"   component={EventosScreen}   options={{ title: 'Eventos' }} />
    </Stack.Navigator>
  );
}

function MainTabs() {
  const icon = (emoji: string, focused: boolean) => (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: focused ? 'rgba(153,0,0,0.15)' : 'transparent' }}>
        <View>
          {React.createElement(require('react-native').Text, { style: { fontSize: 20 } }, emoji)}
        </View>
      </View>
    </View>
  );

  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle:        { backgroundColor: 'rgba(5,5,5,0.98)' },
        headerTintColor:    '#fff',
        headerTitleStyle:   { fontFamily: 'Montserrat_700Bold', fontSize: 16 },
        tabBarStyle:        { backgroundColor: 'rgba(5,5,5,0.98)', borderTopColor: 'rgba(255,255,255,0.07)', height: 70, paddingBottom: 10 },
        tabBarActiveTintColor:   C.red,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.32)',
        tabBarLabelStyle:   { fontFamily: 'Montserrat_700Bold', fontSize: 9, letterSpacing: 0.5, marginTop: 2 },
      }}
    >
      <Tab.Screen name="InicioTab" component={DashboardScreen}
        options={{ title: 'Inicio', tabBarLabel: 'Inicio', tabBarIcon: ({ focused }) => icon('🏠', focused) }} />
      <Tab.Screen name="CRMTab" component={CRMScreen}
        options={{ title: 'CRM', tabBarLabel: 'CRM', tabBarIcon: ({ focused }) => icon('👥', focused) }} />
      <Tab.Screen name="MIRTab" component={MIRScreen}
        options={{ title: 'MIR', tabBarLabel: 'MIR', tabBarIcon: ({ focused }) => icon('🔄', focused) }} />
      <Tab.Screen name="ComunidadTab" component={ComunidadStack}
        options={{ title: 'Comunidad', tabBarLabel: 'Comunidad', headerShown: false, tabBarIcon: ({ focused }) => icon('💬', focused) }} />
      <Tab.Screen name="PerfilTab" component={PerfilScreen}
        options={{ title: 'Mi perfil', tabBarLabel: 'Perfil', tabBarIcon: ({ focused }) => icon('👤', focused) }} />
    </Tab.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [fontsLoaded] = useFonts({
    Montserrat_700Bold,
    Montserrat_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => setSession(s));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  if (!fontsLoaded || session === undefined) {
    return (
      <View style={s.splash}>
        <ActivityIndicator color={C.red} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer theme={NAV_THEME}>
      <StatusBar style="light" />
      {session ? <MainTabs /> : <AuthStack />}
    </NavigationContainer>
  );
}

const s = StyleSheet.create({
  splash: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
});
