# Site Audit Checklist (Hiring)

Use this as the working checklist for improving the site for hiring outcomes.

## Discoverability (SEO + Social)

- [ ] Add canonical URL
- [ ] Add Open Graph meta (title/description/url/type/image)
- [ ] Add Twitter card meta
- [ ] Ensure favicon + theme-color meta are set
- [ ] Add `robots.txt`
- [ ] Add `sitemap.xml`
- [ ] Add JSON-LD structured data (`Person`)
- [ ] Ensure `<h1>` contains real text (can be visually hidden)

## Performance

- [ ] Avoid blank-screen gating (don’t block first paint on fonts/images)
- [ ] Lazy-load heavy WebGL/Three.js bundle
- [ ] Defer non-essential third-party scripts (Hotjar/GA)
- [ ] Re-check layout shift (explicit image dimensions / aspect-ratio)

## Accessibility

- [ ] Validate keyboard navigation + focus visibility
- [ ] Ensure reduced-motion mode disables non-essential animation
- [ ] Confirm decorative images have empty alt and meaningful text exists elsewhere
- [ ] Validate color contrast for body copy and links

## Code Organization / Hygiene

- [ ] Fix broken 404 page styling and ensure it uses existing CSS files
- [ ] Fix invalid CSS declarations
- [ ] Ensure CSS layers match declared layer order
- [ ] Remove unused assets (or wire them in)
- [ ] Audit CSS tokens: remove truly unused variables

## Hiring Conversion

- [ ] Add a clear contact CTA (email + LinkedIn + GitHub)
- [ ] Add a “Selected work” section (2–4 projects with impact + links)
- [ ] Add resume link (PDF) and/or one-click email
