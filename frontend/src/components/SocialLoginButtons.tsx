import GoogleLoginButton from "./GoogleLoginButton";
import FacebookLoginButton from "./FacebookLoginButton";

export const SocialLoginButtons = () => {
  return (
    <>
      <div className="relative text-center my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-hairline" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-[#170f2c] px-4 text-xs uppercase tracking-widest text-[#d4af37]/80">
            ✦ hoặc ✦
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <GoogleLoginButton />
        <FacebookLoginButton />
      </div>
    </>
  );
};

export default SocialLoginButtons;
