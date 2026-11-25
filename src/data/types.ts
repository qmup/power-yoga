export interface SiteStat {
  value: string;
  label: string;
}

export interface SiteConfig {
  url: string;
  name: string;
  shortName: string;
  headerSubtitle: string;
  tagline: string;
  motto: string;
  locale: string;
  language: string;
  logoImage: string;
  markImage: string;
  seo: {
    title: string;
    description: string;
    keywords: string[];
    ogImage: string;
  };
  contact: {
    phoneRaw: string;
    phoneDisplay: string;
    phoneIntl: string;
    telHref: string;
    zaloHref: string;
    messengerHref: string;
    email: string;
    facebookUrl: string;
    googleMapsUrl: string;
    googleMapsEmbedUrl: string;
    consultFormUrl: string;
  };
  address: {
    current: string;
    legacy: string;
    landmark: string;
    shortLocation: string;
    streetAddress: string;
    addressLocality: string;
    addressRegion: string;
    postalCode: string;
    addressCountry: string;
    geo: {
      latitude: number;
      longitude: number;
    };
  };
  hours: {
    summary: string;
    classesSummary: string;
    opens: string;
    closes: string;
  };
  stats: SiteStat[];
  footer: {
    contactEyebrow: string;
    contactTitleLine1: string;
    contactTitleLine2: string;
    mapCaptionTitle: string;
    mapCaptionSubtitle: string;
    seoLine: string;
  };
}

export interface HeroContent {
  badge: string;
  headlineLine1: string;
  headlineAccent: string;
  headlineLine3: string;
  description: string;
  trialNote: string;
  primaryImage: string;
  primaryImageAlt: string;
  primaryBadgeTop: string;
  primaryBadgeBottom: string;
  sideEyebrow: string;
  sideTitle: string;
  sideDescription: string;
  secondaryImage: string;
  secondaryImageAlt: string;
  secondaryHoursLabel: string;
}

export interface ManifestoContent {
  eyebrow: string;
  quote: string;
  subtitle: string;
}

export interface SeniorBenefit {
  id: string;
  tag: string;
  title: string;
  description: string;
  detail: string;
  icon: 'knee' | 'spine' | 'sleep' | 'community';
}

export interface BenefitsSectionContent {
  eyebrow: string;
  titleLine1: string;
  titleLine2: string;
  description: string;
  items: SeniorBenefit[];
  featuredImage: string;
  featuredImageAlt: string;
  featuredCaptionTitle: string;
  featuredCaptionText: string;
  consultImage: string;
  consultImageAlt: string;
  consultEyebrow: string;
  consultText: string;
  consultCtaLabel: string;
}

export interface StoryChapter {
  number: string;
  eyebrow: string;
  title: string;
  description: string;
  highlights: string[];
  image: string;
  imageAlt: string;
  caption: string;
  imagePosition?: 'center' | 'left-top';
}

export interface StorySectionContent {
  eyebrow: string;
  titleLine1: string;
  titleLine2: string;
  description: string;
  chapters: StoryChapter[];
}

export interface MasterProfile {
  name: string;
  role: string;
  specialty: string;
  description: string;
  image: string;
  imageAlt: string;
}

export interface TeachersSectionContent {
  eyebrow: string;
  titleLine1: string;
  titleLine2: string;
  description: string;
  masters: MasterProfile[];
}

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface WeekDayColumn {
  key: DayKey;
  shortLabel: string;
  fullLabel: string;
}

export interface ScheduleSession {
  dayKey: DayKey;
  day: string;
  name: string;
  titleVi: string;
  titleEn: string;
  teacher: string;
  seniorFriendly: boolean;
  special?: boolean;
  note?: string;
}

export interface ScheduleSlot {
  time: string;
  period: 'morning-early' | 'morning' | 'afternoon';
  periodLabel: string;
  sessions: ScheduleSession[];
}

export interface YogaClassTemplate {
  id: string;
  titleVi: string;
  titleEn: string;
  defaultNote?: string;
  defaultSeniorFriendly: boolean;
  defaultSpecial?: boolean;
}

export interface ScheduleSectionContent {
  eyebrow: string;
  titleLine1: string;
  titleLine2: string;
  description: string;
  posterTitle: string;
  posterSubtitle: string;
  footerNote: string;
  bannerTitle: string;
  bannerDescription: string;
  classCatalog?: YogaClassTemplate[];
  slots: ScheduleSlot[];
}

export type GalleryLayout = 'wide' | 'medium' | 'third' | 'full';

export interface GalleryItem {
  image: string;
  alt: string;
  caption: string;
  layout: GalleryLayout;
}

export interface GallerySectionContent {
  eyebrow: string;
  titleLine1: string;
  titleLine2: string;
  description: string;
  items: GalleryItem[];
}

export interface Testimonial {
  quote: string;
  author: string;
  source: string;
  date: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface PricingSectionContent {
  eyebrow: string;
  titleLine1: string;
  titleLine2: string;
  description: string;
  trialCard: {
    badge: string;
    title: string;
    description: string;
    highlights: string[];
    primaryCtaLabel: string;
    secondaryCtaLabel: string;
  };
  membershipCard: {
    badge: string;
    price: string;
    priceUnit: string;
    promoText: string;
    description: string;
    highlights: string[];
    ctaLabel: string;
  };
  reviewsEyebrow: string;
  reviewsTitle: string;
  testimonials: Testimonial[];
  faqEyebrow: string;
  faqTitle: string;
  faqDescription: string;
  faqs: FaqItem[];
}

export interface CmsData {
  site: SiteConfig;
  hero: HeroContent;
  manifesto: ManifestoContent;
  benefitsSection: BenefitsSectionContent;
  storySection: StorySectionContent;
  teachersSection: TeachersSectionContent;
  scheduleSection: ScheduleSectionContent;
  gallerySection: GallerySectionContent;
  pricingSection: PricingSectionContent;
}
