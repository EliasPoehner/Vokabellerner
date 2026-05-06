const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7',
               '8', '9', '10', 'J', 'Q', 'K'];

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        suit,
        rank,
        value: RANKS.indexOf(rank) + 1,
        color: (suit === '♥' || suit === '♦') ? 'red' : 'black',
        faceUp: false,
      });
    }
  }
  return deck;
}

// Fisher-Yates Shuffle
function shuffle(deck) {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

const shuffledDeck = shuffle(createDeck());