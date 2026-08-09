# Changelog

Notable changes to the Fuibo Flower / Yoshi prototype.

## Unreleased

_Nothing yet._

## 2026-08-09 — since `f9504f7`

Baseline: [`f9504f7`](https://github.com/llh-jameslo/Yoshi-Claude-Design/commit/f9504f7) (2026-08-04)  
Head: [`39f1c65`](https://github.com/llh-jameslo/Yoshi-Claude-Design/commit/39f1c65) (2026-08-09)

### Multi-Yoshi profiles

- Own multiple Yoshis (capacity 3) instead of replacing the only one
- **Switch Yoshi** shows owned companions plus empty **Add Yoshi** slots
- **Add Yoshi** short path: relationship → meet → name → intro chat (skips hobbies/notifications; keeps existing user name)
- Menu still full-restarts onboarding

### Onboarding / Meet Yoshi

- Meet pool order polish (gender-alternating scrub, curly patchwork male centered, Bob/hannya swap)
- Drag tutorial scrim with up/down + left/right hints and thinner arrows
- Hold-to-choose → full whiteout flash (2s) → naming screen with soft entry
- Friend relationship art updated (sunflower)
- Relationship card sample text shadows
- Notifications screen layout/copy polish
- Drag hints dismiss on the first drag (no extra tap)

### Home

- **Let’s chattt** pill opens chat
- Thinking-cloud tip opens the baby-rabbit topic tip, then the topic
- Hero + bottom CTA alignment tuned
- Tip button border, icon, and spacing polish

### Chat & topics

- Topic cards redesigned as companion cards (dog show / 1:1 / quiet show)
- Rich openers: link previews + baby-rabbit image topic
- Home rabbit tip → chat with media
- Chat keyboard avoidance smoother; fake keyboard flush to the device bottom
- CSS scroll-snap for topic cards on iOS Safari
- Subtle close (X) on topic cards
- Background edit: adjust-position cue over the hero only; fade only overlapping messages
- Left-edge swipe back to home (smooth slide; back button matches)

### Mower / device chrome

- Mower uses the chosen Yoshi avatar/name via query params
- Safari top-gap fix (framed inset only on the desktop embed)
- Fake keyboard / device chrome polish (hide keyboard on mobile, flush bottom, etc.)

### Commits in this range

| Commit | Summary |
| --- | --- |
| `647e5bc` | Multi-Yoshi profiles, add flow, and onboarding polish |
| `920c1b4` | Meet flash, topic chat media, and keyboard flush |
| `f7372a7` | Home CTAs and smooth chat keyboard avoidance |
| `17b4f8d` | Topic card snap on iOS; mower Safari top gap |
| `334b223` | Shadows on relationship card sample text |
| `52f885c` | Subtle close control on topic cards |
| `9bc6a13` | Thinner tip button border; tip spacing |
| `4fdcb49` | Home CTA icon sizes and chat pill spacing |
| `0086189` | Bg edit hint; drag dismisses scrims |
| `39f1c65` | Smooth edge swipe back from chat to home |
