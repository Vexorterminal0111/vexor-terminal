import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { Marquee } from "@/components/Marquee";
import { About } from "@/components/About";
import { Team } from "@/components/Team";
import { UseCases } from "@/components/UseCases";
import { Token } from "@/components/Token";
import { Console } from "@/components/Console";
import { RevShareConsole } from "@/components/RevShareConsole";
import { Chat } from "@/components/Chat";
import { Services } from "@/components/Services";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Nav />
      <main className="flex-1">
        <Hero />
        <Marquee />
        <About />
        <Team />
        <UseCases />
        <Token />
        <Console />
        <RevShareConsole />
        <Chat />
        <Services />
      </main>
      <Footer />
    </>
  );
}
