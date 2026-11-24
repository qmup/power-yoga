import { CMS, WEEK_DAYS } from './cms';

export type {
  DayKey,
  FaqItem,
  GalleryItem,
  GalleryLayout,
  MasterProfile,
  ScheduleSession,
  ScheduleSlot,
  SeniorBenefit,
  StoryChapter,
  Testimonial,
  WeekDayColumn,
} from './types';

export { WEEK_DAYS };

export const SENIOR_BENEFITS = CMS.benefitsSection.items;
export const STORY_CHAPTERS = CMS.storySection.chapters;
export const MASTERS = CMS.teachersSection.masters;
export const SCHEDULE_SLOTS = CMS.scheduleSection.slots;
export const TESTIMONIALS = CMS.pricingSection.testimonials;
export const FAQ_ITEMS = CMS.pricingSection.faqs;
