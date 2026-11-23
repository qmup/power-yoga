import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function initHeaderState() {
  const header = document.getElementById('site-header');
  if (!header) return;

  const update = () => {
    if (window.scrollY > 36) {
      header.classList.add('is-scrolled');
    } else {
      header.classList.remove('is-scrolled');
    }
  };
  update();
  window.addEventListener('scroll', update, { passive: true });
}

function initFontSizeToggle() {
  const toggles = document.querySelectorAll<HTMLButtonElement>('[data-font-toggle]');
  if (!toggles.length) return;

  const saved = localStorage.getItem('py-font-large') === '1';
  if (saved) document.documentElement.classList.add('font-large');

  const syncLabels = () => {
    const isLarge = document.documentElement.classList.contains('font-large');
    toggles.forEach((btn) => {
      btn.setAttribute('aria-pressed', String(isLarge));
      btn.classList.toggle('bg-ink', isLarge);
      btn.classList.toggle('text-ivory', isLarge);
      btn.classList.toggle('border-ink', isLarge);
      btn.classList.toggle('bg-surface', !isLarge);
      btn.classList.toggle('text-ink', !isLarge);
      btn.classList.toggle('border-ink/15', !isLarge);
    });
  };
  syncLabels();

  toggles.forEach((btn) => {
    btn.addEventListener('click', () => {
      const isLarge = document.documentElement.classList.toggle('font-large');
      localStorage.setItem('py-font-large', isLarge ? '1' : '0');
      syncLabels();
      ScrollTrigger.refresh();
    });
  });
}

function initMobileNav() {
  const openBtn = document.getElementById('mobile-menu-btn');
  const drawer = document.getElementById('mobile-nav-drawer');
  if (!openBtn || !drawer) return;

  const closeMenu = () => {
    drawer.classList.add('hidden');
    openBtn.setAttribute('aria-expanded', 'false');
  };

  openBtn.addEventListener('click', () => {
    const isHidden = drawer.classList.toggle('hidden');
    openBtn.setAttribute('aria-expanded', String(!isHidden));
  });

  drawer.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', closeMenu);
  });
}

function initScheduleFilter() {
  const buttons = document.querySelectorAll<HTMLButtonElement>('[data-schedule-filter]');
  const viewButtons = document.querySelectorAll<HTMLButtonElement>('[data-schedule-view]');
  const gridView = document.getElementById('schedule-view-grid');
  const listView = document.getElementById('schedule-view-list');
  const gridRows = document.querySelectorAll<HTMLElement>('[data-grid-row]');
  const gridCells = document.querySelectorAll<HTMLElement>('[data-grid-cell]');
  const cards = document.querySelectorAll<HTMLElement>('[data-schedule-card]');
  const slotGroups = document.querySelectorAll<HTMLElement>('[data-schedule-slot]');

  // View style switcher (Default: Fanpage timetable grid <-> List cards)
  viewButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetView = btn.dataset.scheduleView || 'grid';
      const showGrid = targetView === 'grid';

      gridView?.classList.toggle('hidden', !showGrid);
      listView?.classList.toggle('hidden', showGrid);

      viewButtons.forEach((b) => {
        const active = b === btn;
        b.setAttribute('aria-pressed', String(active));
        b.classList.toggle('bg-sage-dark', active);
        b.classList.toggle('text-ivory', active);
        b.classList.toggle('shadow-2xs', active);
        b.classList.toggle('bg-transparent', !active);
        b.classList.toggle('text-ink-soft', !active);
        b.classList.toggle('hover:text-ink', !active);
      });

      ScrollTrigger.refresh();
    });
  });

  if (!buttons.length) return;

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.scheduleFilter || 'all';

      buttons.forEach((b) => {
        const active = b === btn;
        b.setAttribute('aria-pressed', String(active));
        b.classList.toggle('bg-ink', active);
        b.classList.toggle('text-ivory', active);
        b.classList.toggle('border-ink', active);
        b.classList.toggle('bg-surface', !active);
        b.classList.toggle('text-ink-soft', !active);
        b.classList.toggle('border-ink/12', !active);
        b.classList.toggle('hover:text-ink', !active);
        b.classList.toggle('hover:border-ink/35', !active);
      });

      // Sync Style 1 (Timetable Grid)
      gridRows.forEach((row) => {
        const period = row.dataset.period || '';
        let rowVisible = true;
        if (filter === 'morning') rowVisible = period === 'morning-early' || period === 'morning';
        else if (filter === 'afternoon') rowVisible = period === 'afternoon';
        row.classList.toggle('hidden', !rowVisible);
      });

      gridCells.forEach((cell) => {
        const isSenior = cell.dataset.senior === 'true';
        const highlightSenior = filter === 'senior';
        cell.classList.toggle('opacity-25', highlightSenior && !isSenior);
        cell.classList.toggle('ring-2', highlightSenior && isSenior);
        cell.classList.toggle('ring-sage/55', highlightSenior && isSenior);
        cell.classList.toggle('bg-sage-soft/55', highlightSenior && isSenior);
      });

      // Sync Style 2 (Detailed List Cards)
      cards.forEach((card) => {
        const period = card.dataset.period || '';
        const isSenior = card.dataset.senior === 'true';
        let visible = true;

        if (filter === 'senior') visible = isSenior;
        else if (filter === 'morning') visible = period === 'morning-early' || period === 'morning';
        else if (filter === 'afternoon') visible = period === 'afternoon';

        card.classList.toggle('hidden', !visible);
      });

      slotGroups.forEach((slot) => {
        const visibleCards = slot.querySelectorAll('[data-schedule-card]:not(.hidden)').length;
        slot.classList.toggle('hidden', visibleCards === 0);
      });

      ScrollTrigger.refresh();
    });
  });
}

function initFaqAccordion() {
  const items = document.querySelectorAll<HTMLElement>('.faq-item');
  items.forEach((item) => {
    const trigger = item.querySelector<HTMLButtonElement>('.faq-trigger');
    if (!trigger) return;

    trigger.addEventListener('click', () => {
      const currentlyOpen = item.dataset.open === 'true';
      items.forEach((other) => {
        other.dataset.open = 'false';
        const otherBtn = other.querySelector<HTMLButtonElement>('.faq-trigger');
        otherBtn?.setAttribute('aria-expanded', 'false');
      });

      if (!currentlyOpen) {
        item.dataset.open = 'true';
        trigger.setAttribute('aria-expanded', 'true');
      }
      setTimeout(() => ScrollTrigger.refresh(), 400);
    });
  });
}

function initLightbox() {
  const lightbox = document.getElementById('gallery-lightbox');
  const lightboxImg = document.getElementById('lightbox-image') as HTMLImageElement | null;
  const lightboxCaption = document.getElementById('lightbox-caption');
  const closeBtn = document.getElementById('lightbox-close');
  if (!lightbox || !lightboxImg || !lightboxCaption) return;

  // Move lightbox to body root so it always sits cleanly above the sticky header
  if (lightbox.parentElement !== document.body) {
    document.body.appendChild(lightbox);
  }

  const open = (src: string, alt: string, caption: string) => {
    lightboxImg.src = src;
    lightboxImg.alt = alt;
    lightboxCaption.textContent = caption;
    lightbox.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  };

  const close = () => {
    lightbox.classList.remove('is-open');
    document.body.style.overflow = '';
  };

  document.querySelectorAll<HTMLElement>('[data-lightbox-src]').forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const src = trigger.dataset.lightboxSrc || '';
      const alt = trigger.dataset.lightboxAlt || '';
      const caption = trigger.dataset.lightboxCaption || alt;
      if (src) open(src, alt, caption);
    });
  });

  closeBtn?.addEventListener('click', close);
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) close();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightbox.classList.contains('is-open')) close();
  });
}

function initAppleScrollExperience() {
  let lenis: Lenis | null = null;

  if (!prefersReducedMotion) {
    lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.4,
    });

    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => {
      lenis?.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);
  }

  // Smooth anchor scrolling
  document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      const href = anchor.getAttribute('href');
      if (!href || href === '#') return;
      const target = document.querySelector<HTMLElement>(href);
      if (!target) return;

      e.preventDefault();
      if (lenis) {
        lenis.scrollTo(target, { offset: -84 });
      } else {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  if (prefersReducedMotion) {
    // Ensure all sticky states look crisp without motion
    document.querySelectorAll('.story-slide').forEach((el, i) => {
      el.classList.toggle('is-active', i === 0);
    });
    document.querySelectorAll('.story-step').forEach((el) => el.classList.add('is-active'));
    return;
  }

  // 1. Hero Entrance & Apple-Style Scroll Frame Compression
  gsap.from('[data-hero-stagger]', {
    y: 26,
    opacity: 0,
    duration: 1,
    stagger: 0.12,
    ease: 'power3.out',
    clearProps: 'transform,opacity',
  });

  const heroFrame = document.querySelector<HTMLElement>('[data-hero-frame]');
  const heroMedia = document.querySelector<HTMLElement>('[data-hero-media]');
  if (heroFrame && heroMedia) {
    gsap.to(heroFrame, {
      scale: 0.95,
      borderRadius: '2.25rem',
      ease: 'none',
      scrollTrigger: {
        trigger: '#hero-section',
        start: 'top top',
        end: 'bottom top',
        scrub: 0.8,
      },
    });

    gsap.to(heroMedia, {
      scale: 1.1,
      yPercent: 7,
      ease: 'none',
      scrollTrigger: {
        trigger: '#hero-section',
        start: 'top top',
        end: 'bottom top',
        scrub: 0.8,
      },
    });
  }

  // 2. Apple-Style Manifesto Word Illumination on Scroll
  const manifestoSection = document.getElementById('manifesto-section');
  const manifestoWords = document.querySelectorAll<HTMLElement>('.manifesto-word');
  if (manifestoSection && manifestoWords.length) {
    gsap.to(manifestoWords, {
      opacity: 1,
      stagger: 0.08,
      ease: 'none',
      scrollTrigger: {
        trigger: manifestoSection,
        start: 'top 76%',
        end: 'bottom 48%',
        scrub: 0.6,
      },
    });
  }

  // 3. Apple Sticky Split-Screen Storyteller (4 Chapters)
  const storySteps = document.querySelectorAll<HTMLElement>('.story-step');
  const storySlides = document.querySelectorAll<HTMLElement>('.story-slide');
  const storyProgressBar = document.getElementById('story-progress-bar');
  const storyCounter = document.getElementById('story-counter');
  const storyCaption = document.getElementById('story-caption');

  const activateChapter = (index: number) => {
    storySteps.forEach((step, idx) => step.classList.toggle('is-active', idx === index));
    storySlides.forEach((slide, idx) => slide.classList.toggle('is-active', idx === index));

    if (storyProgressBar) {
      const pct = ((index + 1) / Math.max(storySteps.length, 1)) * 100;
      storyProgressBar.style.width = `${pct}%`;
    }
    if (storyCounter) {
      storyCounter.textContent = `0${index + 1} / 0${storySteps.length}`;
    }
    if (storyCaption) {
      const activeStep = storySteps[index];
      if (activeStep?.dataset.caption) {
        storyCaption.textContent = activeStep.dataset.caption;
      }
    }
  };

  if (storySteps.length) {
    activateChapter(0);

    storySteps.forEach((step, index) => {
      ScrollTrigger.create({
        trigger: step,
        start: 'top 58%',
        end: 'bottom 42%',
        onEnter: () => activateChapter(index),
        onEnterBack: () => activateChapter(index),
      });
    });
  }

  // 4. Subtle Scroll Parallax for Media Frames
  document.querySelectorAll<HTMLElement>('[data-parallax]').forEach((el) => {
    const speed = Number(el.dataset.parallax || 6);
    gsap.fromTo(
      el,
      { yPercent: -speed },
      {
        yPercent: speed,
        ease: 'none',
        scrollTrigger: {
          trigger: el.parentElement || el,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        },
      }
    );
  });

  // 5. Calm Staggered Reveal for Sections & Cards
  document.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
    const delay = Number(el.dataset.delay || 0);
    gsap.from(el, {
      y: 28,
      opacity: 0,
      duration: 0.9,
      delay,
      ease: 'power3.out',
      clearProps: 'transform,opacity',
      scrollTrigger: {
        trigger: el,
        start: 'top 86%',
        once: true,
      },
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initHeaderState();
  initFontSizeToggle();
  initMobileNav();
  initScheduleFilter();
  initFaqAccordion();
  initLightbox();
  initAppleScrollExperience();
});
