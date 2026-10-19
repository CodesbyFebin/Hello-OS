import { SiteHeader } from "@/components/hello/site-header";
import { SiteFooter } from "@/components/hello/site-footer";
import { HelloHero } from "@/components/hello/sections/hello-hero";
import { ForgeSection } from "@/components/hello/sections/forge";
import { CortexSection } from "@/components/hello/sections/cortex";
import { CloudSection } from "@/components/hello/sections/cloud";
import { ConsoleSection } from "@/components/hello/sections/console";
import { HonestySection } from "@/components/hello/sections/honesty";
import { ManifestoSection } from "@/components/hello/sections/manifesto";
import { IdentitySection } from "@/components/hello/sections/identity";
import { MemorySection } from "@/components/hello/sections/memory";
import { EconomySection } from "@/components/hello/sections/economy";
import { EvolutionSection } from "@/components/hello/sections/evolution";
import { SocietySection } from "@/components/hello/sections/society";
import { ProtocolSection } from "@/components/hello/sections/protocol";
import { MvpSection } from "@/components/hello/sections/mvp";

export default function Universe() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <HelloHero /><ForgeSection /><CortexSection /><CloudSection /><ConsoleSection /><HonestySection />
        <ManifestoSection /><IdentitySection /><MemorySection /><EconomySection /><EvolutionSection /><SocietySection /><ProtocolSection /><MvpSection />
      </main>
      <SiteFooter />
    </div>
  );
}
