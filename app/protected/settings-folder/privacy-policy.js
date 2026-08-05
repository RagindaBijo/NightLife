import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function PrivacyPolicy() {
  return (
    <View style={styles.container}>
      <ScrollView>
        <Text style={styles.title}>Privacy Policy</Text>
        <Text style={styles.paragraph}>
          Effective Date: September 5, 2025
        </Text>
        <Text style={styles.paragraph}>
          Your privacy is important to us. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application ("App"). Please read this policy carefully. If you do not agree with the terms of this privacy policy, please do not access the App.
        </Text>
        <Text style={styles.sectionHeader}>1. Information We Collect</Text>
        <Text style={styles.paragraph}>
          We may collect information about you in a variety of ways. The information we may collect via the App includes:
        </Text>
        <Text style={styles.bullet}>- Personal Data: Personally identifiable information, such as your name, email address, and other information that you voluntarily give to us when you register with the App or when you choose to participate in various activities related to the App.</Text>
        <Text style={styles.bullet}>- Derivative Data: Information our servers automatically collect when you access the App, such as your IP address, your browser type, your operating system, your access times, and the pages you have viewed directly before and after accessing the App.</Text>
        <Text style={styles.bullet}>- Mobile Device Data: Device information, such as your mobile device ID, model, and manufacturer, and information about the location of your device, if you access the App from a mobile device.</Text>
        <Text style={styles.sectionHeader}>2. Use of Your Information</Text>
        <Text style={styles.paragraph}>
          Having accurate information about you permits us to provide you with a smooth, efficient, and customized experience. Specifically, we may use information collected about you via the App to:
        </Text>
        <Text style={styles.bullet}>- Create and manage your account.</Text>
        <Text style={styles.bullet}>- Email you regarding your account or order.</Text>
        <Text style={styles.bullet}>- Enable user-to-user communications.</Text>
        <Text style={styles.bullet}>- Increase the efficiency and operation of the App.</Text>
        <Text style={styles.bullet}>- Monitor and analyze usage and trends to improve your experience with the App.</Text>
        <Text style={styles.sectionHeader}>3. Disclosure of Your Information</Text>
        <Text style={styles.paragraph}>
          We may share information we have collected about you in certain situations. Your information may be disclosed as follows:
        </Text>
        <Text style={styles.bullet}>- By Law or to Protect Rights: If we believe the release of information about you is necessary to comply with the law, or to protect our rights, property, or safety.</Text>
        <Text style={styles.bullet}>- Business Transfers: We may share or transfer your information in connection with, or during negotiations of, any merger, sale of company assets, financing, or acquisition of all or a portion of our business to another company.</Text>
        <Text style={styles.bullet}>- Third-Party Service Providers: We may share your information with third-party vendors and other service providers that perform services for us or on our behalf.</Text>
        <Text style={styles.sectionHeader}>4. Security of Your Information</Text>
        <Text style={styles.paragraph}>
          We use administrative, technical, and physical security measures to help protect your personal information. While we have taken reasonable steps to secure the personal information you provide to us, please be aware that despite our efforts, no security measures are perfect or impenetrable, and no method of data transmission can be guaranteed against any interception or other type of misuse.
        </Text>
        <Text style={styles.sectionHeader}>5. Policy for Children</Text>
        <Text style={styles.paragraph}>
          We do not knowingly solicit information from or market to children under the age of 13. If we learn we have collected personal information from a child under age 13 without verification of parental consent, we will delete that information as quickly as possible.
        </Text>
        <Text style={styles.sectionHeader}>6. Changes to This Privacy Policy</Text>
        <Text style={styles.paragraph}>
          We may update this Privacy Policy from time to time in order to reflect, for example, changes to our practices or for other operational, legal, or regulatory reasons. We will notify you of any changes by posting the new Privacy Policy on this page.
        </Text>
        <Text style={styles.sectionHeader}>7. Contact Us</Text>
        <Text style={styles.paragraph}>
          If you have questions or comments about this Privacy Policy, please contact us at: support@example.com
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
  bullet: {
    fontSize: 16,
    color: '#DDDDDD',
    marginBottom: 5,
    marginLeft: 10,
  },
});