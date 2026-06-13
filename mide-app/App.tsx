import 'react-native-url-polyfill/auto';
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFonts, Montserrat_700Bold, Montserrat_800ExtraBold } from '@expo-google-fonts/montserrat';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { StatusBar } from 'expo-status-bar';
import type { Session } from '@supabase/supabase-js';

import { supabase } from './lib/supabase';
import { C, F } from './lib/theme';
import { RelevamientoProvider } from './state/relevamiento';

import LoginScreen from './screens/LoginScreen';
import RelevamientosScreen from './screens/RelevamientosScreen';
import MedicionScreen from './screens/MedicionScreen';
import PlanoScreen from './screens/PlanoScreen';
import Tour3DScreen from './screens/Tour3DScreen';
import DescripcionScreen from './screens/DescripcionScreen';

export type RootStackParamList = {
  Relevamientos: undefined;
  Medicion: undefined;
  Plano: undefined;
  Tour3D: undefined;
  Descripcion: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const NAV_THEME = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    background: C.bg,
    card: 'rgba(5,5,5,0.98)',
    text: '#ffffff',
    border: 'rgba(255,255,255,0.07)',
    primary: C.red,
    notification: C.red,
  },
};

const headerOpts = {
  headerStyle: { backgroundColor: 'rgba(5,5,5,0.98)' },
  headerTintColor: '#fff',
  headerTitleStyle: { fontFamily: F.bold, fontSize: 16 },
} as const;

function MainStack() {
  return (
    <Stack.Navigator screenOptions={headerOpts}>
      <Stack.Screen name="Relevamientos" component={RelevamientosScreen} options={{ title: 'GFI MIDE' }} />
      <Stack.Screen name="Medicion" component={MedicionScreen} options={{ title: 'Medir ambientes' }} />
      <Stack.Screen name="Plano" component={PlanoScreen} options={{ title: 'Plano' }} />
      <Stack.Screen name="Tour3D" component={Tour3DScreen} options={{ title: 'Recorrido 3D' }} />
      <Stack.Screen name="Descripcion" component={DescripcionScreen} options={{ title: 'Descripción IA' }} />
    </Stack.Navigator>
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
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
      {session ? (
        <RelevamientoProvider>
          <MainStack />
        </RelevamientoProvider>
      ) : (
        <AuthStack />
      )}
    </NavigationContainer>
  );
}

const s = StyleSheet.create({
  splash: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
});
