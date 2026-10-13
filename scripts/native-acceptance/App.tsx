// Separate native acceptance entry; contains no token/password diagnostics.
import { useEffect, useState } from 'react';
import {
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import ResponderApp from './ResponderApp';
import {
  armFault,
  observeFault,
  recordAcceptance,
  type StorageFault,
} from './acceptance-store';
import { colors } from './theme';

export default function AcceptanceApp() {
  const [message, setMessage] = useState(
    'No fault armed. Real OS storage is used.',
  );
  useEffect(() => observeFault(setMessage), []);
  useEffect(() => {
    const original = globalThis.fetch;
    const origin = process.env.EXPO_PUBLIC_STAFF_AUTH_ORIGIN;
    const diagnosticFetch: typeof fetch = async (input, options) => {
      const path =
        typeof input === 'string' &&
        origin &&
        ['sign-in', 'session', 'logout'].find(
          (name) => input === `${origin}/staff/auth/mobile/${name}`,
        );
      if (!path) return original(input, options);
      recordAcceptance(`HTTPS ${path}: started`);
      try {
        const response = await original(input, options);
        recordAcceptance(`HTTPS ${path}: HTTP ${response.status}`);
        return response;
      } catch (error) {
        recordAcceptance(`HTTPS ${path}: request failed`);
        throw error;
      }
    };
    globalThis.fetch = diagnosticFetch;
    const listener = AppState.addEventListener('change', (status) => {
      recordAcceptance(
        `App state: ${['active', 'background', 'inactive'].includes(status) ? status : 'other'}`,
      );
    });
    return () => {
      if (globalThis.fetch === diagnosticFetch) globalThis.fetch = original;
      listener.remove();
    };
  }, []);
  const faults: [StorageFault, string][] = [
    ['none', 'Clear fault'],
    ['write', 'Reject next token write'],
    ['delete', 'Reject next token deletion'],
    ['interrupt', 'Pause next token write'],
  ];
  return (
    <View style={styles.page}>
      <Text accessibilityRole="header" style={styles.text}>
        Native acceptance · test build
      </Text>
      <ScrollView style={styles.trace}>
        <Text accessibilityLiveRegion="polite" style={styles.traceText}>
          {message}
        </Text>
      </ScrollView>
      <View style={styles.controls}>
        {faults.map(([fault, label]) => (
          <Pressable
            key={fault}
            accessibilityRole="button"
            onPress={() => armFault(fault)}
            style={styles.button}
          >
            <Text style={styles.buttonText}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <ResponderApp />
    </View>
  );
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background, paddingTop: 32 },
  text: { color: colors.text, fontSize: 16, margin: 8 },
  trace: { maxHeight: 160, flexGrow: 0 },
  traceText: { color: colors.text, fontSize: 12, margin: 8 },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 8 },
  button: {
    minHeight: 48,
    backgroundColor: colors.accent,
    padding: 12,
    borderRadius: 6,
    justifyContent: 'center',
  },
  buttonText: { color: colors.background, fontSize: 14, fontWeight: '600' },
});
