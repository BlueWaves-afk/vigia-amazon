# VIGIA RoadIntelligence IDE - Design System

## Design Philosophy

A monochrome, high-density interface inspired by VS Code and GitHub — professional, minimalist, and enterprise-grade.

---

## Color Palette

### Background Colors
```css
--bg-primary: #FFFFFF;      /* Main background */
--bg-secondary: #F5F5F5;    /* Panels, sidebar */
--bg-hover: #E5E7EB;        /* Hover states */
--bg-active: #E5E7EB;       /* Active/selected states */
```

### Border Colors
```css
--border-default: #CBD5E1;  /* 1px solid - default borders */
--border-active: #000000;   /* 2px solid - active tab indicator */
```

### Text Colors
```css
--text-primary: #000000;    /* Headings, primary text */
--text-secondary: #6B7280;  /* Secondary text, labels */
--text-tertiary: #9CA3AF;   /* Disabled, placeholder text */
```

### Accent Colors (Minimal Use)
```css
--accent-success: #10B981;  /* Detection indicators only */
--accent-danger: #EF4444;   /* Live scanning indicator only */
```

---

## Typography

### Font Families
```css
--font-ui: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
--font-data: 'JetBrains Mono', 'Courier New', monospace;
```

### Font Sizes & Weights
```css
/* UI Elements (Inter) */
--text-header: 14px / 600;     /* Sidebar headers, tab labels */
--text-body: 12px / 400;       /* Buttons, general UI text */
--text-small: 11px / 400;      /* Small labels, metadata */

/* Data Elements (JetBrains Mono) */
--text-data: 11px / 400;       /* Coordinates, timestamps, logs */
--text-data-small: 10px / 400; /* Compact data displays */
```

### Usage Rules
- **Inter**: Buttons, labels, tabs, headers, navigation
- **JetBrains Mono**: Coordinates, timestamps, logs, traces, telemetry, code

---

## Spacing System

### Base Unit: 4px

```css
--space-1: 4px;    /* Tight spacing */
--space-2: 8px;    /* Default spacing */
--space-3: 12px;   /* Medium spacing */
--space-4: 16px;   /* Large spacing */
--space-6: 24px;   /* Extra large spacing */
```

### Component Padding
```css
--padding-panel: 16px;        /* Sidebar, console padding */
--padding-tab: 8px 16px;      /* Tab button padding */
--padding-button: 6px 12px;   /* Standard button padding */
--padding-input: 8px 12px;    /* Input field padding */
```

---

## Layout Dimensions

### Panel Widths
```css
--sidebar-width: 240px;       /* Fixed sidebar width */
--sentinel-width: 320px;      /* Docked Sentinel Eye panel */
--console-height: 200px;      /* Default console height */
--console-min-height: 100px;  /* Collapsed console */
--console-max-height: 400px;  /* Expanded console */
```

### Minimum Viewport
```css
--viewport-min-width: 1280px;
--viewport-min-height: 720px;
```

---

## Component Styles

### Borders
```css
/* Default border */
border: 1px solid var(--border-default);

/* Active border (tabs) */
border-bottom: 2px solid var(--border-active);
```

### Border Radius
```css
--radius-sm: 4px;   /* Buttons, inputs */
--radius-md: 6px;   /* Cards, panels */
--radius-lg: 8px;   /* Modals, overlays */
```

### Shadows
```css
/* Minimal shadows - use sparingly */
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-md: 0 2px 4px rgba(0, 0, 0, 0.08);
```

---

## Interactive States

### Hover
```css
background-color: var(--bg-hover);
transition: background-color 150ms ease-in-out;
```

### Active/Selected
```css
background-color: var(--bg-active);
border-left: 2px solid var(--border-active); /* For sidebar items */
```

### Focus
```css
outline: 2px solid var(--border-active);
outline-offset: 2px;
```

### Disabled
```css
opacity: 0.5;
cursor: not-allowed;
```

---

## Component Specifications

### Sidebar Explorer

```css
/* Container */
width: 240px;
background: var(--bg-secondary);
border-right: 1px solid var(--border-default);
padding: var(--padding-panel);

/* Folder Item */
padding: 6px 8px;
font: var(--text-body);
font-family: var(--font-ui);
border-radius: var(--radius-sm);

/* Active Item */
background: var(--bg-active);
border-left: 2px solid var(--border-active);

/* Nested Indent */
padding-left: calc(8px + 16px * depth);
```

### Tabbed Map Stage

```css
/* Tab Bar */
background: var(--bg-secondary);
border-bottom: 1px solid var(--border-default);
height: 40px;

/* Tab Button */
padding: var(--padding-tab);
font: var(--text-body);
font-family: var(--font-ui);
border-bottom: 2px solid transparent;

/* Active Tab */
border-bottom: 2px solid var(--border-active);
background: var(--bg-primary);

/* Tab Close Button */
width: 16px;
height: 16px;
margin-left: 8px;
```

### Breadcrumb Bar

```css
/* Container */
height: 32px;
padding: 0 16px;
background: var(--bg-secondary);
border-bottom: 1px solid var(--border-default);

/* Breadcrumb Item */
font: var(--text-small);
font-family: var(--font-ui);
color: var(--text-secondary);

/* Separator */
content: '>';
margin: 0 8px;
color: var(--text-tertiary);
```

### Bottom Console

```css
/* Container */
height: 200px;
background: var(--bg-primary);
border-top: 1px solid var(--border-default);

/* Tab Bar */
height: 32px;
background: var(--bg-secondary);
border-bottom: 1px solid var(--border-default);

/* Console Content */
padding: var(--padding-panel);
font: var(--text-data);
font-family: var(--font-data);
overflow-y: auto;

/* Log Entry */
padding: 4px 0;
color: var(--text-primary);
```

### Sentinel Eye Panel

```css
/* Container */
width: 320px;
background: var(--bg-secondary);
border-left: 1px solid var(--border-default);

/* Video Container */
aspect-ratio: 16 / 9;
background: #000000;
position: relative;

/* Bounding Box */
stroke: var(--border-active);
stroke-width: 2px;
fill: none;

/* Detection Label */
font: var(--text-data-small);
font-family: var(--font-data);
color: var(--text-primary);
background: rgba(255, 255, 255, 0.9);
padding: 2px 4px;
border-radius: 2px;
```

### Buttons

```css
/* Primary Button */
padding: var(--padding-button);
font: var(--text-body);
font-family: var(--font-ui);
background: var(--bg-primary);
border: 1px solid var(--border-default);
border-radius: var(--radius-sm);

/* Hover */
background: var(--bg-hover);

/* Active */
background: var(--bg-active);
```

### Map Markers

```css
/* Verified Hazard */
width: 12px;
height: 12px;
background: #000000;
border: 2px solid #FFFFFF;
border-radius: 50%;

/* Unverified Hazard */
width: 12px;
height: 12px;
background: #9CA3AF;
border: 2px solid #FFFFFF;
border-radius: 50%;
```

---

## Icon System

### Icon Library
Use **Lucide React** or **Heroicons** (outline variant)

### Icon Sizes
```css
--icon-sm: 14px;   /* Inline icons */
--icon-md: 16px;   /* Default icons */
--icon-lg: 20px;   /* Header icons */
```

### Icon Colors
```css
color: var(--text-secondary);  /* Default */
color: var(--text-primary);    /* Active */
```

### Common Icons
- Folder: `FolderIcon` (closed), `FolderOpenIcon` (open)
- File: `FileIcon`
- Video: `VideoIcon`
- Chevron: `ChevronRightIcon`, `ChevronDownIcon`
- Close: `XMarkIcon`
- Map: `MapIcon`
- Terminal: `CommandLineIcon`
- Table: `TableCellsIcon`

---

## Animation & Transitions

### Standard Transition
```css
transition: all 150ms ease-in-out;
```

### Hover Transition
```css
transition: background-color 150ms ease-in-out;
```

### Panel Collapse
```css
transition: height 200ms ease-in-out;
```

### No Animation
- Bounding box rendering (canvas operations)
- Map marker updates (performance critical)

---

## Accessibility

### Contrast Ratios
- Primary text (#000000 on #FFFFFF): 21:1 ✅
- Secondary text (#6B7280 on #FFFFFF): 5.74:1 ✅
- Tertiary text (#9CA3AF on #FFFFFF): 3.54:1 ⚠️ (use for non-critical text only)

### Focus Indicators
```css
outline: 2px solid var(--border-active);
outline-offset: 2px;
```

### Keyboard Navigation
- Tab order: Sidebar → Tabs → Map → Console
- Escape: Close active tab/panel
- Ctrl+B: Toggle sidebar
- Ctrl+J: Toggle console

---

## Tailwind CSS Mapping

### Custom Theme Extension
```javascript
// tailwind.config.ts
theme: {
  extend: {
    colors: {
      'ide-bg': '#FFFFFF',
      'ide-panel': '#F5F5F5',
      'ide-hover': '#E5E7EB',
      'ide-border': '#CBD5E1',
      'ide-text': '#000000',
      'ide-text-secondary': '#6B7280',
      'ide-text-tertiary': '#9CA3AF',
    },
    fontFamily: {
      'ui': ['Inter', 'sans-serif'],
      'data': ['JetBrains Mono', 'monospace'],
    },
  }
}
```

### Utility Classes
```css
/* Backgrounds */
.bg-ide-bg { background-color: #FFFFFF; }
.bg-ide-panel { background-color: #F5F5F5; }
.bg-ide-hover { background-color: #E5E7EB; }

/* Borders */
.border-ide { border-color: #CBD5E1; }
.border-ide-active { border-color: #000000; }

/* Text */
.text-ide { color: #000000; }
.text-ide-secondary { color: #6B7280; }
.text-ide-tertiary { color: #9CA3AF; }

/* Fonts */
.font-ui { font-family: 'Inter', sans-serif; }
.font-data { font-family: 'JetBrains Mono', monospace; }
```

---

## Design Checklist

Before marking a component complete, verify:

- ✅ Uses correct font (Inter for UI, JetBrains Mono for data)
- ✅ Uses monochrome palette (no blues, greens except minimal accents)
- ✅ Has 1px solid borders (#CBD5E1)
- ✅ Spacing uses 4px base unit
- ✅ Hover states use #E5E7EB
- ✅ Focus indicators are visible
- ✅ Text contrast meets WCAG AA
- ✅ No inline styles (except canvas)
- ✅ Transitions are 150ms ease-in-out
- ✅ Icons are from Lucide/Heroicons

---

## Reference Inspiration

- **VS Code**: Sidebar explorer, tabbed editor, bottom terminal
- **GitHub**: Clean monochrome palette, high information density
- **Linear**: Minimalist borders, subtle hover states
- **Vercel Dashboard**: Professional typography, clean spacing
