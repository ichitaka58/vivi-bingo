import SiteHeader from "@/components/SiteHeader";

export default function NewGameLayout({ children }: LayoutProps<"/admin/new">) {
  return (
    <>
      <SiteHeader />
      {children}
    </>
  );
}
