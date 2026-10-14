# Friendly 1v1 Arena Specification

## 1. Purpose

Friendly 1v1 is the casual player-vs-player mode in Vocabulary Arena.

It is designed for playing with friends and does **not** affect ranked rating/Elo.

The mode has two gameplay types only:

```ts
export enum ArenaFriendMode {
  CLASSIC = 'CLASSIC',
  WORD_CHAIN = 'WORD_CHAIN',
}
```

Important clarification:

- `CLASSIC` means the same gameplay style as Ranked.
- Ranked currently uses `ArenaQuestionMode.MEANING_TO_WORD`.
- Therefore, Friendly `CLASSIC` must also use `MEANING_TO_WORD`.
- `CLASSIC` is not a separate question format. It is simply Friendly 1v1 using the same `MEANING_TO_WORD` gameplay as Rank, but without Elo/rating changes.

---

## 2. Route Structure

Recommended routes:

```text
/[locale]/arena/friend
/[locale]/arena/friend/[matchId]
```

Meaning:

```text
/arena/friend
-> invite/select friend page

/arena/friend/[matchId]
-> Friendly lobby and active Friendly match
```

---

## 3. Friend Invite Page UI

The Friendly invite page should show two player slots.

Left side is the current user:

```text
[ Avatar ]
Username
```

If the user has no avatar, show a default user icon.

Right side is empty before an opponent is invited:

```text
[ UserPlus icon ]
Invite Friend
```

In the center, show a large colorful `VS` visual.

Friendly mode must not show Elo/rank because this mode is casual and does not affect ranking.

When the user clicks the `UserPlus` slot, open a friend picker popup.

The popup contains:

- search input
- online friends
- recently played users
- avatar or default user icon
- username
- online/offline state
- Invite button

Do not display Elo in the friend invitation UI.

---

## 4. Selecting Friendly Mode

Before sending an invite, the inviter chooses one of two modes:

```text
Classic
Word Chain
```

### 4.1 Classic

`CLASSIC` must use:

```ts
ArenaQuestionMode.MEANING_TO_WORD
```

This is the same question mode as Ranked.

Gameplay:

```text
Vietnamese meaning
-> player types the English word
```

Example:

```text
"môi trường"

[ environment ]
```

Classic reuses the same core question gameplay as Rank, including server-side question validation, timer, hints, retry on wrong answer, and score calculation where appropriate.

The main difference from Rank is:

```text
NO Elo change
NO ArenaRatingHistory update
NO ranked leaderboard impact
```

### 4.2 Word Chain

`WORD_CHAIN` is not a question mode from `ArenaQuestionMode`.

It is a separate Friendly gameplay type.

Players take turns entering English words.

The next word must start with the final letter of the previous word.

Example:

```text
Player A: APPLE
Last letter: E

Player B must enter a word beginning with E.

Player B: ENVIRONMENT
Last letter: T

Player A must enter a word beginning with T.

Player A: TEACHER
Last letter: R
```

Each turn has 20 seconds.

If the active player cannot submit a valid word before the timer reaches zero, that player loses immediately.

---

## 5. Sending an Invitation

Player A selects:

- Friendly mode
- Player B

Then frontend emits:

```ts
arenaSocket.emit('friend:invite', {
  friendId,
  mode,
});
```

The server creates an invitation with a 10-second lifetime.

Suggested structure:

```ts
{
  inviteId,
  senderId,
  receiverId,
  mode,
  status: 'PENDING',
  createdAt,
  expiresAt,
}
```

Recommended status enum:

```ts
export enum FriendInviteStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}
```

---

## 6. Receiving the Invitation

Player B receives:

```text
friend:invite-received
```

The popup should show:

```text
Nguyen Van A invited you to a Friendly match
Mode: Classic / Word Chain

10 seconds remaining

[ Decline ] [ Accept ]
```

The countdown shown by the frontend is visual only.

The server is the source of truth for invitation expiration.

---

## 7. Declining an Invitation

Player B emits:

```ts
arenaSocket.emit('friend:invite-decline', {
  inviteId,
});
```

Server changes:

```text
PENDING -> DECLINED
```

Player A receives:

```text
friend:invite-declined
```

The inviter sees a notification such as:

```text
Minh Anh declined your invitation.
```

The opponent slot resets back to:

```text
[ UserPlus ]
Invite Friend
```

---

## 8. Invitation Timeout

If Player B does not accept or decline within 10 seconds:

```text
PENDING -> EXPIRED
```

Server emits expiration to both players.

Player A sees:

```text
The invitation expired.
```

Player B's invitation popup closes.

Do not allow the frontend countdown alone to decide expiration.

---

## 9. Accepting an Invitation

Player B emits:

```ts
arenaSocket.emit('friend:invite-accept', {
  inviteId,
});
```

Server must validate:

- invite exists
- status is still `PENDING`
- invitation has not expired
- current user is the receiver
- both users are available
- neither user is already in another active match

Then:

```text
PENDING -> ACCEPTED
```

The server creates a Friendly match.

Suggested match state:

```ts
{
  type: ArenaMatchType.FRIEND,
  status: ArenaMatchStatus.WAITING,
  friendMode: ArenaFriendMode.CLASSIC | ArenaFriendMode.WORD_CHAIN,
  hostId: senderId,
}
```

Player A is the host.

Create two `ArenaMatchPlayer` records for A and B.

Friendly does not calculate ranked rating changes.

---

## 10. Redirect to Friendly Lobby

After match creation, server emits:

```text
friend:match-created
```

Suggested payload:

```ts
{
  matchId,
  mode,
}
```

Both clients navigate to:

```text
/[locale]/arena/friend/[matchId]
```

---

## 11. Friendly Lobby

Lobby layout:

```text
Player A                 Player B
Avatar                   Avatar
Username                 Username
HOST                     Not Ready

             VS

Mode: Classic / Word Chain
```

Player A is host.

Player B must press Ready before Player A can start the match.

Player B UI:

```text
[ Ready ]
```

Player A UI before B is ready:

```text
[ Start Match ] disabled
```

Player A UI after B is ready:

```text
[ Start Match ] enabled
```

---

## 12. Ready Flow

Player B emits:

```ts
arenaSocket.emit('friend:ready', {
  matchId,
});
```

Server sets:

```text
playerB.isReady = true
```

Server emits to the Friendly room:

```text
friend:ready-update
```

Suggested payload:

```ts
{
  userId,
  isReady: true,
}
```

The host now sees Player B as ready.

---

## 13. Starting the Match

Host emits:

```ts
arenaSocket.emit('friend:start', {
  matchId,
});
```

Server validates:

- caller is host
- match status is `WAITING`
- opponent is ready

Then:

```text
WAITING -> PLAYING
```

The server starts gameplay based on `friendMode`.

---

# 14. Classic Gameplay

## 14.1 Important Rule

Friendly `CLASSIC` is explicitly the same question gameplay as Ranked:

```ts
ArenaQuestionMode.MEANING_TO_WORD
```

Do not create a new question type named `CLASSIC`.

`CLASSIC` is only the Friendly mode name.

Internally it should use:

```ts
questionMode = ArenaQuestionMode.MEANING_TO_WORD
```

## 14.2 Gameplay

Example:

```text
Meaning:
"môi trường"

[ Enter the English word... ]
```

Players type:

```text
environment
```

The server validates the answer.

Use the existing Ranked `MEANING_TO_WORD` infrastructure where possible:

- question snapshot generation
- `ArenaMatchQuestion`
- server timer
- answer normalization
- incorrect retry
- hint logic
- current-question validation
- answer result
- score updates
- automatic next question

Suggested Classic flow:

```text
start match
-> create/load 10 questions
-> send question 1
-> both players answer
-> resolve the round
-> score update
-> next question
-> after question 10 compare scores
-> finish match
```

No ranked rating operations are executed after the match.

The winner is the player with the higher match score.

If scores are equal, the match is a draw.

---

# 15. Word Chain Gameplay

Word Chain is turn-based and does not use the Ranked question list.

There is no fixed set of 10 questions.

There is no Vietnamese meaning prompt.

There is no Elo.

There is no Classic-style score requirement.

The match continues until one player fails their turn.

---

## 15.1 First Turn

The host always starts first.

Example:

```text
Player A enters:
APPLE
```

Server normalizes the word and determines the final letter:

```text
APPLE -> E
```

Now it becomes Player B's turn.

---

## 15.2 Next Word Rule

Player B must enter a valid English word beginning with `E`.

Example:

```text
ENVIRONMENT
```

Then:

```text
ENVIRONMENT -> T
```

Player A must enter a valid word beginning with `T`.

Example:

```text
TEACHER
```

Then:

```text
TEACHER -> R
```

The turn keeps alternating.

---

## 15.3 Turn Time Limit

Every turn has:

```text
20 seconds
```

When the turn changes:

```text
turnStartedAt = now
turnDeadline = now + 20 seconds
```

The server clock controls timeout.

The frontend timer is display only.

---

## 15.4 Word Validation

A submitted Word Chain word is valid only when all conditions pass:

1. word is not empty
2. word is a valid English word according to the application's vocabulary source
3. word starts with the required letter
4. word has not already been used in the current match
5. word passes normalization rules
6. it is currently the submitting user's turn
7. the turn deadline has not expired

Example:

```text
previousWord = APPLE
requiredLetter = E
```

Player submits:

```text
HOUSE
```

Server rejects it because it starts with `H`, not `E`.

Frontend shows:

```text
The word must begin with E.
```

The player does not immediately lose.

The player may try again while time remains.

The 20-second timer does not reset after an invalid attempt.

---

## 15.5 Duplicate Words

Server stores used words for the match.

Example:

```ts
usedWords = [
  'apple',
  'environment',
  'teacher',
];
```

If a player submits a word that has already been used:

```text
This word has already been used.
```

The player may try another word if there is still time remaining.

---

## 15.6 Word Chain Match State

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

This can be persisted in MongoDB, Redis, or split between match state and a Word Chain-specific state object, depending on the existing Arena architecture.

---

## 15.7 Word Chain Turn Event

Server emits:

```text
word-chain:turn
```

Suggested payload:

```ts
{
  matchId,
  currentTurnUserId,
  previousWord: 'APPLE',
  requiredLetter: 'E',
  seconds: 20,
  turnCount: 4,
}
```

---

## 15.8 Player Submission

Frontend emits:

```ts
arenaSocket.emit('word-chain:submit', {
  matchId,
  word,
});
```

Server validates the submission.

If valid:

```text
word-chain:accepted
```

Then:

- add normalized word to `usedWords`
- set `currentWord`
- calculate next required letter
- switch `currentTurnUserId`
- reset turn timer to 20 seconds
- emit the next `word-chain:turn`

If invalid:

```text
word-chain:invalid
```

Possible reasons:

```text
INVALID_START_LETTER
WORD_ALREADY_USED
WORD_NOT_FOUND
NOT_YOUR_TURN
TURN_EXPIRED
```

---

## 15.9 Word Chain Timeout

If the active player does not submit a valid word before `turnDeadline`:

```text
active player loses immediately
other player wins immediately
```

Example:

```text
Previous word: APPLE
Required letter: E

Player B fails to submit a valid word within 20 seconds.

Winner: Player A
Loser: Player B
```

The match moves to `FINISHED`.

---

## 15.10 Word Chain UI

When it is the current user's turn:

```text
              APPLE
                 ↓

         NEXT LETTER

                 E

Your word must begin with E

[ Enter an English word... ]

              14s
```

When it is the opponent's turn:

```text
APPLE
↓
E

Waiting for Minh Anh to continue...
18s
```

The local input is disabled while waiting for the opponent.

The header can show:

```text
Player A      VS      Player B
6 words               5 words
```

Do not use Elo.

Do not require a `520 : 480` score display for Word Chain.

A more meaningful shared stat is:

```text
Current chain: 11 words
```

---

# 16. Finishing Friendly Matches

Friendly matches finish differently depending on mode.

## Classic

Finish after all configured questions are resolved.

Winner:

```text
higher score wins
```

Equal scores:

```text
draw
```

## Word Chain

Finish immediately when one player:

- fails to submit a valid word before 20 seconds
- intentionally leaves the active match
- exceeds reconnect grace period

The other player wins.

---

## 17. Friendly Result Screen

Classic result example:

```text
Victory!

You       720
Minh Anh  640

[ Rematch ]
[ Back to Arena ]
```

Word Chain result example:

```text
TIME'S UP

Minh Anh could not find a word beginning with R.

Nguyen Van A wins

17 words connected
4m 12s

[ Rematch ]
[ Back to Arena ]
```

Do not display Elo changes.

---

## 18. Rematch

After a Friendly match, a player can request another match.

Suggested event:

```text
friend:rematch-request
```

Opponent receives:

```text
Nguyen Van A wants a rematch.

[ Decline ] [ Accept ]
```

Recommended behavior after accepting:

```text
return both players to the Friendly lobby
```

This allows the host to keep or change the mode before starting again.

---

## 19. Leaving the Lobby

If either player leaves while match status is `WAITING`:

```text
match -> CANCELLED
```

The remaining player receives:

```text
The other player left the room.
```

There is no winner or loser because gameplay had not started.

---

## 20. Leaving During an Active Match

If a player intentionally leaves while status is `PLAYING`:

```text
leaving player -> loses
remaining player -> wins
```

Suggested finish reason:

```text
PLAYER_LEFT
```

This applies to both Classic and Word Chain.

---

## 21. Disconnect and Reconnect

Socket disconnect must not immediately count as a loss because it may be caused by:

- page refresh
- temporary network loss
- browser crash
- device sleep

Give a reconnect grace period, for example:

```text
20 seconds
```

While disconnected, opponent sees:

```text
Minh Anh lost connection.
Waiting for reconnection...
18s
```

If the player reconnects within the grace period:

- restore player state
- rejoin Socket.IO match room
- send match snapshot
- continue the existing match

Do not restart the match or regenerate questions.

If the disconnected player does not return before the grace period expires:

```text
disconnected player -> loses
other player -> wins
```

Suggested finish reason:

```text
DISCONNECT_TIMEOUT
```

---

## 22. Match Status

The existing Arena match statuses can be reused:

```ts
export enum ArenaMatchStatus {
  WAITING = 'WAITING',
  COUNTDOWN = 'COUNTDOWN',
  PLAYING = 'PLAYING',
  FINISHING = 'FINISHING',
  FINISHED = 'FINISHED',
  CANCELLED = 'CANCELLED',
}
```

Friendly usually follows:

```text
WAITING
-> PLAYING
-> FINISHING
-> FINISHED
```

`COUNTDOWN` is optional for Friendly and is not required if the host explicitly presses Start.

---

## 23. Suggested Friendly Socket Events

General Friendly lifecycle:

```text
friend:invite
friend:invite-received
friend:invite-accept
friend:invite-decline
friend:invite-expired

friend:match-created

friend:ready
friend:ready-update

friend:start
friend:match-start
friend:match-finished

friend:leave

friend:rematch-request
friend:rematch-accept
friend:rematch-decline
```

Classic gameplay can reuse or wrap the existing Ranked round infrastructure:

```text
friend:question
friend:answer
friend:answer-result
friend:score-update
```

Again, Classic means:

```ts
questionMode = ArenaQuestionMode.MEANING_TO_WORD
```

Word Chain events:

```text
word-chain:start
word-chain:turn
word-chain:submit
word-chain:accepted
word-chain:invalid
```

---

## 24. Complete Friendly 1v1 Flow

```text
Player A opens Friendly
↓
A selects mode
├── CLASSIC
└── WORD_CHAIN
↓
A clicks UserPlus
↓
friend picker opens
↓
A selects Player B
↓
friend:invite
↓
B receives 10-second invite

├── B declines
│   ↓
│   DECLINED
│   ↓
│   A is notified
│   ↓
│   invitation UI resets
│
├── 10 seconds expire
│   ↓
│   EXPIRED
│   ↓
│   both clients are notified
│   ↓
│   invitation UI resets
│
└── B accepts
    ↓
    server creates FRIEND match
    ↓
    A = host
    ↓
    both navigate to /arena/friend/[matchId]
    ↓
    B presses Ready
    ↓
    host Start button becomes enabled
    ↓
    A presses Start
    ↓
    match becomes PLAYING
    ↓
    ├── CLASSIC
    │   ↓
    │   ArenaQuestionMode.MEANING_TO_WORD
    │   ↓
    │   same core gameplay as Ranked
    │   ↓
    │   no Elo / rating changes
    │   ↓
    │   final score decides winner
    │
    └── WORD_CHAIN
        ↓
        host enters first English word
        ↓
        server gets final letter
        ↓
        opponent must enter a word beginning with that letter
        ↓
        20 seconds per turn
        ↓
        invalid word -> retry while time remains
        ↓
        valid word -> switch turn and reset timer
        ↓
        timeout -> active player loses immediately

↓
match FINISHED
↓
show result
↓
Rematch or Back to Arena
```

---

## 25. Key Implementation Rules for AI

When implementing this specification, follow these rules strictly:

1. Friendly `CLASSIC` is **not** a new question mode.
2. Friendly `CLASSIC` must use `ArenaQuestionMode.MEANING_TO_WORD`, exactly like Ranked.
3. Reuse Ranked Meaning-to-Word gameplay/services where possible instead of duplicating core answer logic.
4. Friendly must never update Elo/rating or Ranked statistics.
5. `WORD_CHAIN` is a separate Friendly gameplay flow and does not use the standard question list.
6. Invitation expiration is controlled by the server, not only by frontend countdown.
7. Only the host can start the Friendly match.
8. The invited player must be ready before Start becomes available.
9. Word Chain has a server-controlled 20-second deadline for every turn.
10. Invalid Word Chain submissions do not immediately lose the match; the player can retry while time remains.
11. A Word Chain timeout causes an immediate loss.
12. Previously used words cannot be reused in the same Word Chain match.
13. Friendly disconnects should allow a reconnect grace period before applying a loss.
14. Do not display Elo on Friendly invitation, lobby, gameplay, or result screens.
