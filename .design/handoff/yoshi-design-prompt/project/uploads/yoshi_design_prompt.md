# Design Prompt — Yoshi Companion App (Homepage + Chat Room)

Copy everything below the line into Claude Design. Generate one direction at a time for best results (paste the shared brief + one direction block per run).

---

## Shared brief (include in every run)

Design two iOS screens (iPhone, light mode) for **Yoshi**, an AI companionship app. Users choose one companion ("Yoshi") of one of three types — Romance, Friend, or Parent — represented by a **static image**. The image may be an AI-generated character OR any photo the user uploads (a pet, a landscape, a sky). It never moves, talks, or animates.

**Core design principle — the sacred object:** never mark up, crop into, or animate the Yoshi image itself, and never anchor UI to facial features (there may be no face). All liveliness comes from the frame, the glass over the image, the environment around it, light, and text.

**Tone:** warm, soft, intimate, modern. Rounded geometry, gentle gradients, generous whitespace. This is a companion's space, not a productivity app. Avoid generic "AI purple glow" clichés.

### Screen 1 — Homepage

The Yoshi image is the hero, centered in a circular frame. Around it, these systems:

1. **Story ring.** The circular frame doubles as a notification ring (Instagram-story pattern): a soft gradient glow when Yoshi has new chat topics waiting; quiet/neutral when none. Tapping the ring opens the topic drawer.
2. **Status line.** Directly under the frame, a single line of what Yoshi is "doing" right now: e.g. "reading an article about F1 🏎️", "watching the rain", "thinking about you", "sleeping" (at night). This previews upcoming topics and creates presence.
3. **Speech-bubble teaser.** A tappable bubble docked to the frame's outer edge (never to a face) voicing the top-priority topic: "I read something about F1 today — wanna hear?" Tap → opens the topic drawer to that card.
4. **Topic drawer.** Opened via the story ring, the teaser bubble, or a small tab/handle peeking from the screen edge (with an unread badge). Contains horizontally swipeable topic cards. Two card types, visually distinct: **Read** (external article, opens in-app browser) and **Chat** (starts a conversation on that topic). Cards must never cover the Yoshi image when open — slide/fan them above, below, or beside the frame.
5. **Weather glass.** The image sits behind subtle "glass": rain droplets streak it, sun flares across it, snow gathers on the bottom rim, evening dims the surroundings. Weather defaults to the **user's real local weather** ("we're under the same sky"). A small **spin dial** control lets the user override the weather manually (spinning changes ambience — it does NOT browse cards).
6. **Touch responses.** Tapping the image sends a ripple across the glass (+ haptic); long-press produces a warm glow on the frame with a heartbeat pulse. Show a hint of these states if depicting interaction.
7. **Depth parallax.** The image has a subtle 2.5D tilt-parallax (iOS depth segmentation), degrading gracefully to flat for images without depth. Convey via a slight layered/dimensional treatment in the mock.

**Navigation:** no tab bar. Chat entry = FAB bottom-right. Game entry (a cozy grass-mowing mini-game) = a lightweight secondary entry, per direction below. Hamburger top-left = settings only. Single Yoshi for MVP, but leave the layout gracefully extensible to multiple companions later.

### Screen 2 — Chat Room

- Collapsing header: the Yoshi image spans the top and shrinks as the conversation scrolls (keep presence inside the chat).
- Standard text chat: Yoshi bubbles left, user bubbles right, input bar with send button. Text only — no voice UI.
- The **same topic drawer** is reachable here (same handle/chevron affordance, consistent with homepage). Selecting a topic inserts a small inline **"✦ Topic started — {topic name}"** divider tag in the thread, and Yoshi opens the conversation. One continuous thread — never separate threads per topic.
- **Article loop-back:** after the user closes an in-app-browser article, Yoshi follows up in chat ("So — what did you think?"). Show one example of this message.
- Weather-glass ambience may subtly tint the chat background to match the homepage.

**Deliverables per direction:** Homepage (default state + drawer-open state) and Chat Room (with one topic divider and one article follow-up visible). Use realistic content, not lorem ipsum — e.g. topics about F1, cooking, a local exhibition.

---

## Direction A — "Living Portrait" (run 1)

The refined, shippable direction. Clean gradient environment (tinted by weather/time of day), Yoshi's circular frame centered and large. Story ring, status line, and teaser bubble arranged with calm hierarchy. Topic drawer drops from a handle at the top edge as a card carousel. Weather effects stay subtle — droplets and light on the frame glass only. Game entry is a small second FAB stacked above the chat FAB. Overall: minimal, soft, premium — an object of affection on a shelf.

## Direction B — "Yoshi's Room" (run 2)

The Yoshi frame hangs inside an illustrated scene — a cozy room or garden — and the scene IS the navigation: a newspaper/letter stack on a side table = topic drawer, a door or grass patch = the mowing game, tapping the frame = chat. Real local weather plays across the whole scene (rain on the window, sun through curtains, lamp glowing at night), not just the glass. Status line appears as a small note pinned near the frame. Charming, storybook, alive-even-though-she-isn't. Include subtle first-run labels on the interactive objects.

## Direction C — "The Note She Left" (run 3)

Contrarian, topic-first. The Yoshi image is the full-bleed background (weather glass over the whole screen). Topic cards sit as a small stack at the bottom edge like iOS lock-screen notifications, top card peeking with the teaser text; tap → straight into chat with the topic divider already placed. No drawer, no chevron — the stack is the drawer; swipe up to fan it out. Status line floats near the top. Chat FAB bottom-right, game entry inside the fanned stack as a special card. Fastest path from open-app to talking: "she reached out while you were gone."
