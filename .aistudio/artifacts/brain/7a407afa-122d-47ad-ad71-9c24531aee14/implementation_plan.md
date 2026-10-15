# Frontend Design Improvement & Color Harmonization Plan

Comprehensive frontend design system and visual refinement for the Puzzles Assessment App, following `/frontend-design/SKILL.md` and WCAG AA accessibility standards across Light Mode and Dark Mode.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> **Design Grounding & Theme Direction**:
> The application is a multi-role educational assessment platform (Super Admin, School Admin, and Student Portal) featuring puzzle evaluations, adaptive scoring, time-sensitive student sessions, and institutional reporting.
> 
> We are proposing a refined **Academic Precision** visual identity:
> - **Primary Accent**: Deep Indigo (`#4338CA` / `#4F46E5`), conveying scholastic rigor, focus, and clarity without generic AI neon tints.
> - **Semantic Accents**: Deep Emerald (`#059669` / `#10B981`) for completed/verified states, Crisp Amber (`#D97706` / `#F59E0B`) for pending/time warnings, and Crimson (`#DC2626` / `#EF4444`) for errors/destructives.
> - **Light Mode Canvas**: Pristine neutral slate background (`#F8FAFC`), crisp white structural surfaces (`#FFFFFF`), hairline borders (`#E2E8F0`), high-contrast slate body text (`#0F172A`), and readable secondary labels (`#475569`, strictly $\ge 4.5:1$ contrast).
> - **Dark Mode Canvas**: Deep obsidian slate (`#0B0F19`), rich dark surfaces (`#111827` / `#1E293B`), hairline structural borders (`#1F2937` / `#374151`), crisp off-white text (`#F8FAFC`), and soft secondary labels (`#94A3B8`).
>
> Please review the detailed design tokens, component architecture, and ASCII layouts below before approving implementation.

---

## 1. Design Token System & Principles (Frontend Design Skill Pass)

### A. Compact Color Token System (Core 6 Named Hex Values)
1. **Canvas Neutral**: `#F8FAFC` (Light) / `#0B0F19` (Dark) — 60% dominant neutral foundation providing deep, glare-free optical comfort.
2. **Surface Neutral**: `#FFFFFF` (Light) / `#111827` (Dark) — 30% structural surfaces for cards, tables, headers, and dialogs.
3. **Hairline Border**: `#E2E8F0` (Light) / `#1F2937` (Dark) — Crisp 1px structural framing without thick accent bars.
4. **Scholastic Primary**: `#4338CA` (Light) / `#6366F1` (Dark) — 10% intentional accent budget reserved for primary calls to action, active tabs, and selection states.
5. **Verified / Success**: `#059669` (Light) / `#10B981` (Dark) — High-contrast semantic indicators for passing scores, verified institutions, and completed tests.
6. **Alert / Overdue**: `#DC2626` (Light) / `#EF4444` (Dark) — Clear semantic indicators for errors, timer alerts, and destructive actions.

### B. Typography Roles & Pairings
- **Display & Headings**: `Plus Jakarta Sans` (SemiBold 600, Bold 700) with balanced headline wrapping (`text-wrap: balance`) and tighter tracking (`tracking-tight`).
- **Body & Controls**: `Plus Jakarta Sans` (Regular 400, Medium 500) with line height 1.5–1.6 and line lengths $\le 75\text{ch}$.
- **Data, Metrics & Timers**: `JetBrains Mono` with tabular numerals (`tabular-nums`) strictly applied to puzzle grids, timer countdowns, question indices, scores, and dates to eliminate layout jitter.

### C. Layout Concepts & Alignment
- **Super Admin & School Admin Dashboards**: Left-aligned desktop navigation sidebar (240px–260px) paired with a high-density, single-elevation workspace canvas. Clean 3-zone top bar contract for mobile/tablet responsive views.
- **Student Assessment Portal**: Centered, distraction-free stage layout (max-width 1024px) keeping the active question, timer, and puzzle interaction canvas centered with immediate visual clarity.
- **Data Tables & Lists**: Left-aligned textual metadata, right-aligned numeric scores and actions, with high-density padding (10px–12px vertical).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ SUPER ADMIN / SCHOOL WORKSPACE LAYOUT (Desktop 1440px)                       │
├───────────────┬─────────────────────────────────────────────────────────────┤
│ Brand Mark    │ Contextual Breadcrumb / Section Title        [Profile & Theme]│
├───────────────┼─────────────────────────────────────────────────────────────┤
│ [Nav 1]       │ ┌─────────────────────────────────────────────────────────┐ │
│ [Nav 2 Active]│ │ High-Density Filter & Search Bar                        │ │
│ [Nav 3]       │ └─────────────────────────────────────────────────────────┘ │
│ [Nav 4]       │ ┌─────────────────────────────────────────────────────────┐ │
│               │ │ Primary Surface / Data Table / Interactive Form         │ │
│               │ │ - Single elevation (1px border, zero heavy shadows)     │ │
│               │ │ - Tabular figures for dates, counts, and scores         │ │
│               │ │ - WCAG AA text contrast across Light & Dark modes       │ │
│               │ └─────────────────────────────────────────────────────────┘ │
├───────────────┴─────────────────────────────────────────────────────────────┤
│ STUDENT ASSESSMENT PORTAL LAYOUT (Max-Width 1024px Centered)                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Top Bar: School / Test Name ──── Time Countdown (Mono) ── [Profile/Exit]│ │
│ ├─────────────────────────────────────────────────────────────────────────┤ │
│ │ Question Progress Bar (Clean unboxed metadata, e.g. "Question 3 of 15") │ │
│ │ ┌─────────────────────────────────────────────────────────────────────┐ │ │
│ │ │ Active Question Canvas / Flame Puzzle Grid / Interactive Match      │ │ │
│ │ │ Options: High-contrast selection state with keyboard & touch bounds │ │ │
│ │ └─────────────────────────────────────────────────────────────────────┘ │ │
│ │ Bottom Control Bar: [Previous]                      [Next / Submit Test]│ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### D. Anti-Defaulting Review & Unique Principles
- **No Cliché Tells**:
  - No warm cream + terracotta or near-black + acid-green cliches.
  - No generic all-caps tracked-out micro-labels or `//` code comment headers.
  - No decorative pulsing green dots on static cards.
  - No thick asymmetric left accent borders (`border-l-4`).
  - No card-inside-card nesting; whitespace margins and hairline dividers maintain clean visual grouping.
- **Domain Authenticity**: Tailored specifically for school assessments, cognitive puzzles, and administrative auditing. Focus is on scannability, legibility, and zero cognitive fatigue during timed tests.

---

## 2. Component-by-Component Improvement Scope

### A. Global Styles & Theme Synchronization (`src/index.css`)
- **Fix Color Contrast**:
  - Standardize light mode text hierarchy: `--text-primary: #0F172A`, `--text-secondary: #475569` (passing 4.5:1 ratio), `--text-muted: #64748B`.
  - Standardize dark mode text hierarchy: `--text-dark-primary: #F8FAFC`, `--text-dark-secondary: #CBD5E1`, `--text-dark-muted: #94A3B8`.
- **Form Controls & Interactive States**:
  - Universal input/select styling: `border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100`.
  - Fix dropdown `<option>` background in dark mode across all browsers so options never show unreadable black-on-black or white-on-white text.
  - Standardize focus ring: `focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900`.
  - Standardize disabled states: `disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-800/50`.

### B. Authentication & Login Screen (`src/App.tsx`)
- Enhance the login card elevation and spacing.
- Ensure the theme toggle (Light / Dark / System) buttons have crisp contrast in both themes.
- Clarify alert banners (Setup Mode, Error messages, Password recovery notices) with proper semantic icons and WCAG AA background-to-text contrast.

### C. Super Admin Dashboard (`src/components/SuperAdminDashboard.tsx`)
- Harmonize the sidebar navigation items with clean active/inactive pill-free states (`bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 font-semibold`).
- Fix bottom navigation bar on mobile viewports so labels never clip or wrap awkwardly.
- Ensure header user profile menu and theme toggle integrate smoothly.

### D. Schools & Students Section (`src/components/SchoolsSection.tsx`)
- Align table header styling: consistent uppercase 11px font-mono tracking with `#64748B` (Light) and `#94A3B8` (Dark).
- Fix student list search inputs, class/section filter dropdowns, and batch action buttons.
- Update action icons (Edit, Delete, Reset Password, View Report) with clear touch targets ($\ge 36\text{px}$) and accessible tooltip/aria-label support.
- Refine the Reset Password modal and Delete confirmation dialogs to use unified card surfaces and clear warning semantics.

### E. Question Bank & Groups (`src/components/QuestionBankSection.tsx`)
- Fix the question filter pills into clean segmented filter controls.
- Ensure difficulty badges (`Easy`, `Medium`, `Hard`) have high-contrast text and clean unboxed or soft-tinted backgrounds.
- Fix question creation modal, option inputs, explanation fields, and math/image formula areas across Light and Dark themes.

### F. Publish Assessment Section (`src/components/PublishAssessmentSection.tsx`)
- Fix target school/class/section selection checklist, ensuring checkboxes and counters have crisp checkmark contrast.
- Polish `Time12HourPicker`: ensure the hour, minute, and AM/PM selectors have uniform heights, borders, and matching typography.
- Fix question selection preview drawer and date pickers.

### G. Publish History Section (`src/components/PublishHistorySection.tsx`)
- Improve test history cards and status badges (`Active`, `Scheduled`, `Completed`, `Paused`).
- Ensure the multi-school filter dropdown has crisp checkbox labels and scrollable list heights.
- Enhance student drilldown table and export action buttons.

### H. Student Assessment Portal & Flame Mini-Game (`src/components/StudentPortal.tsx`, `FlameMiniGameCanvas.tsx`, `StudentAssessmentPreviewModal.tsx`)
- Ensure assessment header displays student name, class, remaining time, and progress cleanly.
- Fix multiple choice option buttons: selected state in light mode (`bg-indigo-600 text-white`) and dark mode (`bg-indigo-950/80 border-indigo-500 text-white shadow-xs`).
- Adapt `FlameMiniGameCanvas` particle and grid rendering: ensure grid lines and numbers remain crisp and visible in both light mode and dark mode without contrast washout.
- Enhance completion results screen with clear score breakdown and return/logout actions.

### I. Student Report Detail View (`src/components/StudentReportDetailView.tsx`)
- Harmonize the student summary scorecard (Total Score, Percentage, Time Taken, Completion Date).
- Ensure question-by-question breakdown cards display question text, student's answer, correct answer, and points awarded with clear positive/negative contrast.

---

## 3. Verification & Testing Strategy

1. **Compilation & Type Checking**:
   - Run `compile_applet` to ensure zero compilation regressions.
   - Run `lint_applet` (`tsc --noEmit`) to verify zero TypeScript errors.
2. **Visual & Theme Verification**:
   - Verify all primary screens in **Light Mode** (default white/slate-50 background, dark text $\ge 4.5:1$ contrast).
   - Verify all primary screens in **Dark Mode** (deep slate-950/900 background, crisp off-white text, visible borders).
   - Verify System theme switching via `ProfileMenu` and Login page theme switcher.
3. **Interactive & Responsive Verification**:
   - Test button hover, focus, active, and disabled states.
   - Test forms, inputs, dropdown `<select>` options, and time pickers.
   - Test modal dialogs and overlays (password change, question preview, confirmation modals).
4. **Functionality Preservation**:
   - Ensure all APIs, mock endpoints, authentication tokens, and question scoring remain 100% intact.
