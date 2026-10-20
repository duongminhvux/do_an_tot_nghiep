# Friendly 1v1 Room & Match Workflow Specification

> Purpose: Implementation specification for the **Friendly 1v1** mode in VocaLearn Arena.
> This document should be treated as the source of truth by the AI/code assistant.

---

## 1. Core Architecture

Friendly 1v1 must use **two separate entities**:

### FriendRoom
Temporary lobby/session data.

It stores:
- room code
- host
- guest
- selected Friendly mode
- current room settings
- guest ready state
- current match id
- room lifecycle state

### ArenaMatch
Represents one actual played match.

Important rule:

```text
Creating a FriendRoom MUST NOT create an ArenaMatch.

FriendRoom
  ↓ host presses Start
ArenaMatch #1
  ↓ finished
FriendRoom
  ↓ host presses Start again
ArenaMatch #2
```

One FriendRoom can therefore create multiple ArenaMatch records.

---

## 2. Friendly vs Ranked

Use match type to distinguish the type of battle:

```ts
export enum ArenaMatchType {
  RANK = "RANK",
  FRIEND = "FRIEND",
  ROOM = "ROOM",
}
```

Friendly modes:

```ts
export enum ArenaFriendMode {
  CLASSIC = "CLASSIC",
  WORD_CHAIN = "WORD_CHAIN",
}
```

### Critical rule

Friendly `CLASSIC` uses exactly:

```ts
ArenaQuestionMode.MEANING_TO_WORD
```

This is the same question gameplay used by Ranked.

That does **not** make it a Ranked match.

Correct model:

```text
RANK
└── questionMode = MEANING_TO_WORD

FRIEND
├── friendMode = CLASSIC
│   └── questionMode = MEANING_TO_WORD
│
└── friendMode = WORD_CHAIN
    └── no questionMode required
```

Never detect Ranked by checking only `questionMode`.

Always check:

```ts
match.type
```

Friendly matches never:
- change Elo
- change rating
- update ranked leaderboard
- create ArenaRatingHistory

---

## 3. FriendRoom Lifecycle

```ts
export enum FriendRoomStatus {
  WAITING = "WAITING",
  IN_MATCH = "IN_MATCH",
  CLOSED = "CLOSED",
}
```

Normal lifecycle:

```text
CREATE
  ↓
WAITING
  ↓ Start
IN_MATCH
  ↓ Match finished
WAITING
  ↓ Host leaves
CLOSED / DELETE
```

If the host leaves before any match starts:

```text
WAITING
  ↓ host leaves
DELETE ROOM IMMEDIATELY
```

Host ownership is permanent and is never transferred.

---

## 4. Suggested FriendRoom Schema

```ts
FriendRoom {
  _id: ObjectId;

  code: string;

  hostId: ObjectId;
  guestId?: ObjectId | null;

  mode: ArenaFriendMode;

  status: FriendRoomStatus;

  guestReady: boolean;

  settings: {
    // CLASSIC
    questionCount?: number;
    timePerQuestion?: number;

    // WORD_CHAIN
    turnTime?: number;
  };

  currentMatchId?: ObjectId | null;

  matchCount: number;

  createdAt: Date;
  updatedAt: Date;
}
```

Recommended unique index:

```ts
{ code: 1 }
```

---

## 5. Room Code

Use 6 characters.

Examples:

```text
AB12CD
QZ7K9F
8CK2PM
```

Recommended character set:

```ts
ABCDEFGHJKMNPQRSTUVWXYZ23456789
```

Avoid:

```text
0 O
1 I L
```

Generation:

```text
generate code
↓
check uniqueness
↓
if duplicate → generate again
↓
save room
```

---

## 6. Create Room Workflow

Frontend:

```text
Arena
→ Friendly 1v1
→ Create Room
```

Backend:

1. Verify authenticated user.
2. Ensure the user is not already in another active room or Arena match.
3. Generate unique room code.
4. Create FriendRoom.
5. Set creator as host.
6. Initialize:

```ts
{
  guestId: null,
  guestReady: false,
  status: "WAITING",
  matchCount: 0,
}
```

7. Return room snapshot.

Host navigates to:

```text
/[locale]/arena/friend/room/<ROOM_CODE>
```

Host joins Socket.IO room:

```text
friend-room:<roomId>
```

---

## 7. Joining a Room

Guest may enter in two ways:

### A. Invitation
Host invites a friend.

### B. Room Code
Guest enters the room code manually.

Backend validates:

```text
room exists
AND room.status == WAITING
AND guestId == null
AND currentUser != hostId
```

Then:

```text
guestId = currentUserId
guestReady = false
```

Friendly 1v1 allows exactly:

```text
1 HOST + 1 GUEST
```

A third player must be rejected with:

```text
ROOM_FULL
```

---

## 8. Invitation Workflow

The FriendRoom must already exist before the invitation is sent.

Host emits:

```text
friend:invite
```

Payload:

```ts
{
  roomId,
  friendId,
}
```

Backend validates:
- caller is host
- room exists
- room is WAITING
- guest slot is empty
- friend is online
- friend is not already in another room/match

Create temporary invitation:

```ts
{
  inviteId,
  roomId,
  senderId,
  receiverId,
  status: "PENDING",
  createdAt,
  expiresAt,
}
```

Expiration:

```text
10 seconds
```

---

## 9. Invitation Status

```ts
export enum FriendInviteStatus {
  PENDING = "PENDING",
  ACCEPTED = "ACCEPTED",
  DECLINED = "DECLINED",
  EXPIRED = "EXPIRED",
  CANCELLED = "CANCELLED",
}
```

---

## 10. Guest Receives Invitation

Server emits:

```text
friend:invite-received
```

Guest UI:

```text
Nguyễn Văn A invited you to Friendly 1v1

Mode: Classic

10 seconds remaining

[ Decline ]   [ Accept ]
```

Important:

```text
The SERVER is authoritative for invitation expiration.
```

Frontend countdown is display-only.

---

## 11. Decline

Guest emits:

```text
friend:invite-decline
```

Backend:

```text
PENDING → DECLINED
```

Host receives:

```text
friend:invite-declined
```

Host UI:

```text
Minh Anh declined your invitation.
```

No player is added to the room.

---

## 12. Invitation Expiration

If 10 seconds pass and invite is still PENDING:

```text
PENDING → EXPIRED
```

Server emits:

```text
friend:invite-expired
```

The guest popup closes and host sees:

```text
Invitation expired.
```

An expired invite cannot be accepted.

---

## 13. Accept Invitation

Guest emits:

```text
friend:invite-accept
```

Backend validates:
- invitation exists
- status is PENDING
- current user is receiver
- invite is not expired
- room still exists
- room is WAITING
- guest slot is still empty

Then:

```text
invite.status = ACCEPTED
room.guestId = receiverId
room.guestReady = false
```

Guest joins:

```text
friend-room:<roomId>
```

No ArenaMatch is created yet.

---

## 14. Lobby UI

Show:

```text
HOST                        GUEST
Avatar                      Avatar
Username        VS          Username
Host                        Ready / Not Ready
```

If avatar is missing, show default User icon.

Also show:
- room code
- selected Friendly mode
- current settings
- player count `2/2`
- guest ready status
- Start button for host
- Leave Room button

---

## 15. Friendly Modes

Exactly two:

```ts
export enum ArenaFriendMode {
  CLASSIC = "CLASSIC",
  WORD_CHAIN = "WORD_CHAIN",
}
```

---

## 16. CLASSIC Mode

Classic MUST use:

```ts
ArenaQuestionMode.MEANING_TO_WORD
```

Gameplay:

```text
Show Vietnamese meaning
↓
Player types English word
```

Example:

```text
môi trường

[ environment ]
```

Classic should reuse existing Ranked `MEANING_TO_WORD` logic where practical:
- question generation
- answer validation
- server-authoritative timer
- hints if already supported
- scoring logic
- answer retry rules already used by Ranked

But Friendly Classic MUST NOT update:
- Elo
- rating
- ranked profile
- ArenaRatingHistory
- ranked leaderboard

---

## 17. CLASSIC Settings

Host can configure:

```text
questionCount
timePerQuestion
```

Recommended question count values:

```text
5
10
15
20
```

Suggested validation:

```ts
5 <= questionCount <= 30
```

Recommended time values:

```text
10 seconds
15 seconds
20 seconds
30 seconds
```

Example:

```ts
{
  mode: "CLASSIC",
  settings: {
    questionCount: 15,
    timePerQuestion: 20,
  }
}
```

---

## 18. WORD_CHAIN Mode

Word Chain does not use Arena questions.

It does not use:

```text
questionCount
```

Host configures only:

```text
turnTime
```

Recommended values:

```text
10 seconds
15 seconds
20 seconds
30 seconds
```

Example:

```ts
{
  mode: "WORD_CHAIN",
  settings: {
    turnTime: 20,
  }
}
```

---

## 19. Dynamic Settings UI

CLASSIC:

```text
Number of questions
[ 10 ▼ ]

Time per question
[ 15 seconds ▼ ]
```

WORD_CHAIN:

```text
Time per turn
[ 20 seconds ▼ ]
```

Do not show `questionCount` for Word Chain.

---

## 20. Settings Permissions

Only host can change:
- mode
- questionCount
- timePerQuestion
- turnTime

Guest may only view settings.

Backend must enforce host permission.

---

## 21. Setting Changes Reset Ready

If guest is ready and host changes:
- mode
- questionCount
- timePerQuestion
- turnTime

then:

```text
guestReady = false
```

Reason: guest must confirm readiness again after game rules change.

Server emits updated room state.

---

## 22. Ready Workflow

Only guest needs a Ready button.

Guest emits:

```text
friend-room:ready
```

Payload:

```ts
{
  roomId,
  ready: true,
}
```

Backend validates:
- room exists
- caller is current guest
- status is WAITING

Then:

```text
guestReady = true
```

Host receives realtime ready update.

---

## 23. Start Button Rules

Only host can start.

Start is enabled only when:

```text
room.status == WAITING
AND guestId != null
AND guestReady == true
AND currentMatchId == null
```

Frontend button state is not enough.

Backend MUST revalidate all conditions.

---

## 24. Create ArenaMatch Only on Start

Host emits:

```text
friend-room:start
```

Backend:

1. validate host
2. validate room
3. validate guest exists
4. validate guest ready
5. validate settings
6. atomically prevent duplicate start
7. create ArenaMatch
8. snapshot room settings
9. update room:
   - status = IN_MATCH
   - currentMatchId = matchId
   - matchCount += 1
10. join both users to:
   ```text
   match:<matchId>
   ```
11. emit match start

Example Classic match:

```ts
{
  type: "FRIEND",

  friendMode: "CLASSIC",

  questionMode: "MEANING_TO_WORD",

  roomCodeSnapshot: "AB12CD",

  roomId: "...",

  status: "PLAYING",

  settingsSnapshot: {
    questionCount: 10,
    timePerQuestion: 15,
  }
}
```

Example Word Chain match:

```ts
{
  type: "FRIEND",

  friendMode: "WORD_CHAIN",

  questionMode: null,

  roomCodeSnapshot: "AB12CD",

  settingsSnapshot: {
    turnTime: 20,
  }
}
```

---

## 25. Settings Snapshot Rule

Each ArenaMatch must save its own immutable settings snapshot.

Example:

Match #1 starts with:

```text
10 questions
15 seconds
```

After Match #1, host changes room to:

```text
20 questions
30 seconds
```

Match #1 history must still keep:

```text
10 questions
15 seconds
```

Old match history must never depend on current room settings.

---

## 26. CLASSIC Match Workflow

```text
Host Start
↓
Create FRIEND ArenaMatch
↓
friendMode = CLASSIC
questionMode = MEANING_TO_WORD
↓
Generate N questions
↓
Question 1
↓
Both players answer
↓
Server resolves question
↓
Update score
↓
Next question
↓
...
↓
Question N
↓
Compare final score
↓
Finish match
```

Where:

```text
N = settingsSnapshot.questionCount
```

Question timer:

```text
settingsSnapshot.timePerQuestion
```

No Elo update.

---

## 27. WORD_CHAIN Gameplay

Host goes first.

Example:

```text
HOST:
APPLE
```

Last letter:

```text
E
```

Guest must submit a valid word beginning with E:

```text
ENVIRONMENT
```

Then last letter becomes:

```text
T
```

Host must submit:

```text
TEACHER
```

Continue alternating turns.

---

## 28. WORD_CHAIN Valid Word Rules

A word is valid only if:

1. not empty
2. exists in supported English vocabulary source/database
3. starts with required letter
4. has not already been used in the match
5. is a valid single word under project rules

Example:

```text
previousWord = APPLE
requiredLetter = E
```

Guest submits:

```text
HOUSE
```

Reject:

```text
Word must start with E.
```

Player may retry while time remains.

Invalid attempts do not reset the timer.

---

## 29. WORD_CHAIN Timer

Every turn uses:

```text
settingsSnapshot.turnTime
```

Example:

```text
20 seconds
```

Valid word:

```text
switch player
↓
calculate new required letter
↓
reset timer
```

If timer reaches zero before a valid word is accepted:

```text
current player loses immediately
opponent wins
match finishes
```

---

## 30. WORD_CHAIN Duplicate Words

Track:

```ts
usedWords: string[]
```

Example:

```ts
[
  "apple",
  "environment",
  "teacher"
]
```

If a player submits a word already used:

```text
This word has already been used.
```

Timer continues.

---

## 31. WORD_CHAIN Runtime State

Suggested state:

```ts
{
  matchId,

  currentTurnUserId,

  currentWord,

  requiredLetter,

  turnStartedAt,

  turnDeadline,

  usedWords,

  turnCount,
}
```

Server time is authoritative.

---

## 32. Match Finish

### CLASSIC

```text
configured question count reached
↓
compare scores
↓
winner / draw
```

### WORD_CHAIN

```text
timeout / leave / forfeit
↓
opponent wins
```

Friendly match results are stored but do not affect rating.

---

## 33. Return Room to WAITING After Match

After match finishes:

```text
ArenaMatch.status = FINISHED

FriendRoom.status = WAITING
FriendRoom.currentMatchId = null
FriendRoom.guestReady = false
```

Result screen:

```text
[ Return to Room ]
[ Leave ]
```

---

## 34. Return to Room

When player clicks Return to Room:

1. fetch room
2. verify room exists
3. verify room is not closed
4. verify user is host or current guest
5. rejoin Socket.IO room
6. return latest room snapshot

Guest returns as not ready.

---

## 35. Multiple Matches in Same Room

Example:

```text
FriendRoom AB12CD

Match #1 → FINISHED
↓
Return to room

Match #2 → FINISHED
↓
Return to room

Match #3 → FINISHED
```

Room is a reusable session until host closes it.

---

## 36. Host Leave Rules

Host owns the room.

If host explicitly leaves:

```text
close room
kick guest
delete FriendRoom
```

Never transfer ownership to guest.

---

## 37. Host Leaves While WAITING

Example:

```text
Host A
Guest B
status = WAITING
```

A presses Leave Room.

Backend:

1. notify guest
2. remove both from socket room
3. close/delete room

Guest receives:

```text
friend-room:closed
```

Reason:

```text
HOST_LEFT
```

Guest UI:

```text
The host left the room.
This room has been closed.
```

Redirect to Friendly page.

---

## 38. Host Leaves Before Any Match Starts

If:

```text
matchCount == 0
```

and host leaves:

```text
DELETE FriendRoom immediately.
```

Examples:

```text
Create room
↓
Nobody joins
↓
Host leaves
↓
DELETE
```

or:

```text
Create room
↓
Guest joins
↓
No match starts
↓
Host leaves
↓
Kick guest
↓
DELETE
```

This prevents unused room records from accumulating.

---

## 39. Guest Leaves While WAITING

Guest leaving does not destroy room.

Backend:

```text
guestId = null
guestReady = false
```

Host remains.

Host UI returns to:

```text
[ User Plus ]
Waiting for player...
```

Another guest may join later.

---

## 40. Host Leaves After Finished Match

If one or more matches have already finished and host leaves:

```text
room becomes unavailable
guest cannot return
```

If guest is already back in lobby:

```text
guest is kicked
```

If guest is on result page and presses Return to Room:

```text
ROOM_NOT_FOUND
```

or:

```text
ROOM_CLOSED
```

Frontend shows:

```text
The room is no longer available because the host left.
```

Then redirect to Friendly page.

---

## 41. Room Cleanup

FriendRoom is temporary session data.

Finished ArenaMatch history must survive room deletion.

Recommended:

```text
DELETE FriendRoom when host closes/leaves it.
```

ArenaMatch should store enough snapshots to remain valid independently:

```ts
{
  roomCodeSnapshot,
  friendMode,
  settingsSnapshot,
  player ids / player snapshots,
  result,
  finishedAt,
}
```

---

## 42. Explicit Leave vs Disconnect

Do not treat WebSocket disconnect as immediate leave.

### Explicit Leave
User intentionally presses Leave Room.

Handle immediately.

### Disconnect
Examples:
- refresh
- temporary internet loss
- WebSocket reconnect
- browser hiccup

Use reconnect grace period.

Recommended:

```text
20 seconds
```

---

## 43. Host Disconnect Grace

If host disconnects:

```text
start 20s grace
```

If host reconnects:

```text
restore socket room
send room snapshot
continue
```

If host does not reconnect:

```text
treat as host left
close/delete room
kick guest
```

---

## 44. Guest Disconnect Grace

If guest disconnects in WAITING:

```text
start grace
```

If reconnects:

```text
restore guest
send room snapshot
```

If timeout:

```text
guestId = null
guestReady = false
```

Host remains.

---

## 45. Disconnect During Match

During active ArenaMatch, use Arena match reconnect/forfeit logic.

Do not delete FriendRoom immediately on temporary match socket loss.

Room remains:

```text
IN_MATCH
```

until match lifecycle resolves.

---

## 46. Suggested Socket Events

### Room

```text
friend-room:create
friend-room:created

friend-room:join
friend-room:joined

friend-room:update

friend-room:settings-update
friend-room:settings-updated

friend-room:ready
friend-room:ready-updated

friend-room:start
friend-room:started

friend-room:leave
friend-room:closed
```

### Invitation

```text
friend:invite
friend:invite-received

friend:invite-accept
friend:invite-decline

friend:invite-accepted
friend:invite-declined
friend:invite-expired
```

### Match

```text
friend:match-start
friend:match-finished
```

### Classic

Reuse existing Ranked services/events where practical but always keep:

```text
match.type = FRIEND
```

Possible events:

```text
friend:question
friend:answer
friend:answer-result
friend:score-update
```

### Word Chain

```text
word-chain:start
word-chain:turn
word-chain:submit
word-chain:accepted
word-chain:invalid
word-chain:finished
```

---

## 47. Server Authority

Server is authoritative for:
- room membership
- room code validity
- invitation expiration
- guest ready state
- settings
- match creation
- Classic question timing
- Word Chain timer
- Word Chain current turn
- valid words
- used words
- results
- disconnect timeout
- room cleanup

Frontend state is presentation only.

---

## 48. Suggested Services

```text
arena/
├── services/
│   ├── arena-friend-room.service.ts
│   ├── arena-friend-invite.service.ts
│   ├── arena-match.service.ts
│   ├── arena-question.service.ts
│   ├── arena-round.service.ts
│   ├── arena-word-chain.service.ts
│   └── arena-presence.service.ts
```

### ArenaFriendRoomService

Responsible for:
- create room
- join room
- leave room
- update settings
- guest ready
- validate start
- reset room after match
- close/delete room
- reconnect snapshot

### ArenaFriendInviteService

Responsible for:
- create invite
- accept
- decline
- expire
- cancel

### ArenaMatchService

Responsible for:
- create FRIEND ArenaMatch on Start
- finish match
- persist history

### ArenaQuestionService

Responsible for:
- CLASSIC questions
- reuse existing `MEANING_TO_WORD` logic

### ArenaWordChainService

Responsible for:
- initialize chain
- validate word
- track used words
- switch turn
- deadline processing
- finish on timeout

---

## 49. Atomic Start Protection

Host double-clicking Start must not create duplicate matches.

Atomically transition:

```text
WAITING → IN_MATCH
```

only if:

```text
status == WAITING
guestId != null
guestReady == true
currentMatchId == null
```

Only the successful request may create the match.

Duplicate request should return:

```text
MATCH_ALREADY_STARTED
```

or the current match id.

---

## 50. Validation Rules

### Create
Reject if:
- user already in active room
- user already in active match

### Join
Reject if:
- room not found
- room closed
- room in active match
- room full
- caller is host
- caller already elsewhere

### Update Settings
Reject if:
- caller is not host
- room is not WAITING
- invalid values

### Ready
Reject if:
- caller is not guest
- room is not WAITING

### Start
Reject if:
- caller is not host
- guest missing
- guest not ready
- room not WAITING
- currentMatchId already exists

### Return
Reject if:
- room deleted/closed
- user is neither host nor current guest

---

## 51. Recommended Error Codes

```text
ROOM_NOT_FOUND
ROOM_CLOSED
ROOM_FULL
ROOM_IN_MATCH

NOT_ROOM_HOST
NOT_ROOM_GUEST

GUEST_NOT_READY
INVALID_ROOM_SETTINGS

INVITE_NOT_FOUND
INVITE_EXPIRED
INVITE_ALREADY_RESOLVED

ALREADY_IN_ROOM
ALREADY_IN_MATCH

MATCH_ALREADY_STARTED
```

---

## 52. Full End-to-End Workflow

```text
A opens Friendly 1v1
↓
Create Room
↓
Server generates room code
↓
FriendRoom WAITING
↓
A joins room
↓
A selects:

CLASSIC
├── questionCount
└── timePerQuestion

OR

WORD_CHAIN
└── turnTime

↓
B joins by:
├── invitation
└── room code

↓
B presses Ready
↓
guestReady = true
↓
Host Start enabled
↓
A presses Start
↓
server atomically locks room
↓
CREATE ArenaMatch
↓
FriendRoom = IN_MATCH

├────────────────────────────┐
│ CLASSIC                    │
│ friendMode = CLASSIC       │
│ questionMode =             │
│ MEANING_TO_WORD            │
│                            │
│ same gameplay as Ranked    │
│ but NO Elo/rating changes  │
└────────────────────────────┘

OR

┌────────────────────────────┐
│ WORD_CHAIN                 │
│ host starts first          │
│ next word starts with      │
│ previous word's last char  │
│ turnTime per turn          │
│ invalid → retry            │
│ timeout → lose             │
└────────────────────────────┘

↓
ArenaMatch FINISHED
↓
FriendRoom = WAITING
currentMatchId = null
guestReady = false
↓
Result

[ Return to Room ]
[ Leave ]

↓ Return
same FriendRoom
↓
Guest Ready again
↓
Host Start
↓
CREATE a NEW ArenaMatch

OR

Host leaves
↓
Room closes
↓
Guest kicked
↓
FriendRoom deleted
↓
Finished ArenaMatch history remains
```

---

## 53. Mandatory Rules for the AI Coder

```text
1. FriendRoom and ArenaMatch are separate entities.

2. Creating FriendRoom MUST NOT create ArenaMatch.

3. ArenaMatch is created only when HOST presses Start.

4. FriendRoom supports exactly HOST + GUEST.

5. Host ownership is never transferred.

6. Host leaving closes the room.

7. If host leaves before any match starts, delete FriendRoom immediately.

8. Guest leaving does not destroy the room.

9. After a match, both users may return to the same FriendRoom.

10. Guest ready resets after every finished match.

11. Guest ready also resets when host changes mode/settings.

12. If host has closed the room, nobody may return.

13. CLASSIC MUST use ArenaQuestionMode.MEANING_TO_WORD.

14. CLASSIC should reuse Ranked MEANING_TO_WORD gameplay logic.

15. Friendly matches NEVER affect Elo/rating/rank.

16. CLASSIC settings:
    - questionCount
    - timePerQuestion

17. WORD_CHAIN settings:
    - turnTime only

18. WORD_CHAIN MUST NOT use questionCount.

19. Only HOST changes settings.

20. Only GUEST needs to press Ready.

21. Only HOST can Start.

22. Start requires:
    - WAITING room
    - guest exists
    - guestReady == true
    - no currentMatchId

23. Start must be protected from duplicate requests.

24. Every ArenaMatch stores immutable settingsSnapshot.

25. Old match history must not depend on FriendRoom.

26. Explicit Leave and Disconnect are different.

27. Temporary disconnect uses reconnect grace, recommended 20s.

28. Deleting FriendRoom MUST NOT delete finished ArenaMatch history.

29. FriendRoom is temporary session data.

30. Server is authoritative for all timers, membership, ready state,
    settings, validation, results, and cleanup.
```

---

## 54. Acceptance Tests

### Room
- Host creates room.
- Room code is unique.
- Host reloads and rejoins.
- Guest joins by code.
- Guest joins by invitation.
- Third user cannot join.
- Guest leaves and host remains.
- Another guest can join later.
- Host leaves and guest is kicked.
- Room is deleted after host closes it.

### Invitation
- Accept within 10s.
- Decline.
- Expire after 10s.
- Expired invite cannot be accepted.
- Full room cannot accept another invite.

### Ready / Settings
- Guest can ready.
- Host can change settings.
- Guest cannot change settings.
- Changing settings resets guest ready.
- Start disabled without guest.
- Start disabled when guest not ready.
- Start enabled when guest ready.

### Classic
- Creates FRIEND match.
- Uses MEANING_TO_WORD.
- Custom questionCount works.
- Custom timePerQuestion works.
- No Elo changes.
- Match finishes.
- Room returns to WAITING.

### Word Chain
- Host starts first.
- Required first letter is enforced.
- Invalid word may be retried.
- Duplicate word rejected.
- Invalid attempt does not reset timer.
- Valid word switches turn.
- Timer resets after valid word.
- Timeout causes immediate loss.
- No Elo changes.

### Return / Rematch
- Both can return after finished match.
- Guest ready resets.
- Host may change settings.
- New Start creates a new ArenaMatch.
- Old match remains unchanged.

### Host Closure
- Host leaves before first match → room deleted.
- Host leaves after match → room unavailable.
- Guest on result page cannot return after host closes room.
- Guest in lobby is kicked when host closes room.

### Reconnect
- Host reconnects within grace.
- Guest reconnects within grace.
- Host grace timeout closes room.
- Guest grace timeout clears guest slot.


## 55. Multiplayer Room extension

The Battle room entry (`/arena/group`) shares the Friendly lobby and match workflow above.
The existing Friendly 1v1 entry remains a two-player room.

- Battle rooms created from Arena default to 8 players. The host can adjust capacity to 3 through 8 in the lobby settings.
- Capacity includes the host. Start requires at least 3 participants and every guest ready;
  the room does not have to fill every seat before starting.
- The server enforces capacity, membership, host permissions, readiness and atomic Start.
- Room matches use `ArenaMatchType.ROOM` and never update ranked profiles or Elo.
- Classic reuses the 1v1 questions, answer validation, scoring and timers for all participants.
- Word Chain starts with the host and rotates through participants in join order. Invalid
  answers keep the same deadline. A timed-out player is eliminated; turns skip eliminated
  players and the last remaining participant wins. A valid word earns one scoreboard point.
- A guest leaving or exceeding reconnect grace drops out while the others continue.
  The host explicitly leaving closes the lobby and finishes the current match.
- After a match, return to the same room; all guests must ready again for another match.
- Finished match history survives deletion of the temporary room.


## 56. Five-letter Word Guess mode

`ArenaFriendMode.WORD_GUESS` is available in both Friendly 1v1 and Battle rooms.
The host selects this mode in Match settings, then saves it; guests ready again.

- The server selects a random active English vocabulary word containing exactly 5 letters.
- Every player gets 5 private guesses of exactly 5 English letters. No per-turn timer.
- Green means the letter is in the correct position, yellow means it exists elsewhere,
  and gray means it is absent. Exact matches consume letters before yellow matches,
  so duplicate letters never receive more matches than the answer contains.
- Invalid-length and repeated guesses do not consume attempts.
- The first correct guess wins. If everyone exhausts their attempts, the match is a draw.
- The answer stays hidden until the match finishes; only a player's own guesses are returned.
- A correct guess scores 100 points for each unused attempt, including the winning attempt.
- This mode creates no Classic questions and never changes ranked Elo.
- Refresh/reconnect restores the same guesses. Return to the room to play a new match.


## 57. Arena card entry and room code types

- Both the Friendly 1v1 and Battle room cards on `/arena` expose Create room and Enter code.
- Create room creates the lobby immediately, then navigates to its code URL. The Battle room
  card creates a room with capacity 8. The host adjusts capacity from 3 through 8 inside the lobby and saves the settings.
- Enter code opens a Dialog popup for the selected card type; there is no separate creation/join page.
- Bare `/arena/friend` and `/arena/group` routes redirect to `/arena`.
- Manual `friend-room:join` requests include `roomType: 'FRIEND' | 'ROOM'` along with `code`.
- FRIEND accepts only two-player lobbies; ROOM accepts only multiplayer lobbies. The server
  rejects `ROOM_TYPE_MISMATCH` before modifying membership, including on member reentry.
- Missing/invalid types on manual code joins return `INVALID_ROOM_TYPE`. Code errors appear inside the popup.
- Joining by `roomId` is reserved for existing members restoring their own lobby. Invitation
  acceptance joins the invitation's existing lobby and navigates to its actual room type.


## 58. Lobby capacity controls

Only the host can change multiplayer `maxPlayers` through `friend-room:settings-update`.
Changes require a WAITING room, an integer from 3 through 8, and enough seats for all current
participants. Capacity changes reset every guest's readiness and are protected by the room
revision so concurrent joins cannot exceed the new limit. Friendly 1v1 stays fixed at two.


## 59. Room entry popup and settings controls

The Arena Enter code action opens a modal Dialog with a six-character code input, Cancel,
and Join room. It preserves the selected FRIEND/ROOM type, shows validation errors in the
popup, and restores focus to the entry button on close. Lobby capacity, game mode, and time
controls use the shared shadcn/ui Select component.
