document.getElementById('draw-button').addEventListener('click', () => {
    const cardContainer = document.getElementById('card-container');
    cardContainer.innerHTML = ''; // Očisti prethodne karte

    // Poziv API-ju za miješanje i izvlačenje 5 karata
    fetch('https://deckofcardsapi.com/api/deck/new/draw/?count=5')
        .then(response => response.json())
        .then(data => {
            data.cards.forEach(card => {
                const cardElement = document.createElement('div');
                cardElement.classList.add('card');
                const cardImage = document.createElement('img');
                cardImage.src = card.image;
                cardImage.alt = `${card.value} of ${card.suit}`;
                cardElement.appendChild(cardImage);
                cardContainer.appendChild(cardElement);
            });
        })
        .catch(error => console.error('Greška pri dohvaćanju karata:', error));
});