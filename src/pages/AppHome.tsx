import { HomeBookCanvas } from "@/components/app/HomeBookCanvas";

export default function AppHome() {
  return (
    <div className="min-h-full overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(255,224,211,0.55),_transparent_45%),linear-gradient(180deg,_rgba(255,251,247,0.96)_0%,_rgba(255,246,239,0.88)_100%)] px-4 py-6 sm:px-6 sm:py-8 md:px-10 md:py-10">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,0.84fr)_minmax(320px,1.16fr)] lg:items-center">
        <section className="max-w-2xl space-y-4">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Welcome to Game Art Guidebook</h1>
          <div className="space-y-4 text-muted-foreground">
            <p>This is your practical workspace for learning game art step by step.</p>
            <p>
              Explore chapters, open lessons in the reader, follow exercises, and return whenever
              you want to continue from where you left off. The guidebook is built to help you
              understand not just how to draw better, but how to think like a game artist: shape,
              color, light, rendering, design, workflow, and portfolio-ready results.
            </p>
            <p>
              Start with any chapter, or move through the guidebook in order if you want a more
              structured path.
            </p>
          </div>
        </section>

        <section className="relative -mx-2 sm:-mx-4 md:-ml-14 md:-mr-4 lg:-ml-24 lg:-mr-10">
          <HomeBookCanvas />
        </section>
      </div>
    </div>
  );
}
