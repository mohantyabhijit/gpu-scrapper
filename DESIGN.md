---
name: Raster
description: A calm, evidence-led sourcing desk for market-local electronics offers.
colors:
  paper: "#f8f9fc"
  surface: "#ffffff"
  surface-soft: "#f2f5fb"
  ink: "#101828"
  slate: "#344054"
  muted: "#475467"
  subtle: "#5f6b7a"
  line: "#e4e7ec"
  line-strong: "#d0d5dd"
  primary: "#635bff"
  primary-dark: "#5147e5"
  primary-soft: "#f0efff"
  action: "#1677ff"
  action-soft: "#eef6ff"
  healthy: "#079455"
  healthy-soft: "#ecfdf3"
  caution: "#b54708"
  caution-soft: "#fffaeb"
  danger: "#d92d20"
  danger-soft: "#fef3f2"
typography:
  display:
    fontFamily: "Geist, Inter, Arial, sans-serif"
    fontSize: "clamp(42px, 3.55vw, 56px)"
    fontWeight: 720
    lineHeight: 1.03
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Geist, Inter, Arial, sans-serif"
    fontSize: "clamp(29px, 3vw, 42px)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.035em"
  body:
    fontFamily: "Geist, Inter, Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.58
  label:
    fontFamily: "Geist, Inter, Arial, sans-serif"
    fontSize: "10px"
    fontWeight: 650
    lineHeight: 1.4
    letterSpacing: "0.06em"
  mono:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.45
rounded:
  status: "6px"
  compact: "8px"
  field: "9px"
  control: "10px"
  panel: "12px"
  trace: "14px"
  full: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
  3xl: "32px"
  shell: "52px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "11px 17px"
    height: "44px"
    typography: "{typography.label}"
  button-primary-hover:
    backgroundColor: "{colors.primary-dark}"
    textColor: "{colors.surface}"
  button-quiet:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.slate}"
    rounded: "{rounded.control}"
    padding: "11px 17px"
    height: "44px"
  filter-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.slate}"
    rounded: "{rounded.field}"
    padding: "0 14px"
    height: "42px"
  filter-chip-selected:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary}"
    rounded: "{rounded.compact}"
    padding: "7px 10px"
  state-pill-ready:
    backgroundColor: "{colors.healthy-soft}"
    textColor: "{colors.healthy}"
    rounded: "{rounded.status}"
    padding: "4px 7px"
    typography: "{typography.label}"
---

# Design System: Raster

## Overview

**Creative North Star: "The Evidence Ledger"**

Raster is an original light enterprise data product: calm, exact, commercially credible, and built to make provenance legible. Warm-white ground, ink and slate typography, cool-gray rules, restrained violet and blue actions, and small semantic health signals make dense sourcing evidence feel orderly rather than decorative.

Stripe is the craft benchmark, not a source of copied brand assets, gradients, illustrations, or composition. The system earns polish through typography, spacing, state clarity, and precise authored outline icons.

**Key Characteristics:**

- Warm-white canvas inside a bordered white application shell.
- Compact ledger rows and trace stages instead of generic icon-card grids.
- Restrained accent color, explicit semantic states, and visible evidence boundaries.
- Responsive density that preserves all four trace stages without horizontal scrolling.

## Colors

The palette is neutral-led: violet identifies the product, blue marks navigation and verification actions, and green, amber, and red communicate evidence state.

### Primary

- **Raster Violet:** The scarce brand and primary-action accent; its darker state is reserved for interaction and its soft tint for selected or branded surfaces.

### Secondary

- **Verification Blue:** Links, source verification, policy markers, and trace actions.

### Tertiary

- **Evidence Green, Caution Amber, and Danger Red:** Small status signals paired with words; never standalone decoration.

### Neutral

- **Paper and Surface:** The outer canvas, application shell, and contained ledger rows.
- **Ink, Slate, Muted, and Subtle:** A descending hierarchy from decisive headings to supporting metadata.
- **Line and Strong Line:** Fine structural rules and control boundaries.

### Named Rules

**The Evidence-First Color Rule.** Semantic color must reinforce a visible state label, never replace one.

**The One Accent Rule.** Violet is the brand voice and blue is the verification voice; do not blur their jobs or flood a surface with either.

## Typography

**Display Font:** Geist (with Inter, Arial, and sans-serif fallbacks)  
**Body Font:** Geist (with Inter, Arial, and sans-serif fallbacks)  
**Label/Mono Font:** Geist Mono (with ui-monospace and monospace fallbacks)

**Character:** One disciplined sans-serif family keeps procurement content contemporary and neutral. Tight display tracking adds authority; compact uppercase labels and tabular numerals make evidence easy to scan.

### Hierarchy

- **Display:** Heavy, tightly tracked, and balanced; reserved for hero statements.
- **Headline:** Tight section headings that establish clear ledger chapters.
- **Title:** Compact medium-to-bold names for offers, collectors, and pipeline checks.
- **Body:** Readable supporting copy, generally constrained to 58-68 characters per line.
- **Label:** Small, semibold, uppercase metadata for metrics, states, and field groups.
- **Mono:** Collector IDs, immutable evidence identifiers, and code-like values only.

### Named Rules

**The Numeric Evidence Rule.** Prices and counts use tabular numerals; identifiers use mono; neither treatment is decorative.

## Layout

The white application shell is centered and capped at 1480px with fine inline borders. Desktop page gutters use a fluid 24-52px range; editorial sections may open to 105px. The first viewport pairs a compact hero with a four-stage source trace, while the offer and health surfaces use bordered list and ledger structures.

At 1100px the hero becomes one column. At 760px navigation simplifies, filters and evidence grids stack, and gutters settle at 20px. The source trace deliberately remains four equal columns with abbreviated labels on mobile; below 440px it becomes a single column.

## Elevation & Depth

Raster is flat by default. Borders, background tone, and spacing establish hierarchy; the source trace receives the system's only ambient shell shadow, while buttons gain a smaller shadow on hover.

### Shadow Vocabulary

- **Trace shell** (`0 18px 46px rgba(16,24,40,.07), 0 2px 8px rgba(16,24,40,.04)`): The source-to-offer mechanism in the hero.
- **Button hover** (`0 8px 18px rgba(16,24,40,.08)`): A restrained interactive lift paired with a one-pixel translation.

### Named Rules

**The Flat-by-Default Rule.** Rows and panels remain flat at rest; use tonal layering and fine rules before adding elevation.

## Shapes

Corners are gently curved and functional. Six-to-ten-pixel radii belong to status labels, chips, fields, and buttons; twelve-to-fourteen-pixel radii define panels and the signature trace. Circular geometry is limited to status dots, trace connectors, and the play control. Borders remain one pixel and cool gray.

## Components

### Buttons

- **Shape:** Compact, gently curved controls with a 44px desktop minimum height and 10px corners.
- **Primary:** Violet fill, white text, and restrained 11px by 17px padding.
- **Hover / Focus:** One-pixel lift, darker fill or stronger border, a short ease-out transition, and the shared blue focus outline.
- **Secondary / Ghost:** White surface, slate text, and a strong neutral border; hover may introduce a pale violet surface.

### Chips

- **Style:** Compact outlined labels with 8px corners and 7px by 10px padding.
- **State:** Selection shifts to pale violet with violet text and border. Health and evidence chips use the semantic tint matching their written state.

### Cards / Containers

- **Corner Style:** Twelve-pixel panels and fourteen-pixel signature trace shells.
- **Background:** White rows over paper or soft-surface section grounds.
- **Shadow Strategy:** Flat except for the source trace; see Elevation & Depth.
- **Border:** One-pixel cool-gray rules divide rows and groups.
- **Internal Padding:** Compact ledger rows use 18-22px; broader evidence cards use 28px.

### Inputs / Fields

- **Style:** White fill, neutral one-pixel stroke, 9px corners, 42px minimum height, and 14px inline padding.
- **Focus:** Shared 3px translucent blue outline with 3px offset.
- **Disabled / Empty:** Keep content legible and use explicit copy; never imply state through reduced opacity alone.

### Navigation

The 68px top bar uses the authored Raster mark, compact 13px links, and a violet two-pixel active underline. Desktop shows primary navigation and a bordered Data health action; mobile hides the link group while preserving brand and the essential action or status.

### Source Trace

The signature component is a four-stage bordered ledger from public retailer to market-local offer. Each stage uses the same authored outline-icon family, a tinted 42px icon tile, centered evidence copy, and circular arrow connectors. Its content must change with the selected market.

### Offer and Health Rows

Offer, collector, and pipeline records are full-width divided rows rather than floating cards. Align identity, price or evidence, state, and action into stable columns on desktop, then stack them in reading order on mobile.

## Do's and Don'ts

### Do:

- **Do** show market, currency, source, freshness, and health beside the data they qualify.
- **Do** preserve the bordered ledger grammar and the authored outline icon family across storefront and Data health.
- **Do** use text with every green, amber, or red state and retain the visible focus treatment.
- **Do** keep dense ledger copy at least 11px and collapse columns before sacrificing readability.

### Don't:

- **Don't** copy Stripe's brand, gradients, illustrations, or page composition.
- **Don't** use gradient text, glass decoration, italic serif display type, or a generic icon-card scaffold.
- **Don't** turn evidence into decorative cards or invent a live, fresh, or healthy state.
- **Don't** introduce commerce language, cross-market rankings, or silent currency conversion into the visual hierarchy.
