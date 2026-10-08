import LegalPage from "../../../components/LegalPage";
import { APP_INFO } from "../../../lib/appInfo";
import { formatDate } from "../../../lib/format";
import { useI18n } from "../../../lib/i18n";

// The text lives in the locale files (legal.terms)
export default function TermsConditions() {
  const { t } = useI18n();
  const params = {
    name: APP_INFO.name,
    age: APP_INFO.minimumAge,
    email: APP_INFO.supportEmail,
    law: APP_INFO.governingLaw,
  };
  return (
    <LegalPage
      icon="gavel"
      title={t("legal.terms.title")}
      updated={formatDate(APP_INFO.legalUpdated)}
      intro={t("legal.terms.intro", params)}
      sections={t("legal.terms.sections", params)}
    />
  );
}
