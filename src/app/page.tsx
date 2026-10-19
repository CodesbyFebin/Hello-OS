import { HelloDashboard } from "@/components/hello/dashboard";
import { LandingHero } from "@/components/hello/landing-hero";
import { EcosystemShowcase } from "@/components/hello/ecosystem-showcase";

export default function Home() {
  return (
    <>
      <LandingHero />
      <EcosystemShowcase />
      <HelloDashboard />
    </>
  );
}
