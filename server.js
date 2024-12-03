const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const dotenv = require('dotenv');

const app = express();
app.use(bodyParser.json());
dotenv.config();

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;  // Set your custom VERIFY_TOKEN
const LIBRETRANSLATE_API = "https://libretranslate.com/translate"; // Public LibreTranslate instance

// Temporary storage for user selections (use a database for real-world scenarios)
const userLanguagePreferences = {};

// Webhook verification route
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    // Verify the token sent by Facebook
    if (mode && token === VERIFY_TOKEN) {
        console.log('Webhook verified!');
        res.status(200).send(challenge);  // Respond with challenge to verify the webhook
    } else {
        console.error('Webhook verification failed. Invalid token.');
        res.sendStatus(403);  // Forbidden, token does not match
    }
});

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
            // Step 3: Translate the user's text using LibreTranslate API
            const targetLang = userLanguagePreferences[senderId].language;

            try {
                const translatedText = await translateText(userMessage, targetLang);
                sendTextMessage(senderId, `Translated text: ${translatedText}`);
                delete userLanguagePreferences[senderId]; // Reset for next interaction
            } catch (error) {
                sendTextMessage(senderId, 'Error translating text. Please try again.');
            }
        }
    }

    res.sendStatus(200);
});

// Function to send a text message to the user
const sendTextMessage = (senderId, text) => {
    const url = `https://graph.facebook.com/v12.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`;
    const messageData = { recipient: { id: senderId }, message: { text } };
    axios.post(url, messageData).catch(err => console.error('Error sending message:', err));
};

// Function to call LibreTranslate API for text translation
const translateText = async (text, targetLang) => {
    const res = await fetch(LIBRETRANSLATE_API, {
        method: "POST",
        body: JSON.stringify({
            q: text,
            source: "auto", // Automatically detect the source language
            target: targetLang,
            format: "text",
        }),
        headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
        throw new Error(`Error: ${res.statusText}`);
    }

    const data = await res.json();
    return data.translatedText; // Return the translated text
};

// Start the Express server
app.listen(3000, () => console.log('Server is running on port 3000'));
