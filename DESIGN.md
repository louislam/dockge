# Design System: Dockge Material You
**Project ID:** dockge-material-you-v3

## 1. Visual Theme & Atmosphere
The Dockge user interface embodies the **Material You (Material Design 3)** design language, presenting a highly personalized, fluid, and container-based dashboard. It prioritizes comfortable spacing, tactile interactivity, and expressive shapes. The interface shifts away from rigid corners and harsh borders toward an organic, cohesive visual language.

Key characteristics:
- Generous, rounded corners (up to 24px/1.5rem for cards, fully pill-shaped 50rem for buttons and active states).
- Clear, container-based layering using surface elevations and outlines instead of heavy shadows.
- Cohesive light and dark modes utilizing Material You tonal palettes to reduce eye strain.
- Refined micro-interactions, focus highlights, and smooth transitions that make the app feel alive and responsive.

## 2. Color Palette & Roles

### Light Theme
- **Primary Color:** `#005FAF` – Used for key interactive states, text links, and filled buttons.
- **On-Primary:** `#FFFFFF` – Used for text/icons on top of the Primary color.
- **Primary Container:** `#D4E3FF` – Used as a background for high-priority active elements (e.g. active sidebar/navigation pills).
- **On-Primary Container:** `#001C38` – Text/icon color for elements in the Primary Container.
- **Surface:** `#F8F9FF` – Main page background color.
- **Surface Variant:** `#E0E2EC` – Secondary surface background, used for inputs and container states.
- **On-Surface:** `#191C20` – Main text and icon color on surfaces.
- **On-Surface Variant:** `#43474E` – Subdued text, placeholders, and descriptive labels.
- **Outline:** `#74777F` – Subtle divider borders and outline card limits.
- **Success Container:** `#D1E8D5` – Background for active/online status chips.
- **On-Success Container:** `#0F3820` – Text color for active/online status chips.
- **Danger Container:** `#FFDAD6` – Background for exited/offline status chips.
- **On-Danger Container:** `#410002` – Text color for exited/offline status chips.

### Dark Theme (Default)
- **Primary Color:** `#A5C8FF` – Primary accent color in dark mode.
- **On-Primary:** `#00315F` – Dark text/icons on Primary background.
- **Primary Container:** `#004786` – Active indicator background for navigation items.
- **On-Primary Container:** `#D4E3FF` – Light blue text on active navigation indicators.
- **Surface:** `#111318` – Dark page background.
- **Surface Variant:** `#43474E` – Base background for containers, modals, and input fields.
- **On-Surface:** `#E2E2E9` – Main text and icon color in dark mode.
- **On-Surface Variant:** `#C3C6CF` – Muted body copy and metadata.
- **Outline:** `#8D9199` – Dark mode structural borders.
- **Success Container:** `#1F4E34` – Dark background for active/online status chips.
- **On-Success Container:** `#D1E8D5` – Text color for active/online status chips in dark mode.
- **Danger Container:** `#601416` – Dark background for exited/offline status chips.
- **On-Danger Container:** `#FFDAD6` – Text color for exited/offline status chips in dark mode.

## 3. Typography Rules

- **Primary Font Family:** `Outfit`, Sans-Serif – A friendly, geometric sans-serif that brings humanist warmth to the application interface.
- **Monospace Font Family:** `JetBrains Mono`, Monospace – Used for terminals, Docker Compose YAML code, logs, and technical values.

### Typographic Scale
- **H1 (Page Titles):** 2rem (32px), Font weight 600 (Semi-bold).
- **H2 (Section Headers):** 1.5rem (24px), Font weight 600 (Semi-bold).
- **H3 (Subheadings):** 1.25rem (20px), Font weight 500 (Medium).
- **Body Text:** 1rem (16px), Line-height 1.6, Font weight 400 (Regular).
- **Small Text/Labels:** 0.875rem (14px), Font weight 500 (Medium).
- **Active Pills / Badges:** 0.75rem (12px), Font weight 600 (Semi-bold).

## 4. Component Stylings

* **Buttons:**
  - **Pill Shape:** Rounded borders with `50rem` radius (fully pill-shaped).
  - **Primary (Filled):** Uses Primary color (`#005FAF` Light / `#A5C8FF` Dark) with On-Primary text.
  - **Secondary (Tonal):** Uses Primary Container background with On-Primary Container text.
  - **Outlined:** Uses transparent background with Outline border color and On-Surface text.
  - **Animations:** Smooth hover states (200ms duration) with a slight overlay opacity highlight.

* **Cards/Containers:**
  - **Shape:** Generously rounded corners with `24px` (`1.5rem`) radius.
  - **Styling:** Outlined by default with `1px solid Outline` or filled with `Surface Variant` or `Surface Container` colors.
  - **Elevation:** Flat (0dp) or elevated on hover (2dp, `box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08)`).
  - **Padding:** Comfortable padding (`1.5rem` or `24px`) to give contents adequate room to breathe.

* **Inputs/Forms:**
  - **Outlined Design:** Rounded corners with `12px` (`0.75rem`) border-radius.
  - **Focus State:** 2px solid Primary color border.
  - **Sizing:** Large touch-friendly fields with comfortable vertical (`0.75rem`) and horizontal (`1rem`) padding.

## 5. Layout Principles
- **Grid Layout:** 12-column grid system with fluid gutters.
- **Header:** Top navigation layout with modern profile pills.
- **Side Panel (if applicable):** Unified left navigation area with pill-shaped active links.
- **Whitespace:** Emphasize generous vertical rhythm (1.5rem to 2.5rem between sections) to ensure high readability and simple layout flow.
