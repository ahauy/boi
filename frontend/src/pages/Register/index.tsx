import { TarotCorners } from "@/components/mystic/MysticDivider";
import RegisterHeader from "./components/RegisterHeader";
import RegisterForm from "./components/RegisterForm";

export const RegisterPage = () => {
  return (
    <div className="flex-1 w-full max-w-[1040px] mx-auto my-8 md:my-14 px-4">
      <div className="relative mystic-card rounded-2xl p-6 sm:p-10 flex flex-col md:flex-row gap-8 md:gap-0 items-start">
        <TarotCorners />
        <RegisterHeader />
        <div className="hidden md:block w-[1px] bg-hairline self-stretch min-h-[580px]" />
        <RegisterForm />
      </div>
    </div>
  );
};

export default RegisterPage;
