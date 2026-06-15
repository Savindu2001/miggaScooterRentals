import SignInForm from "@/components/auth/SignInForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In | Migga Admin",
  description: "Sign in to the Migga Scooter Rentals admin dashboard.",
};

export default function SignIn() {
  return <SignInForm />;
}
