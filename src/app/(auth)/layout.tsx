import { Disclaimer } from "@/components/ui/disclaimer";
import { Wordmark } from "@/components/ui/wordmark";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="container-page flex h-20 items-center">
        <Wordmark />
      </header>
      <main
        id="main"
        className="container-page flex flex-1 items-start justify-center py-8 md:py-16"
      >
        <div className="w-full max-w-md">{children}</div>
      </main>
      <footer className="container-page py-8">
        <Disclaimer />
      </footer>
    </div>
  );
}
