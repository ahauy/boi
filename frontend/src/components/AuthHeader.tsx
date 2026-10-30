import Navbar from "./Navbar";

interface AuthHeaderProps {
  rightAction?: "login" | "user" | "none";
}

export const AuthHeader = ({ rightAction }: AuthHeaderProps) => {
  return <Navbar rightAction={rightAction} />;
};

export default AuthHeader;
