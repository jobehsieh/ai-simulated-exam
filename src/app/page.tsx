import Hero from "@/components/landing/Hero";
import { Cta, Faq, Features, Steps } from "@/components/landing/Sections";

export default function Home() {
  return (
    <>
      <Hero />
      <Features />
      <Steps />
      <Faq />
      <Cta />
    </>
  );
}
