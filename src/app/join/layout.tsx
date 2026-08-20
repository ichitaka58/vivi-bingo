import { Baloo_2, Fredoka, Nunito } from "next/font/google";

const baloo2 = Baloo_2({
  variable: "--font-baloo",
  weight: "variable",
  subsets: ["latin"],
});

const fredoka = Fredoka({
  variable: "--font-fredoka",
  weight: "variable",
  subsets: ["latin"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  weight: "variable",
  subsets: ["latin"],
});

export default function JoinLayout({ children }: LayoutProps<"/join">) {
  return (
    <div className={`contents ${baloo2.variable} ${fredoka.variable} ${nunito.variable}`}>
      {children}
    </div>
  );
}
