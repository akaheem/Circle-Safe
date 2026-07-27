# Frontend Design Reference (user-provided)

Preserved so it survives across sessions / token resets. Do NOT lose these.

## Design template (STYLE ONLY)
- Folder: `c:\Users\mibra\Downloads\bliss-free-lite-version` ("Bliss free lite version").
- Use its **look, layout, spacing, and design language ONLY**. Do NOT reuse its text/content —
  all copy and sections must be CircleSafe's (savings-circle) content.

## Hero animation: Lightfall
- `Lightfall.jsx` — WebGL animated background (uses the `ogl` npm package).
- `Lightfall.css` — container styles.
- `Lightfall-usage.jsx` — how it's mounted in the hero.
- **Dependency to add when building:** `ogl`.
- The palette in these files is the TEMPLATE's (`#A6C8FF`, `#5227FF`, `#FF9FFC`, bg `#0A29FF`).
  It WILL be replaced with CircleSafe's chosen color combination.

## User requirements
1. Different color combination from the template (I propose, user approves).
2. Content = CircleSafe only (don't mix in template content).
3. Add smooth, cool scroll-down animations (scroll-reveal / parallax).
4. Stack target: Next.js + Tailwind + shadcn (adapt template into this).
