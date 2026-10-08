import RegisterForm from "../components/auth/RegisterForm";

export const options = {
  headerShown: false,
};

export default function VenueAccountAdd() {
  return <RegisterForm accountType={2} />;
}
