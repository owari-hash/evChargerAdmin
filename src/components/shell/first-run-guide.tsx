'use client';

import 'driver.js/dist/driver.css';
import './first-run-guide.css';

import * as React from 'react';
import { driver, type Driver, type DriveStep, type Side, type Alignment } from 'driver.js';
import { api, GUIDE_DISMISSED_COOKIE } from '@/lib/client';
import { BASE_PATH } from '@/lib/base-path';

/**
 * First-run spotlight guide for a new operator.
 *
 * Shown automatically only while the backend says `guidePending: true` (set on
 * operator accounts created after the guide shipped). The popover is a custom
 * card in the style of the sukhApp mobile coach card; driver.js only provides
 * the dimmed overlay, the spotlight cut-out and positioning.
 *
 * Dismissal rules:
 * - «Ойлголоо» on the last step → done on the server, whatever the checkbox says.
 * - «Алгасах» / ✕ / Esc with «Дахиж харахгүй» ticked → done on the server.
 * - «Алгасах» / ✕ / Esc unticked → only a sessionStorage flag, so it comes back
 *   on the next session while the account still has guidePending.
 * - Replay («Заавар үзэх») never talks to the server and hides the checkbox.
 */

interface GuideStep {
  /** `data-tour` value of the element to spotlight; none = centred card. */
  target?: string;
  /** The target lives in the sidebar, which is an off-canvas drawer below lg. */
  drawer?: boolean;
  side?: Side;
  align?: Alignment;
  tag: string;
  title: string;
  body: string;
}

const STEPS: GuideStep[] = [
  {
    tag: 'Тавтай морил',
    title: 'Eplug удирдлагын консол',
    body: 'Цэнэглэх станц, харилцагч, RFID карт, цэнэглэлтээ эндээс удирдана. Гол хэсгүүдтэй богино аяллаар танилцъя.',
  },
  {
    target: 'sidebar-nav',
    drawer: true,
    side: 'right',
    align: 'start',
    tag: 'Үндсэн цэс',
    title: 'Цэсээр хэсэг хооронд шилжинэ',
    body: '«Цэнэглэх станц» — станц бүртгэж, холбогчдыг хянана. «Харилцагч» — байгууллага үүсгэж станцаа холбоно. «RFID карт» — жолооч болон дотоод гишүүний карт. «Цэнэглэлт» — бүх гүйлгээ, жолооч, е-баримтын төлөв. Таны эрхээс хамаарч цэс өөр байж болно.',
  },
  {
    target: 'live-status',
    side: 'bottom',
    align: 'end',
    tag: 'Шууд холболт',
    title: '«Шууд» төлөв',
    body: 'Сервертэй шууд холболтыг заана. Ногоон «Шууд» үед хүснэгт, тоонууд шинэчлэх товчгүйгээр өөрөө шинэчлэгдэнэ. Шар — холбогдож байна, улаан — холболт тасарсан.',
  },
  {
    target: 'notifications',
    side: 'bottom',
    align: 'end',
    tag: 'Мэдэгдэл',
    title: 'Мэдэгдлийн хонх',
    body: 'Төлбөр төлөгдөх эсвэл цуцлагдах, хэтэвч цэнэглэгдэх, хасагдах, буцаалт хийгдэх үед энд шууд мэдэгдэл ирнэ.',
  },
  {
    target: 'account',
    side: 'bottom',
    align: 'end',
    tag: 'Тохиргоо',
    title: 'Горим, заавар, гарах',
    body: 'Сар/нар товчоор харанхуй, цайвар горим солино. «Заавар үзэх» товчоор (утсан дээр цэсний доод хэсэгт) энэ аяллыг хүссэн үедээ дахин үзнэ. «Гарах» — консолоос гарна.',
  },
  {
    target: 'overview-kpis',
    side: 'bottom',
    align: 'start',
    tag: 'Ерөнхий тойм',
    title: 'Гол үзүүлэлтүүд',
    body: '«Ерөнхий тойм» хуудасны дээд хэсэгт онлайн станц, одоо цэнэглэж буй холбогч, идэвхтэй цэнэглэлт, 24 цагийн эрчим хүч ба орлого, аюулгүй байдлын сэрэмжлүүлэг харагдана. Карт дээр дарж дэлгэрэнгүй жагсаалт руу орно.',
  },
  {
    target: 'page-guide',
    side: 'bottom',
    align: 'end',
    tag: 'Тусламж',
    title: 'Хуудас бүрийн «?» заавар',
    body: 'Станц, Харилцагч, RFID карт, Мэдээ хуудсуудын гарчгийн хажууд «?» товч бий. Хуудсыг анх нээхэд заавар нь өөрөө гарч, дараа нь энэ товчоор хүссэн үедээ дахин үзнэ.',
  },
];

type Mode = 'auto' | 'replay' | 'preview';

const SESSION_KEY = 'eplug-admin-guide-dismissed';
const LG_QUERY = '(min-width: 1024px)';

// sessionStorage alone is per tab, so a new tab would show the guide again.
// The flag is also a browser-session cookie (no expiry: shared by every tab,
// gone when the browser closes, and cleared by logout() so the next sign-in
// shows the guide again while the account still has guidePending).
function sessionDismissed(): boolean {
  try {
    if (document.cookie.split('; ').includes(`${GUIDE_DISMISSED_COOKIE}=1`)) return true;
    return window.sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

function setSessionDismissed(): void {
  try {
    document.cookie = `${GUIDE_DISMISSED_COOKIE}=1; path=${BASE_PATH || '/'}; SameSite=Lax`;
    window.sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    // Storage blocked — the guide may show again on reload, which is harmless.
  }
}

/** The step's target, if it is rendered and visible; otherwise the card centres. */
function visibleTarget(name: string): Element | undefined {
  const el = document.querySelector(`[data-tour="${name}"]`);
  if (!el || el.getClientRects().length === 0) return undefined;
  return el;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface GuideContextValue {
  /** Replay the guide from the start, ignoring the server flag. */
  startGuide: () => void;
  /**
   * True while the first-run guide is being checked for, waiting to start or
   * running. Page «?» guides hold their first-visit auto-open until it clears,
   * so the two never pop up on top of each other.
   */
  suppressPageGuides: boolean;
  /** The guide is about to start or on screen — hold toasts until it closes. */
  guideActive: boolean;
}

const GuideContext = React.createContext<GuideContextValue>({
  startGuide: () => {},
  suppressPageGuides: false,
  guideActive: false,
});

export function useFirstRunGuide(): GuideContextValue {
  return React.useContext(GuideContext);
}

export function FirstRunGuideProvider({
  setMenuOpen,
  children,
}: {
  /** Opens/closes the sidebar drawer on narrow screens. */
  setMenuOpen: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const driverRef = React.useRef<Driver | null>(null);
  const [status, setStatus] = React.useState<'checking' | 'pending' | 'running' | 'idle'>('checking');
  const setMenuOpenRef = React.useRef(setMenuOpen);
  React.useEffect(() => {
    setMenuOpenRef.current = setMenuOpen;
  }, [setMenuOpen]);

  const run = React.useCallback((mode: Mode) => {
    if (driverRef.current?.isActive()) return;

    const total = STEPS.length;
    let dontShowAgain = false;
    let ended = false;
    let drawerOpen = false;
    let busy = false;

    const narrow = () => !window.matchMedia(LG_QUERY).matches;
    const setDrawer = (open: boolean) => {
      drawerOpen = open;
      setMenuOpenRef.current(open);
    };

    const dark = document.documentElement.classList.contains('dark');

    const steps: DriveStep[] = STEPS.map((s) => ({
      element: s.target ? () => visibleTarget(s.target!) as Element : undefined,
      popover: { description: s.body, side: s.side, align: s.align },
    }));

    function end(reason: 'skip' | 'close' | 'finish') {
      if (ended) return;
      ended = true;
      drv.destroy();
      document.body.classList.remove('eg-guide-on');
      if (drawerOpen) setDrawer(false);
      driverRef.current = null;
      setStatus('idle');

      if (mode === 'replay') return;
      const persist = reason === 'finish' || dontShowAgain;
      if (mode === 'preview') {
        console.info(`[guide preview] ${reason}: ${persist ? 'POST auth/me/guide-done' : 'session flag only'}`);
        return;
      }
      if (persist) {
        api.post('auth/me/guide-done').catch(() => setSessionDismissed());
      } else {
        setSessionDismissed();
      }
    }

    async function goTo(index: number) {
      if (ended || busy || index < 0 || index >= total) return;
      busy = true;
      try {
        // The sidebar is off-canvas below lg: slide it in for its step and wait
        // out the transition so the spotlight lands on its final position.
        const wantDrawer = Boolean(STEPS[index].drawer) && narrow();
        if (wantDrawer !== drawerOpen) {
          setDrawer(wantDrawer);
          await wait(320);
        }
        if (ended) return;
        if (drv.isActive()) drv.moveTo(index);
        else drv.drive(index);
      } finally {
        busy = false;
      }
    }

    function next() {
      const i = drv.getActiveIndex() ?? 0;
      if (i >= total - 1) end('finish');
      else void goTo(i + 1);
    }

    function renderCard(container: HTMLElement, index: number) {
      const step = STEPS[index];
      const last = index === total - 1;

      const card = el('div', 'eg-card');
      card.appendChild(el('span', 'eg-glow'));

      const close = el('button', 'eg-x', '✕');
      close.type = 'button';
      close.setAttribute('aria-label', 'Хаах');
      close.addEventListener('click', () => end('close'));
      card.appendChild(close);

      const head = el('div', 'eg-head');
      const tag = el('span', 'eg-tag');
      tag.appendChild(el('i', 'eg-tag-dot'));
      tag.appendChild(document.createTextNode(step.tag));
      head.appendChild(tag);
      head.appendChild(el('span', 'eg-count', `${index + 1} / ${total}`));
      card.appendChild(head);

      card.appendChild(el('h3', 'eg-title', step.title));
      card.appendChild(el('p', 'eg-desc', step.body));

      const foot = el('div', 'eg-foot');

      if (mode !== 'replay') {
        const label = el('label', 'eg-check');
        const box = el('input', '');
        box.type = 'checkbox';
        box.checked = dontShowAgain;
        box.addEventListener('change', () => {
          dontShowAgain = box.checked;
        });
        label.appendChild(box);
        label.appendChild(el('span', 'eg-check-box'));
        label.appendChild(el('span', 'eg-check-text', 'Дахиж харахгүй'));
        foot.appendChild(label);
      }

      const row = el('div', 'eg-row');
      const skip = el('button', 'eg-skip', 'Алгасах');
      skip.type = 'button';
      skip.addEventListener('click', () => end('skip'));
      row.appendChild(skip);

      const dots = el('div', 'eg-dots');
      dots.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < total; i++) dots.appendChild(el('span', i === index ? 'eg-dot is-active' : 'eg-dot'));
      row.appendChild(dots);

      const nextBtn = el('button', 'eg-next', last ? 'Ойлголоо ✓' : 'Дараах →');
      nextBtn.type = 'button';
      nextBtn.addEventListener('click', next);
      row.appendChild(nextBtn);

      foot.appendChild(row);
      card.appendChild(foot);

      container.replaceChildren(card);
    }

    const drv = driver({
      steps,
      animate: true,
      allowClose: true,
      overlayClickBehavior: 'close',
      disableActiveInteraction: false,
      overlayColor: '#020617',
      overlayOpacity: dark ? 0.72 : 0.55,
      stagePadding: 8,
      stageRadius: 12,
      popoverOffset: 14,
      popoverClass: 'eg-popover',
      showButtons: [],
      onNextClick: () => next(),
      onPrevClick: () => {
        const i = drv.getActiveIndex() ?? 0;
        void goTo(i - 1);
      },
      // Esc goes through here; programmatic destroy() does not.
      onDestroyStarted: () => end('close'),
      onPopoverRender: (popover, { state }) => {
        renderCard(popover.description, state.activeIndex ?? 0);
      },
    });

    driverRef.current = drv;
    setStatus('running');
    setMenuOpenRef.current(false);
    document.body.classList.add('eg-guide-on');
    void goTo(0);
  }, []);

  // Auto-show for a new operator, once the page has settled.
  React.useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    // A page's own «?» guide (a native <dialog>, which sits in the top layer
    // above any overlay) may auto-open on first visit: let it close first.
    const startWhenIdle = (mode: Mode) => {
      if (cancelled) return;
      if (document.querySelector('dialog[open]')) {
        timer = setTimeout(() => startWhenIdle(mode), 800);
        return;
      }
      run(mode);
    };

    // Dev-only: `?tour=1` previews the auto-shown guide without the server.
    const preview =
      process.env.NODE_ENV !== 'production' &&
      new URLSearchParams(window.location.search).get('tour') === '1';
    const pending: Promise<boolean> = preview
      ? Promise.resolve(true)
      : sessionDismissed()
        ? Promise.resolve(false)
        : api
            .get<{ guidePending?: boolean } | null>('auth/me')
            .then((me) => me?.guidePending === true)
            // Backend unreachable — no guide this time; nothing to loop on.
            .catch(() => false);

    void pending.then((show) => {
      if (cancelled) return;
      setStatus(show ? 'pending' : 'idle');
      if (show) timer = setTimeout(() => startWhenIdle(preview ? 'preview' : 'auto'), 700);
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [run]);

  // Tear down if the shell unmounts mid-guide (logout, hard error).
  React.useEffect(
    () => () => {
      driverRef.current?.destroy();
      document.body.classList.remove('eg-guide-on');
    },
    [],
  );

  const value = React.useMemo(
    () => ({
      startGuide: () => run('replay'),
      suppressPageGuides: status !== 'idle',
      guideActive: status === 'pending' || status === 'running',
    }),
    [run, status],
  );

  return <GuideContext.Provider value={value}>{children}</GuideContext.Provider>;
}
