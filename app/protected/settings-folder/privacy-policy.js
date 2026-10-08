import LegalPage from "../../../components/LegalPage";
import { APP_INFO } from "../../../lib/appInfo";
import { formatDate } from "../../../lib/format";
import { useI18n } from "../../../lib/i18n";

// The text lives in the locale files (legal.privacy)
export default function PrivacyPolicy() {
  const { t } = useI18n();
  const params = {
    name: APP_INFO.name,
    age: APP_INFO.minimumAge,
    email: APP_INFO.supportEmail,
    law: APP_INFO.governingLaw,
  };
  return (
    <LegalPage
      icon="privacy-tip"
      title={t("legal.privacy.title")}
      updated={formatDate(APP_INFO.legalUpdated)}
      intro={t("legal.privacy.intro", params)}
      sections={t("legal.privacy.sections", params)}
    />
  );
}
