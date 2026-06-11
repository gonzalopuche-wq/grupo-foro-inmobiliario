import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Cómo se muestran las notificaciones con la app abierta.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Pide permiso, obtiene el Expo Push Token y lo guarda en Supabase para el usuario actual.
export async function registrarPush(): Promise<void> {
  try {
    if (!Device.isDevice) return; // los emuladores no reciben push reales

    const actual = await Notifications.getPermissionsAsync();
    let status = actual.status;
    if (status !== 'granted') {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'General',
        importance: Notifications.AndroidImportance.DEFAULT,
        lightColor: '#990000',
      });
    }

    const projectId =
      (Constants.expoConfig as any)?.extra?.eas?.projectId ??
      (Constants as any)?.easConfig?.projectId;
    const resp = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    const token = resp.data;

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user || !token) return;

    // Vía RPC SECURITY DEFINER: reasigna el token al usuario actual aunque en este
    // dispositivo lo hubiera registrado otro usuario antes (la tabla sigue siendo
    // "solo lo propio" para acceso directo).
    const { error } = await supabase.rpc('registrar_push_token', {
      p_token: token,
      p_plataforma: Platform.OS,
    });
    if (error) console.warn('[push] no se pudo guardar el token', error.message);
  } catch (e) {
    console.warn('[push] no se pudo registrar el token', e);
  }
}
