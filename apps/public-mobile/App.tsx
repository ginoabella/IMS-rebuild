import { View, Text } from 'react-native';

export default function App() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
      <Text accessibilityRole="header">MyIMS · Public intake</Text>
      <Text>
        Application foundation is running. Operational features are pending.
      </Text>
    </View>
  );
}
