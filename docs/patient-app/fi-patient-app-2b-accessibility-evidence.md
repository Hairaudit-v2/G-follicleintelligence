# FI-PATIENT-APP-2B — Accessibility evidence

**Status:** Code/label baseline noted — **device evidence pack not completed**.

## Required platforms

### iOS

VoiceOver; increased text size; display zoom; reduced motion; high/increased contrast.

### Android

TalkBack; increased font; display size; reduce animations; high contrast where supported.

## Required screens

Welcome; Home next step; Action Centre; Action detail; Journey Timeline; Quote; Documents; Pathology; Help; Error state; Logout/account controls.

## Gates

- No critical screen-reader blocker
- No critical large-text blocker
- No essential content clipped
- Core actions usable at approved large-text setting
- Errors/status understandable
- Non-critical limitations documented

## Evidence fields (per check)

Device/simulator; OS version; app build; screen; result; severity; remediation; retest.

## Current baseline (2026-07-30)

| Item | Result |
| --- | --- |
| accessibilityLabel / Role on many controls | Partial present |
| maxFontSizeMultiplier | Widespread |
| VoiceOver session log | **Missing** |
| TalkBack session log | **Missing** |
| Large-text walkthrough | **Missing** |
| Reduced-motion audit | **Missing** |

Until device pack passes, do not claim accessibility gate PASS. Android cohort should be excluded until TalkBack evidence exists (or complete TalkBack before including Android users).
