# Theme Options

This project uses CSS variables for theming. Three theme variants are provided below.

## Current: Modern Neutral

Clean slate grays with an ocean blue accent. Professional, minimal, and works well for enterprise applications.

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222 47% 11%;
  --primary: 221 83% 53%;        /* Ocean blue */
  --secondary: 220 14% 96%;
  --muted: 220 14% 96%;
  --muted-foreground: 220 9% 46%;
  --border: 220 13% 91%;
}

.dark {
  --background: 222 47% 6%;
  --foreground: 210 20% 98%;
  --primary: 217 91% 60%;        /* Brighter blue for dark mode */
  --secondary: 222 47% 14%;
  --muted: 222 47% 14%;
  --muted-foreground: 220 9% 64%;
  --border: 222 47% 16%;
}
```

## Option 1: Ocean Deep

Deeper, more saturated blues for a bolder enterprise look.

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222 47% 11%;
  --primary: 224 76% 48%;        /* Deep royal blue */
  --secondary: 220 14% 96%;
  --muted: 220 14% 96%;
  --muted-foreground: 220 9% 46%;
  --border: 220 13% 91%;
}

.dark {
  --background: 222 47% 6%;
  --foreground: 210 20% 98%;
  --primary: 213 94% 68%;        /* Electric blue */
  --secondary: 222 47% 14%;
  --muted: 222 47% 14%;
  --muted-foreground: 220 9% 64%;
  --border: 222 47% 16%;
}
```

## Option 2: Warm Neutral

Warm amber tones for a more inviting, approachable feel.

```css
:root {
  --background: 0 0% 100%;
  --foreground: 20 14% 10%;
  --primary: 25 95% 53%;        /* Warm amber */
  --secondary: 30 10% 96%;
  --muted: 30 10% 96%;
  --muted-foreground: 25 6% 45%;
  --border: 30 10% 90%;
}

.dark {
  --background: 20 14% 6%;
  --foreground: 30 10% 98%;
  --primary: 35 92% 60%;        /* Golden amber */
  --secondary: 20 14% 14%;
  --muted: 20 14% 14%;
  --muted-foreground: 25 6% 64%;
  --border: 20 14% 16%;
}
```

## Option 3: Forest Green

Nature-inspired greens, great for eco-friendly or health-focused applications.

```css
:root {
  --background: 0 0% 100%;
  --foreground: 144 20% 10%;
  --primary: 142 76% 36%;        /* Forest green */
  --secondary: 140 10% 96%;
  --muted: 140 10% 96%;
  --muted-foreground: 140 6% 45%;
  --border: 140 10% 90%;
}

.dark {
  --background: 144 20% 6%;
  --foreground: 140 10% 98%;
  --primary: 142 71% 50%;        /* Bright green */
  --secondary: 144 20% 14%;
  --muted: 144 20% 14%;
  --muted-foreground: 140 6% 64%;
  --border: 144 20% 16%;
}
```

## How to Switch Themes

1. Open `src/app/globals.css`
2. Replace the `:root` and `.dark` variable values with your preferred theme
3. Restart the dev server: `npm run dev`

## Status & Priority Colors

These are used consistently across the approval workflow and dashboard:

```css
:root {
  --status-pending: 239 84% 67%;   /* Indigo */
  --status-reviewing: 38 92% 50%;   /* Amber */
  --status-approved: 142 76% 36%;    /* Green */
  --status-rejected: 0 72% 51%;     /* Red */

  --priority-p1: 0 72% 51%;         /* Red - Critical */
  --priority-p2: 25 95% 53%;        /* Orange - High */
  --priority-p3: 48 96% 53%;       /* Yellow - Medium */
  --priority-p4: 220 9% 46%;       /* Gray - Low */
}
```

## CSS Utility Classes

Added utility classes for common patterns:

- `.focus-ring` - Consistent focus ring styling
- `.interactive` - Color transition for hover states
- `.card-hover` - Card hover effect with shadow
