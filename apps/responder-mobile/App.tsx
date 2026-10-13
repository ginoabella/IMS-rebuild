import { useEffect, useRef, useState } from 'react';
import {
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MobileAccess, type MobileState } from './auth/access';
import { staffSecureStorage } from './auth/secure-storage';
import { mobileTransport } from './auth/transport';
import { colors } from './theme';

export default function App() {
  const [state, setState] = useState<MobileState>({
    mode: 'locked',
    session: null,
    message: 'Checking stored access…',
    pending: false,
  });
  const [tenantCode, setTenantCode] = useState(''),
    [username, setUsername] = useState(''),
    [password, setPassword] = useState('');
  const access = useRef<MobileAccess | null>(null);
  useEffect(() => {
    let mounted = true;
    const controller = new MobileAccess(
      staffSecureStorage,
      mobileTransport(process.env.EXPO_PUBLIC_STAFF_AUTH_ORIGIN),
      (next) => {
        if (mounted) setState(next);
      },
    );
    access.current = controller;
    void controller.check();
    const listener = AppState.addEventListener('change', (status) => {
      controller.hide();
      setPassword('');
      if (status === 'active') void controller.check();
    });
    return () => {
      mounted = false;
      listener.remove();
      controller.dispose();
      access.current = null;
    };
  }, []);
  async function signIn() {
    const input = {
      tenantCode: tenantCode.trim().toLowerCase(),
      username: username.trim().toLowerCase(),
      password,
    };
    setPassword('');
    try {
      await access.current?.signIn(input);
    } finally {
      input.password = '';
    }
  }
  function button(label: string, action: () => void) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: state.pending }}
        disabled={state.pending}
        onPress={action}
        style={[styles.button, state.pending && styles.disabled]}
      >
        <Text style={styles.buttonText}>{label}</Text>
      </Pressable>
    );
  }
  return (
    <ScrollView
      contentContainerStyle={styles.page}
      keyboardShouldPersistTaps="handled"
    >
      <Text accessibilityRole="header" style={styles.title}>
        MyIMS · Responder
      </Text>
      <Text accessibilityLiveRegion="polite" style={styles.text}>
        {state.message}
      </Text>
      {state.mode === 'ready' && state.session ? (
        <View>
          <Text style={styles.text}>
            Staff session verified. Responder operations are pending.
          </Text>
          {button('Check access', () => void access.current?.check())}
          {button('Sign out', () => void access.current?.logout())}
        </View>
      ) : (
        <View>
          {state.mode !== 'cleanup' && (
            <>
              <Text style={styles.text}>Tenant code</Text>
              <TextInput
                accessibilityLabel="Tenant code"
                style={styles.input}
                value={tenantCode}
                onChangeText={setTenantCode}
                autoCapitalize="none"
                editable={!state.pending}
              />
              <Text style={styles.text}>Username</Text>
              <TextInput
                accessibilityLabel="Username"
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoComplete="username"
                editable={!state.pending}
              />
              <Text style={styles.text}>Password</Text>
              <TextInput
                accessibilityLabel="Password"
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="current-password"
                editable={!state.pending}
              />
              {button('Sign in', () => void signIn())}
            </>
          )}
          {button(
            state.mode === 'cleanup'
              ? 'Retry sign out and storage cleanup'
              : 'Retry stored access',
            () =>
              void (state.mode === 'cleanup'
                ? access.current?.logout()
                : access.current?.check()),
          )}
          {button(
            'Sign out and clear stored access',
            () => void access.current?.logout(),
          )}
        </View>
      )}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    backgroundColor: colors.background,
    padding: 24,
    paddingTop: 64,
    gap: 20,
  },
  title: { fontSize: 26, fontWeight: '600', color: colors.text },
  text: { color: colors.muted, fontSize: 16, marginVertical: 8 },
  input: {
    minHeight: 48,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    padding: 12,
  },
  button: {
    minHeight: 48,
    marginTop: 16,
    backgroundColor: colors.accent,
    borderRadius: 6,
    padding: 12,
    justifyContent: 'center',
  },
  disabled: { opacity: 0.55 },
  buttonText: { fontSize: 16, color: colors.background, fontWeight: '600' },
});
