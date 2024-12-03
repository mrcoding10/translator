const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const dotenv = require('dotenv');

const app = express();
app.use(bodyParser.json());
dotenv.config();

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN; // Add your verify token in the .env file
const LIBRETRANSLATE_API = 'https://libretranslate.com/translate';

// Temporary storage for user selections (use a database for real-world scenarios)
const userLanguagePreferences = {};

// Webhook verification
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    // Check if the mode and token are valid
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('Webhook verified');
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

// Webhook endpoint to handle messages
app.post('/webhook', async (req, res) => {
    const messageEvent = req.body.entry[0].messaging[0];
    const senderId = messageEvent.sender.id;

    if (messageEvent.message) {
        const userMessage = messageEvent.message.text;

        if (!userLanguagePreferences[senderId]) {
            // Step 1: Ask the user to choose a target language
            userLanguagePreferences[senderId] = { step: 'choose_language' };
            const languages = "Arabic, English, Spanish, French, German";
            sendTextMessage(senderId, `Please select a language: ${languages}`);
        } else if (userLanguagePreferences[senderId].step === 'choose_language') {
            // Step 2: Save selected language and ask for text
            const languageMap = {
                arabic: 'ar',
                english: 'en',
                spanish: 'es',
                french: 'fr',
                german: 'de',
            };
            const selectedLang = languageMap[userMessage.toLowerCase()];

            if (selectedLang) {
                userLanguagePreferences[senderId].language = selectedLang;
                userLanguagePreferences[senderId].step = 'translate';
                sendTextMessage(senderId, 'Enter the text you want to translate:');
            } else {
                sendTextMessage(senderId, 'Invalid language. Please choose again.');
            }
        } else if (userLanguagePreferences[senderId].step === 'translate') {
            // Step 3: Translate the user's text
            const targetLang = userLanguagePreferences[senderId].language;

            try {
                const response = await axios.post(LIBRETRANSLATE_API, {
                    q: userMessage,
                    source: 'auto', // Detect source language automatically
                    target: targetLang,
                });
                sendTextMessage(senderId, `Translated text: ${response.data.translatedText}`);
                delete userLanguagePreferences[senderId]; // Reset for next interaction
            } catch (error) {
                console.error(error);
                sendTextMessage(senderId, 'Error translating text. Please try again.');
            }
        }
    }

    res.sendStatus(200);
});

const sendTextMessage = (senderId, text) => {
    const url = `https://graph.facebook.com/v12.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`;
    const messageData = { recipient: { id: senderId }, message: { text } };
    axios.post(url, messageData).catch(err => console.error('Error sending message:', err));
};

app.listen(3000, () => console.log('Server is running on port 3000'));
