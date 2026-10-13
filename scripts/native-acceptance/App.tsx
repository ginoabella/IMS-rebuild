// Separate native acceptance entry; contains no token/password diagnostics.
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import ResponderApp from './ResponderApp';
import { armFault, observeFault, type StorageFault } from './acceptance-store';
import { colors } from './theme';

export default function AcceptanceApp() {
  const [message, setMessage] = useState(
    'No fault armed. Real OS storage is used.',
  );
  useEffect(() => observeFault(setMessage), []);
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
      <Text accessibilityLiveRegion="polite" style={styles.text}>
        {message}
      </Text>
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
