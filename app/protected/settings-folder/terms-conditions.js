import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function TermsConditions() {
  return (
    <View style={styles.container}>
      <ScrollView>
        <Text style={styles.title}>Terms & Conditions of Use</Text>
        <Text style={styles.paragraph}>
          Effective Date: September 5, 2025
        </Text>
        <Text style={styles.paragraph}>
          By accessing or using our mobile application ("App"), you agree to be bound by these Terms & Conditions of Use ("Terms"). If you do not agree to these Terms, you may not access or use the App. We reserve the right to update or modify these Terms at any time, and such changes will be effective immediately upon being posted in the App.
        </Text>
        <Text style={styles.sectionHeader}>1. Use of the App</Text>
        <Text style={styles.paragraph}>
          You agree to use the App only for lawful purposes and in a way that does not infringe the rights of, restrict, or inhibit anyone else's use and enjoyment of the App. Prohibited behavior includes harassing or causing distress or inconvenience to any other user, transmitting obscene or offensive content, or disrupting the normal flow of dialogue within the App.
        </Text>
        <Text style={styles.sectionHeader}>2. Account Registration</Text>
        <Text style={styles.paragraph}>
          In order to access certain features of the App, you may be required to create an account. You must provide accurate and complete information and keep your account information updated. You are solely responsible for the activity that occurs on your account, and you must keep your account password secure.
        </Text>
        <Text style={styles.sectionHeader}>3. Intellectual Property</Text>
        <Text style={styles.paragraph}>
          The App and its original content, features, and functionality are owned by us and are protected by international copyright, trademark, patent, trade secret, and other intellectual property or proprietary rights laws. You agree not to reproduce, distribute, modify, create derivative works of, publicly display, publicly perform, republish, download, store, or transmit any of the material on our App, except as necessary for your own personal, non-commercial use.
        </Text>
        <Text style={styles.sectionHeader}>4. User Content</Text>
        <Text style={styles.paragraph}>
          You may be able to post, upload, or submit content to the App ("User Content"). You retain ownership of your User Content, but by submitting it, you grant us a worldwide, non-exclusive, royalty-free, transferable license to use, reproduce, distribute, create derivative works of, display, and perform your User Content in connection with the App.
        </Text>
        <Text style={styles.sectionHeader}>5. Termination</Text>
        <Text style={styles.paragraph}>
          We may terminate or suspend your account and bar access to the App immediately, without prior notice or liability, under our sole discretion, for any reason whatsoever and without limitation, including but not limited to a breach of the Terms.
        </Text>
        <Text style={styles.sectionHeader}>6. Limitation of Liability</Text>
        <Text style={styles.paragraph}>
          In no event shall we, nor our directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the App.
        </Text>
        <Text style={styles.sectionHeader}>7. Governing Law</Text>
        <Text style={styles.paragraph}>
          These Terms shall be governed and construed in accordance with the laws of [Your Jurisdiction], without regard to its conflict of law provisions.
        </Text>
        <Text style={styles.sectionHeader}>8. Contact Us</Text>
        <Text style={styles.paragraph}>
          If you have any questions about these Terms, please contact us at: support@example.com
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 20,
    marginBottom: 10,
  },
  paragraph: {
    fontSize: 16,
    color: '#DDDDDD',
    marginBottom: 10,
  },
});