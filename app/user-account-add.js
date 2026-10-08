import RegisterForm from "../components/auth/RegisterForm";

export const options = {
  headerShown: false,
};

export default function UserAccountAdd() {
  return <RegisterForm accountType={1} />;
}
