# ProTour AI UI Generation Prompt

## Overview

This document contains a comprehensive prompt for AI-powered UI generation tools (Vercel v0, Lovable.ai, etc.) to create ProTour's Organizer Dashboard mockup based on the completed UI/UX specification.

## Master Prompt

Copy and paste the following prompt into your AI UI generation tool:

---

## HIGH-LEVEL GOAL
Create a mobile-first tournament management dashboard for ProTour, a racket sports tournament app targeting the Indian market. Focus on the Organizer Dashboard as the primary screen, featuring live tournament status, quick actions, and real-time updates.

## DETAILED INSTRUCTIONS

1. **Create the main Organizer Dashboard component** using React with TypeScript
2. **Implement a mobile-first layout** (320px-767px primary target) with bottom tab navigation
3. **Add tournament cards** showing live status with the following elements:
   - Tournament name and date
   - Status indicator (Setup/Live/Paused/Completed) with color coding
   - Player count (e.g., "32 players")
   - Quick action buttons (Enter Score, View Bracket, Manage)
   - Progress indicator for active tournaments
4. **Include a floating action button** for "Create Tournament" (prominent, always visible)
5. **Add real-time status indicators** using pulsing animations for live tournaments
6. **Implement pull-to-refresh functionality** with loading states
7. **Create responsive breakpoints** that adapt for tablet (768px+) with two-column tournament grid
8. **Add notification badges** for tournaments requiring attention (scoring conflicts, delays)

## DESIGN SPECIFICATIONS & CONSTRAINTS

**Color Palette:**
- Primary: #1E40AF (main actions, live indicators)
- Secondary: #059669 (success states, completed matches)
- Warning: #F59E0B (attention needed)
- Error: #EF4444 (conflicts, urgent actions)
- Neutral grays: #374151, #6B7280, #9CA3AF, #D1D5DB, #F9FAFB

**Typography:** 
- Font: Inter or system fonts (-apple-system, Roboto)
- H2: 24px, weight 600 for tournament names
- Body: 16px, weight 400 for details
- Small: 14px, weight 400 for metadata

**Component Requirements:**
- All touch targets minimum 44px height for mobile
- Use 4px spacing scale (8px, 16px, 24px, 32px)
- Include haptic feedback indicators (scale transforms on press)
- Status indicators must be accessible (color + text/icon)

**Sample Data Structure:**
```json
{
  "tournaments": [
    {
      "id": "1",
      "name": "Spring Club Championship",
      "date": "2025-09-15",
      "status": "live",
      "playerCount": 32,
      "sport": "tennis",
      "matchesComplete": 12,
      "totalMatches": 31,
      "needsAttention": false
    },
    {
      "id": "2", 
      "name": "Weekend Badminton Open",
      "date": "2025-09-16",
      "status": "setup",
      "playerCount": 16,
      "sport": "badminton",
      "needsAttention": true,
      "attentionReason": "Missing court assignments"
    }
  ]
}
```

**Visual Style:**
- Clean, professional design suitable for tournament organizers
- Card-based layout with subtle shadows and rounded corners (8px)
- Status indicators using both color and icons for accessibility
- Real-time elements should have subtle pulsing animations
- Bottom navigation with 4 tabs: Home, Brackets, Schedule, Profile

## STRICT SCOPE BOUNDARIES

**DO create:**
- One main dashboard component file
- Tournament card sub-components
- Mobile-responsive CSS/styling
- Mock data for 3-4 sample tournaments
- Bottom tab navigation structure
- Pull-to-refresh loading states

**DO NOT create:**
- Score entry forms (different component)
- Bracket visualization (separate screen)
- User authentication (handled elsewhere)
- API integration code (mock data only)
- Additional pages beyond the dashboard

**Technical Constraints:**
- Use modern React hooks (useState, useEffect)
- Implement Tailwind CSS for all styling
- Include TypeScript interfaces for data structures
- Ensure 60fps performance on mobile devices
- Add accessibility attributes (ARIA labels, semantic HTML)
- Support system dark/light mode preferences

**Indian Market Considerations:**
- Design works well on various Android device sizes
- High contrast colors for outdoor tournament use  
- Touch targets optimized for thumb navigation
- Consider network connectivity issues (show offline states)

Remember: This prompt generates a starting mockup that will require human review, testing with real users (Alex the organizer persona), and iterative refinement based on actual tournament management workflows.

---

## Usage Instructions

1. **Copy the entire prompt** from "HIGH-LEVEL GOAL" through "Remember:" section
2. **Paste into your AI UI tool** (v0, Lovable, etc.)
3. **Review the generated output** for alignment with ProTour's design principles
4. **Iterate and refine** based on the specific AI tool's capabilities
5. **Test the mockup** on actual mobile devices for touch target validation

## Additional Component Prompts Available

This prompt focuses on the Organizer Dashboard. Additional prompts can be created for:

- **Score Entry Interface** - Mobile-optimized score input with delegation features
- **Live Bracket View** - Scalable tournament brackets (8-128 players)
- **Player Schedule View** - Personal tournament schedule and match tracking
- **Mobile Bracket Navigation** - Complex bracket browsing for large tournaments

## Quality Assurance

Generated mockups should be validated against:

- **Target Personas:** Alex (organizer), Maria (player), David (spectator)
- **Mobile-First Design:** Primary optimization for 320px-767px screens
- **Accessibility Standards:** WCAG 2.1 AA compliance with color contrast and touch targets
- **Performance Goals:** Smooth animations at 60fps on target devices
- **Indian Market Context:** Professional appearance suitable for local tournament organizers

---

*Generated from ProTour UI/UX Specification v1.0 - 2025-09-01*