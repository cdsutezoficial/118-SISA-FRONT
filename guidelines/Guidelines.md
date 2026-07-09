**Add your own guidelines here**
<!--

System Guidelines

Use this file to provide the AI with rules and guidelines you want it to follow.
This template outlines a few examples of things you can add. You can add your own sections and format it to suit your needs

TIP: More context isn't always better. It can confuse the LLM. Try and add the most important rules you need

# General guidelines

Any general rules you want the AI to follow.
For example:

* Only use absolute positioning when necessary. Opt for responsive and well structured layouts that use flexbox and grid by default
* Refactor code as you go to keep code clean
* Keep file sizes small and put helper functions and components in their own files.

--------------

# Design system guidelines
Rules for how the AI should make generations look like your company's design system

Additionally, if you select a design system to use in the prompt box, you can reference
your design system's components, tokens, variables and components.
For example:

* Use a base font-size of 14px
* Date formats should always be in the format “Jun 10”
* The bottom toolbar should only ever have a maximum of 4 items
* Never use the floating action button with the bottom toolbar
* Chips should always come in sets of 3 or more
* Don't use a dropdown if there are 2 or fewer options

You can also create sub sections and add more specific details
For example:


## Button
The Button component is a fundamental interactive element in our design system, designed to trigger actions or navigate
users through the application. It provides visual feedback and clear affordances to enhance user experience.

### Usage
Buttons should be used for important actions that users need to take, such as form submissions, confirming choices,
or initiating processes. They communicate interactivity and should have clear, action-oriented labels.

### Variants
* Primary Button
  * Purpose : Used for the main action in a section or page
  * Visual Style : Bold, filled with the primary brand color
  * Usage : One primary button per section to guide users toward the most important action
* Secondary Button
  * Purpose : Used for alternative or supporting actions
  * Visual Style : Outlined with the primary color, transparent background
  * Usage : Can appear alongside a primary button for less important actions
* Tertiary Button
  * Purpose : Used for the least important actions
  * Visual Style : Text-only with no border, using primary color
  * Usage : For actions that should be available but not emphasized
-->

# Responsive layout guidelines

These conventions were established while retrofitting existing screens (Planes, Divisiones, Programas, AppLayout, Login) to be responsive. Apply them to every new view and to any correction of an already-built view. Breakpoints used across the codebase: `sm:` (640px) for form/filter density, `md:` (768px) for the major layout switch (sidebar/table vs. drawer/cards).

## Page containers
* Container padding: `px-4 sm:px-8 py-6 sm:py-8` — tighter on mobile, expands at `sm:`.
* Breadcrumbs: always `flex flex-wrap items-center` so they wrap instead of overflowing on narrow screens.
* Page header (title + primary action): `flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4` — stacked on mobile, row from `sm:` up.
* Primary action button in that header: `flex items-center justify-center w-full sm:w-auto sm:whitespace-nowrap sm:self-start`.

## Form grids (12-column)
* Every `col-span-N` used for desktop must become `col-span-12 sm:col-span-N` — fields go full-width on mobile and only split into columns at `sm:` or larger.

## Form footer actions
* `flex flex-col-reverse sm:flex-row sm:justify-end gap-3` — the primary submit button ends up on top on mobile because of `flex-col-reverse`.
* Each button also gets `w-full sm:w-auto justify-center`.

## List filters (search/select bars)
* Filter bar container: `flex flex-col sm:flex-row sm:items-center gap-3`.
* Individual filter inputs/selects: `w-full sm:w-64` (or the equivalent fixed desktop width) instead of a bare fixed width.
* Non-essential text like a results counter: `hidden sm:inline` to save space on mobile.

## Table → card pattern (the most reused one)
* Wrap the desktop `<table>` in `hidden md:block`.
* Add a sibling `md:hidden space-y-3` block that renders one card per row: `bg-white border border-[#E5E7EB] rounded-lg p-4`, with a status badge, a title, metadata separated by `·`, and row actions as `flex-1` buttons under a `border-t`.
* Extract repeated bits (e.g. status badges) into a shared component (`EstadoBadge`) so the table and card renderers don't duplicate JSX.
* Duplicate pagination for both modes: the desktop pager stays inside the table container; add a `flex flex-col items-center gap-3` mobile pager with the same Anterior/Siguiente actions.

## App shell (sidebar / navbar)
* Desktop sidebar: `hidden md:flex`, fixed width (`w-[240px]` expanded / `w-[60px]` collapsed).
* Mobile: a `Menu` icon button (`md:hidden`) opens a full-screen drawer (`fixed inset-0 z-50`, sliding via `-translate-x-full` → `translate-x-0`) with a `bg-black/40` backdrop.
* Main content offset must match the sidebar mode: no `ml-` offset on mobile, `md:ml-[60px]`/`md:ml-[240px]` on desktop.
* Formal requirements for this pattern live in `openspec/specs/app-shell.md` (breakpoint `md` = 768px, drawer/accordion behavior) — check that spec before changing the shell.

## Auth screens (Login-style layouts)
* Decorative/branding side panel: `hidden lg:flex lg:w-1/2`.
* Form panel padding scales down on mobile: `px-5 sm:px-8 py-10 sm:py-12`.
* Headline sizes scale down on mobile: e.g. `text-[22px] sm:text-[26px]`.
