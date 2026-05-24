import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { C, F } from '../lib/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgot, setForgot] = useState(false);

  const login = async () => {
    if (!email || !password) { Alert.alert('Completá email y contraseña'); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    setLoading(false);
    if (error) Alert.alert('Error', error.message === 'Invalid login credentials' ? 'Email o contraseña incorrectos' : error.message);
  };

  const resetPassword = async () => {
    if (!email) { Alert.alert('Ingresá tu email'); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
    setLoading(false);
    if (error) Alert.alert('Error', error.message);
    else { Alert.alert('Listo', 'Revisá tu email para restablecer la contraseña'); setForgot(false); }
  };

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.logoWrap}>
          <Text style={s.logoGfi}>GFI<Text style={{ color: C.red }}>®</Text></Text>
          <Text style={s.logoSub}>Grupo Foro Inmobiliario</Text>
        </View>

        {!forgot ? (
          <>
            <Text style={s.title}>Iniciar sesión</Text>
            <TextInput
              style={s.input}
              placeholder="Email"
              placeholderTextColor={C.textDim}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
            />
            <TextInput
              style={s.input}
              placeholder="Contraseña"
              placeholderTextColor={C.textDim}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={login} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>Entrar</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setForgot(true)} style={s.forgotBtn}>
              <Text style={s.forgotTxt}>¿Olvidaste tu contraseña?</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={s.title}>Recuperar contraseña</Text>
            <TextInput
              style={s.input}
              placeholder="Tu email"
              placeholderTextColor={C.textDim}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
            />
            <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={resetPassword} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>Enviar instrucciones</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setForgot(false)} style={s.forgotBtn}>
              <Text style={s.forgotTxt}>← Volver al login</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: C.bg },
  scroll:    { flexGrow: 1, justifyContent: 'center', padding: 28 },
  logoWrap:  { alignItems: 'center', marginBottom: 40 },
  logoGfi:   { fontFamily: F.heading, fontSize: 38, color: C.white, letterSpacing: 2 },
  logoSub:   { fontFamily: F.body, fontSize: 12, color: C.textDim, marginTop: 4, letterSpacing: 1 },
  title:     { fontFamily: F.bold, fontSize: 20, color: C.white, marginBottom: 24, textAlign: 'center' },
  input:     { backgroundColor: C.bgInput, borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 14, color: C.white, fontFamily: F.body, fontSize: 15, marginBottom: 12 },
  btn:       { backgroundColor: C.red, borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.6 },
  btnTxt:    { fontFamily: F.bold, fontSize: 14, color: C.white, letterSpacing: 1, textTransform: 'uppercase' },
  forgotBtn: { alignItems: 'center', marginTop: 20 },
  forgotTxt: { fontFamily: F.body, fontSize: 13, color: C.textMid },
});
