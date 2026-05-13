---
name: Medieval Kingdom Builder Design System
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#d5c4ab'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#9e8f78'
  outline-variant: '#514532'
  surface-tint: '#ffba20'
  primary: '#ffdca1'
  on-primary: '#412d00'
  primary-container: '#ffb800'
  on-primary-container: '#6b4c00'
  inverse-primary: '#7c5800'
  secondary: '#c6c6c9'
  on-secondary: '#2f3133'
  secondary-container: '#454749'
  on-secondary-container: '#b4b5b7'
  tertiary: '#ffd8d1'
  on-tertiary: '#690000'
  tertiary-container: '#ffb1a5'
  on-tertiary-container: '#a1170d'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdea8'
  primary-fixed-dim: '#ffba20'
  on-primary-fixed: '#271900'
  on-primary-fixed-variant: '#5e4200'
  secondary-fixed: '#e2e2e5'
  secondary-fixed-dim: '#c6c6c9'
  on-secondary-fixed: '#1a1c1e'
  on-secondary-fixed-variant: '#454749'
  tertiary-fixed: '#ffdad4'
  tertiary-fixed-dim: '#ffb4a8'
  on-tertiary-fixed: '#410000'
  on-tertiary-fixed-variant: '#920703'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  display-lg:
    fontFamily: Cinzel
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: 0.05em
  headline-lg:
    fontFamily: Cinzel
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-md:
    fontFamily: Cinzel
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Crimson Text
    fontSize: 20px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Crimson Text
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 26px
  label-md:
    fontFamily: Cinzel
    fontSize: 14px
    fontWeight: '700'
    lineHeight: 20px
    letterSpacing: 0.1em
  headline-lg-mobile:
    fontFamily: Cinzel
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 48px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 64px
---

## Brand & Style
The design system is rooted in a **Tactile / Skeuomorphic** aesthetic, designed to immerse players in a high-stakes world of medieval governance. The visual narrative balances the rugged weight of iron and stone with the delicate refinement of gold filigree, evoking the feeling of a monarch’s war room at midnight.

The target audience seeks depth, strategy, and atmospheric immersion. Every interaction should feel physical; buttons should feel like heavy wood being pressed, and panels should feel like ancient scrolls unfurling. The emotional response is one of authority, antiquity, and consequence.

## Colors
The palette is dominated by **Deep Charcoal** (#121212) and **Midnight Onyx** to provide a high-contrast foundation for atmospheric lighting effects. **Warm Amber** serves as the primary action color, mimicking the glow of candlelight against dark surfaces.

- **Backgrounds:** Use layered dark neutrals with subtle noise textures to simulate weathered stone.
- **Highlights:** **Gold Filigree** (#D4AF37) is reserved for ornate borders and regal headers.
- **Semantic States:** **Forest Green** represents growth and successful construction, while **Crimson** indicates architectural damage, low resources, or declaration of war.
- **Content Surfaces:** **Aged Parchment** is used for high-readability text blocks, providing a scholarly contrast to the dark environment.

## Typography
This design system utilizes a dual-type strategy to distinguish between "The Proclamation" (Headings) and "The Chronicle" (Body).

- **Cinzel (Headings):** Used for all titles, buttons, and labels. Its stone-cut, all-caps nature conveys permanence and royal decree. Letter spacing should be increased slightly for a more premium, engraved look.
- **Crimson Text (Body):** Used for lore descriptions, resource counts, and tutorial text. This serif provides excellent legibility against textured backgrounds and maintains the scholarly, historical feel of the era.

## Layout & Spacing
The layout follows a **Fixed Grid** philosophy, centering the kingdom management interface within a "Command Table" view. 

- **Desktop:** A 12-column grid with wide 64px margins to allow the atmospheric background (the map or the throne room) to frame the UI.
- **Mobile:** A 4-column grid with 16px margins, utilizing full-screen "scroll" overlays for menus.
- **Rhythm:** Spacing follows a 4px base unit. Larger gaps (48px+) should be used between distinct modular panels (e.g., Resource Bar vs. Building Menu) to emphasize their physical separation as distinct "objects" on the table.

## Elevation & Depth
Depth is conveyed through **Tactile Layering** and material properties rather than standard drop shadows.

- **Translucent Dark Panels:** Primary UI containers use a 85% opacity charcoal base with a 20px backdrop blur, simulating thick obsidian or dark stained glass.
- **Inner Shadows:** Elements use subtle 2px inner shadows (top-down) to create an "inset" look, as if carved into the wood or stone surface.
- **Ambient Lighting:** Panels should feature a very faint "candlelight" top-edge highlight (Amber, 10% opacity) to suggest they are being lit by an environmental light source.
- **Ornate Borders:** Use high-contrast gold filigree lines (1px) as the outermost "stroke" for elevated windows to denote importance.

## Shapes
The shape language is **Soft (0.25rem)** to mimic the natural wear of old materials. 

- **Containers:** Rectangular with small radii to suggest hand-cut stone or wood planks. Avoid perfectly sharp corners to maintain the "weathered" feel.
- **Interactive Elements:** Use the `rounded-lg` (0.5rem) setting for buttons to give them a slightly "chunky," tactile appearance.
- **Decorative Masks:** Circular or arched shapes are used specifically for character portraits and "Seal of Approval" icons.

## Components
- **Buttons:** Styled as **Dark Oak Planks**. In the default state, they feature a 1px hammered iron border. In the "Active/Hover" state, the border glows with Gold Filigree and Amber inner light.
- **Cards/Panels:** These utilize a "Scroll Wrap" or "Stone Slab" appearance. Headers are separated from body content by a thin, ornate gold horizontal rule.
- **Input Fields:** Inset into the surface using an inner shadow. The background is a darker shade of charcoal than the surrounding panel to create a "carved" slot effect.
- **Progress Bars:** Designed as a channel in stone, with the fill color being a glowing "molten" Amber or Forest Green.
- **Checkboxes:** Stylized as wax seals. When "checked," the seal is stamped with a royal insignia.
- **Additional Components:** 
    - **Modals:** Presented as an unfurling parchment scroll with animated wooden rollers at the top and bottom.
    - **Resource Chips:** Small circular stone icons with engraved gold symbols representing gold, wood, and stone.