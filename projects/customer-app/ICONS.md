# How icons are loaded in this Angular design

This generated FlashDrop mockup currently uses a simple, dependency-free icon approach:

1. **Emoji / Unicode icons**
   - Many UI icons are directly rendered as text characters, for example:
     - `⚡`
     - `🛒`
     - `📍`
     - `⌕`
     - `👤`
     - `★`
   - These do not require any icon library or network request.
   - They work as long as the browser/OS font supports emoji.

2. **Text glyph icons**
   - Some minimal symbols use unicode glyphs like `×`, `←`, `›`, `⌂`, `▣`.
   - These are also rendered directly by the browser.

3. **Remote images**
   - Product/store visuals are remote image URLs.
   - They are not icon-library icons.
   - You can replace them with local assets under `src/assets`.

4. **No Material Icons dependency**
   - This mockup does not require `<mat-icon>`.
   - It does not require Angular Material icon font.
   - It does not require Font Awesome or Lucide.

## If you want real SVG icons later

Recommended production approach:

- Create an `IconComponent`.
- Store all SVG paths in a TypeScript map.
- Render inline SVG based on the icon name.
- This avoids external font loading issues.

Example usage:

```html
<fd-icon name="cart" />
<fd-icon name="location" />
<fd-icon name="user" />
```

## Updating existing customer-app

If your existing customer-app uses Material icons:

- Keep Material icons only if `index.html` loads the font:

```html
<link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet" />
```

If you do not want Material icons:

- Replace `<mat-icon>shopping_cart</mat-icon>` with either:

```html
<span class="icon">🛒</span>
```

or your own:

```html
<fd-icon name="cart" />
```
