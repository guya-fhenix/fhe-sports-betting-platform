# Sports Betting Platform - Design System

## Overview

This document outlines the comprehensive design system implementation for the blockchain sports betting platform. The design system is built on top of Chakra UI v3 and provides a cohesive, professional, and accessible user interface.

## Design Principles

### 1. Professional & Trustworthy
- Clean, modern aesthetic suitable for financial applications
- Consistent visual hierarchy
- Professional color palette
- High-quality typography

### 2. Accessibility First
- WCAG AA compliance
- Proper focus management
- Semantic HTML structure
- Screen reader friendly

### 3. Responsive Design
- Mobile-first approach
- Consistent experience across all devices
- Flexible grid system
- Adaptive typography

### 4. Performance Optimized
- Minimal CSS bundle size
- Efficient component architecture
- Optimized animations and transitions

## Color Palette

### Primary Brand Colors
```css
brand.50:  #e6f7ff  /* Lightest blue */
brand.100: #bae7ff
brand.200: #91d5ff
brand.300: #69c0ff
brand.400: #40a9ff
brand.500: #1890ff  /* Primary brand color */
brand.600: #096dd9
brand.700: #0050b3
brand.800: #003a8c
brand.900: #002766  /* Darkest blue */
```

### Success Colors (Green)
```css
success.50:  #f6ffed
success.100: #d9f7be
success.200: #b7eb8f
success.300: #95de64
success.400: #73d13d
success.500: #52c41a  /* Primary success */
success.600: #389e0d
success.700: #237804
success.800: #135200
success.900: #092b00
```

### Warning Colors (Orange)
```css
warning.50:  #fff7e6
warning.100: #ffe7ba
warning.200: #ffd591
warning.300: #ffc069
warning.400: #ffa940
warning.500: #fa8c16  /* Primary warning */
warning.600: #d46b08
warning.700: #ad4e00
warning.800: #873800
warning.900: #612500
```

### Error Colors (Red)
```css
error.50:  #fff2f0
error.100: #ffccc7
error.200: #ffa39e
error.300: #ff7875
error.400: #ff4d4f
error.500: #f5222d  /* Primary error */
error.600: #cf1322
error.700: #a8071a
error.800: #820014
error.900: #5c0011
```

### Betting-Specific Colors
```css
betting.win:       #52c41a  /* Winning bets */
betting.loss:      #f5222d  /* Losing bets */
betting.pending:   #fa8c16  /* Pending bets */
betting.placed:    #1890ff  /* Placed bets */
betting.available: #595959  /* Available bets */
```

## Typography

### Font Families
- **Headings**: Inter (Professional, modern sans-serif)
- **Body**: Inter (Consistent with headings)
- **Monospace**: JetBrains Mono (For addresses, code)

### Font Sizes
```css
xs:   0.75rem   (12px)
sm:   0.875rem  (14px)
md:   1rem      (16px)  /* Base size */
lg:   1.125rem  (18px)
xl:   1.25rem   (20px)
2xl:  1.5rem    (24px)
3xl:  1.875rem  (30px)
4xl:  2.25rem   (36px)
5xl:  3rem      (48px)
6xl:  3.75rem   (60px)
```

## Spacing Scale

Consistent spacing based on 4px grid:

```css
0.5:  0.125rem  (2px)
1:    0.25rem   (4px)
1.5:  0.375rem  (6px)
2:    0.5rem    (8px)
2.5:  0.625rem  (10px)
3:    0.75rem   (12px)
3.5:  0.875rem  (14px)
4:    1rem      (16px)  /* Base unit */
5:    1.25rem   (20px)
6:    1.5rem    (24px)
7:    1.75rem   (28px)
8:    2rem      (32px)
9:    2.25rem   (36px)
10:   2.5rem    (40px)
12:   3rem      (48px)
14:   3.5rem    (56px)
16:   4rem      (64px)
20:   5rem      (80px)
24:   6rem      (96px)
28:   7rem      (112px)
32:   8rem      (128px)
```

## Component Library

### Button Component

Professional button component with multiple variants:

```tsx
import { Button } from './components/ui/button';

// Variants
<Button variant="solid">Primary Action</Button>
<Button variant="outline">Secondary Action</Button>
<Button variant="ghost">Tertiary Action</Button>
<Button variant="success">Success Action</Button>
<Button variant="warning">Warning Action</Button>
<Button variant="error">Danger Action</Button>
<Button variant="betting">Betting Action</Button>

// Sizes
<Button size="sm">Small</Button>
<Button size="md">Medium</Button>
<Button size="lg">Large</Button>
```

### Card Component

Flexible card component for content containers:

```tsx
import { Card, CardHeader, CardBody, CardFooter } from './components/ui/card';

// Variants
<Card variant="default">Standard card</Card>
<Card variant="elevated">Elevated card</Card>
<Card variant="outline">Outlined card</Card>
<Card variant="betting">Betting-specific card</Card>

// Usage
<Card variant="betting">
  <CardHeader>
    <Heading size="md">Tournament Name</Heading>
  </CardHeader>
  <CardBody>
    <Text>Tournament details...</Text>
  </CardBody>
  <CardFooter>
    <Button>Join Tournament</Button>
  </CardFooter>
</Card>
```

### Badge Component

Status indicators and labels:

```tsx
import { Badge } from './components/ui/badge';

// Variants
<Badge variant="solid">Default</Badge>
<Badge variant="outline">Outlined</Badge>
<Badge variant="success">Success</Badge>
<Badge variant="warning">Warning</Badge>
<Badge variant="error">Error</Badge>
<Badge variant="betting">Betting</Badge>
<Badge variant="active">Active</Badge>
<Badge variant="upcoming">Upcoming</Badge>
<Badge variant="ended">Ended</Badge>
```

## Layout System

### Responsive Breakpoints

```css
sm:   30em   (480px)   /* Mobile */
md:   48em   (768px)   /* Tablet */
lg:   62em   (992px)   /* Desktop */
xl:   80em   (1280px)  /* Large Desktop */
2xl:  96em   (1536px)  /* Extra Large */
```

### Grid System

Responsive grid layouts using Chakra UI's Grid component:

```tsx
<Grid 
  templateColumns={{
    base: "1fr",
    md: "repeat(2, 1fr)",
    lg: "repeat(3, 1fr)",
    xl: "repeat(4, 1fr)"
  }} 
  gap={4}
>
  <GridItem>Content</GridItem>
</Grid>
```

## Shadows & Elevation

Professional shadow system for depth:

```css
xs:   0 1px 2px 0 rgba(0, 0, 0, 0.05)
sm:   0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)
md:   0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)
lg:   0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)
xl:   0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)
2xl:  0 25px 50px -12px rgba(0, 0, 0, 0.25)
inner: inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)
```

## Border Radius

Consistent border radius scale:

```css
none: 0
sm:   0.125rem  (2px)
md:   0.375rem  (6px)   /* Standard */
lg:   0.5rem    (8px)   /* Cards */
xl:   0.75rem   (12px)
2xl:  1rem      (16px)
3xl:  1.5rem    (24px)
full: 9999px    (Circular)
```

## Animation & Transitions

### Standard Transitions
- Duration: 0.2s ease-in-out
- Hover effects: transform + box-shadow
- Focus states: outline + scale

### Micro-interactions
- Button hover: translateY(-1px) + shadow
- Card hover: translateY(-2px) + shadow
- Loading states: smooth opacity changes

## Accessibility Features

### Focus Management
- Visible focus indicators
- Keyboard navigation support
- Skip links for screen readers

### Color Contrast
- All text meets WCAG AA standards
- Interactive elements have sufficient contrast
- Color is not the only way to convey information

### Screen Reader Support
- Semantic HTML structure
- ARIA labels and descriptions
- Proper heading hierarchy

## Usage Guidelines

### Do's
✅ Use consistent spacing from the scale
✅ Follow the color palette for all UI elements
✅ Maintain proper contrast ratios
✅ Use semantic HTML elements
✅ Test with keyboard navigation
✅ Provide loading states for async operations

### Don'ts
❌ Use arbitrary spacing values
❌ Create custom colors outside the palette
❌ Rely solely on color to convey meaning
❌ Skip focus states for interactive elements
❌ Use non-semantic HTML for layout
❌ Ignore responsive design principles

## Implementation

### Theme Configuration
The design system is implemented through a custom Chakra UI theme located in `src/theme/index.ts`.

### Component Structure
```
src/
├── components/
│   ├── ui/           # Reusable UI components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── badge.tsx
│   │   └── provider.tsx
│   └── ...           # Feature components
├── theme/
│   └── index.ts      # Theme configuration
└── index.css         # Global styles
```

### Global Styles
Professional global styles are defined in `src/index.css` including:
- Custom scrollbars
- Focus management
- Typography base styles
- Utility classes

## Future Enhancements

### Planned Components
- [ ] Modal/Dialog system
- [ ] Toast notification system
- [ ] Data table component
- [ ] Form components
- [ ] Navigation components

### Planned Features
- [ ] Dark mode support
- [ ] Animation library integration
- [ ] Component documentation site
- [ ] Design tokens export
- [ ] Figma design system

## Contributing

When adding new components or modifying existing ones:

1. Follow the established color palette
2. Use the spacing scale consistently
3. Ensure accessibility compliance
4. Test across all breakpoints
5. Document component APIs
6. Add TypeScript types
7. Include usage examples

## Resources

- [Chakra UI Documentation](https://chakra-ui.com/)
- [WCAG Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Inter Font](https://fonts.google.com/specimen/Inter)
- [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) 