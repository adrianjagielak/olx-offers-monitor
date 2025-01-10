const axios = require('axios');

let previousOffers = {};
let initialRun = true;

const fetchOffers = async (olxSearchURL) => {
    try {
        const response = await axios.get(olxSearchURL);
        return response.data.data;
    } catch (error) {
        console.error("Error fetching offers:", error);
        return [];
    }
};

const sendDiscordMessage = async (webhookURL, message) => {
    try {
        await axios.post(webhookURL, { content: message });
    } catch (error) {
        console.error("Error sending Discord message:", error);
    }
};

const getChanges = (newOffers) => {
    const changes = { added: [], changed: [] };
    const newOffersMap = {};

    newOffers.forEach(offer => {
        const { id, title, url, params } = offer;
        const priceParam = params.find(param => param.key === 'price');
        const price = priceParam ? priceParam.value.label : 'Unknown';

        newOffersMap[id] = { title, url, price };

        if (!previousOffers[id] && !initialRun) {
            changes.added.push({ title, price, url });
        } else if (previousOffers[id] && previousOffers[id].price !== price) {
            changes.changed.push({ title, oldPrice: previousOffers[id].price, newPrice: price, url });
        }
    });

    previousOffers = newOffersMap;
    return changes;
};

const formatMessages = (changes, newOffers) => {
    const messages = [];

    if (initialRun) {
        const initialOffersMessage = "Initial offers:\n" + newOffers.map(offer => `${offer.title} - ${offer.params.find(param => param.key === 'price')?.value.label || 'Unknown'}\n${offer.url}`).join("\n\n");
        messages.push(initialOffersMessage);
        initialRun = false;
    }

    if (changes.added.length > 0) {
        const addedMessage = "Added:\n" + changes.added.map(offer => `${offer.title} - ${offer.price}\n${offer.url}`).join("\n\n");
        messages.push(addedMessage);
    }

    if (changes.changed.length > 0) {
        const changedMessage = "Changed:\n" + changes.changed.map(change => `${change.title}\nPrice: ${change.oldPrice} → ${change.newPrice}\n${change.url}`).join("\n\n");
        messages.push(changedMessage);
    }

    return messages;
};

const main = async (webhookURL, olxSearchURL) => {
    const newOffers = await fetchOffers(olxSearchURL);
    const changes = getChanges(newOffers);
    const messages = formatMessages(changes, newOffers);

    for (const message of messages) {
        await sendDiscordMessage(webhookURL, message);
    }
};

const webhookURL = process.argv[2];
const olxSearchURL = process.argv[3];

if (!webhookURL || !olxSearchURL) {
    console.error("Usage: node index.js <discordWebhookURL> <olxSearchURL>");
    process.exit(1);
}

// Initial run
main(webhookURL, olxSearchURL);

// Schedule every 5 minutes
setInterval(() => main(webhookURL, olxSearchURL), 5 * 60 * 1000);

