import SectionHeading from "@/components/SectionHeading";

const galleryImages = Array.from({ length: 12 }, (_, i) => ({
  src: `/images/gallery/img${i + 1}.jpeg`,
  alt: `G G Nursing Home hospital image ${i + 1}`,
}));

const Gallery = () => {
  return (
    <main className="min-h-screen bg-muted/20 pt-32 pb-16">
      <section className="container mx-auto px-4">
        <SectionHeading
          label="Hospital Gallery"
          title={
            <>
              Images of <span className="text-accent">G G Nursing Home</span>
            </>
          }
          description="A quick look at our facilities, services, and hospital environment."
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {galleryImages.map((image) => (
            <figure
              key={image.src}
              className="group overflow-hidden rounded-xl bg-card border border-border shadow-[var(--card-shadow)]"
            >
              <img
                src={image.src}
                alt={image.alt}
                loading="lazy"
                className="h-64 w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              />
            </figure>
          ))}
        </div>
      </section>
    </main>
  );
};

export default Gallery;
