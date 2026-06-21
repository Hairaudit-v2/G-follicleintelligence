import { FutureOfHairRestorationView } from "@/components/future/FutureOfHairRestorationView";
import { buildPageMetadata } from "@/lib/seo/page-metadata";

export const metadata = buildPageMetadata({
  title: "The Future of Hair Restoration",
  description:
    "Explore where the global hair restoration industry is heading over the next decade and how intelligence-driven medicine will transform patient care.",
  path: "/the-future-of-hair-restoration",
  imageAlt: "Follicle Intelligence — the future of hair restoration",
});

export default function FutureOfHairRestorationPage() {
  return <FutureOfHairRestorationView />;
}