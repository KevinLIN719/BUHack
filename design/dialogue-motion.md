# Contextual conversation motion

Reference: the user's `1830x1080.mp4` (11.6 seconds, 60 fps). This adds an optional conversation to the existing review; it does not add a required step.

## What the reference actually does

At approximately 1.55 seconds, the first submitted message emerges from behind the composer's upper edge. It moves upward, narrows toward the right edge and loses its initial blur. It settles around 1.75–1.80 seconds. The input clears and contracts from its top while its bottom remains anchored. The response starts roughly half a second after submission and progressively occupies more space, moving the prior message upward. The send button has a small local pulse.

The effect comes from continuity between the existing field and the new bubble, strong deceleration and the response's increasing height. There is no visible liquid bridge or large bounce in the source. Its colored decorative mode panels are translated into a useful reference desk that shows the fictional wording, a hypothetical scenario or an adviser question.

## Implementation

- `agent-motion.js` owns motion; `PolicyAgentMotion.timings` is the only implementation timing source.
- A submitted user bubble uses FLIP translation and a small width contraction. Its short initial blur resolves as it leaves the composer.
- The existing textarea is cleared and resized in place. Its height animates from the captured rectangle, preserving the composer's bottom edge.
- The assistant response grows from a short line to its final height while paragraphs enter softly. The feed follows that growth until the answer's heading reaches the top, keeping long explanations readable before their trailing actions. Following runs only while the operation runs.
- `app.js` owns the transcript, editable next draft, busy guard and turn token. Closing a pending conversation settles its local answer and cancels the old animation before reopening.
- Source reading suspends the conversation and then restores its draft and transcript. Saved exact questions return to the original checklist, with suggested sample references only when available.

The visual system stays English, white and orange, with fine editorial rules. This is native DOM animation; no video asset, canvas loop, generated media or live AI service is needed.

## Acceptance

Check the bubble during detachment and after response growth, stable composer placement, mouse and keyboard submission, IME composition, a draft typed during a response, repeated sends, closing mid-animation, source round trips and saving questions. Check both narrow and short screens. Reduced-motion and browsers without Web Animations must settle directly into readable final states.

The `oil-motion` state and continuity checks apply here. Its generated-media delivery and atlas/video budgeting steps do not apply to these native DOM transitions.
