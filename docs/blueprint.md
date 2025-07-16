# **App Name**: Memory Lane

## Core Features:

- Goal Sequence Generation: Generates a random goal sequence (collection of sets) by randomly assigning numbers between 0-4 for the required card sets.
- Deal Narrative Deck: Deals out the initial four narrative deck cards (excluding face cards except for Aces).
- Deal Play Deck: Deals out the initial eight play deck cards in two rows (A-D and E-H).
- Card Manipulation: Implements card drag-and-drop functionality for moving cards to the narrative deck, discarding them, or adding them to the play deck. Only A is interactive first. If played, E moves up and a new card is placed. If discarded, B is playable. Once A-D are discarded, E-H move up and 4 new cards are dealt.
- Pile Review: Allows viewing the contents of the 'Forgotten Pile' and 'Completed Memories' pile through tappable deck/pack buttons.
- Game Validation: Validates that moves conform to game rules. For example, validates if a card played can form a set; validates whether power cards are activated correctly; limits cards in memory
- Game history: Keep track of the game's history: cards in narrative, memory, or discard piles; the order of discarded cards; valid vs invalid moves; what moves were suggested vs taken.
- Power Cards: Implement functionality for power cards: King (discard pile from narrative deck), Jack (remove card in sequence or draw from forgotten pile), and Queen (acts as a full set).
- Game Timer: Implement a timer that tracks the total time taken by the player to win the game.
- Intro Page: Cool intro page with a dramatic yet clear brief explanation of the game and a begin button. 

## Style Guidelines:

- Primary color: A dark, muted teal (#008080) as a base, reminiscent of retro anime aesthetics.
- Background color: Off-white (#F5F5DC) to emulate aged paper, providing a nostalgic feel.
- Accent color: Electric blue (#7DF9FF) for highlighting interactive elements and power card effects, inspired by modern anime visuals.
- Body font: 'Varela Round', a sans-serif to ensure legibility; headline font: 'Bangers', a bold display font reminiscent of retro anime titles.
- Use stylized, slightly abstract card suit icons with a hand-drawn aesthetic for goal collections and set status.
- Cards in play: Use a clean, staggered layout for the two rows, inspired by card game interfaces in anime. Discard piles and memory piles appear as packs that can be tapped and fanned open. Goal sets are displayed as small stacks using icons.
- Cards that move across the screen will have a subtle 'motion blur' effect, mimicking the animation style of Jujutsu Kaisen.