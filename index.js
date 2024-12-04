const dotenv = require('dotenv');
dotenv.config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Partials, ChannelType, TextChannel } = require('discord.js');

// Load configuration
const configPath = path.join(__dirname, 'config.json');
const sentMessageIDsPath = path.join(__dirname, 'sentMessageIDs.json');
const postedMessagesPath = path.join(__dirname, 'postedMessages.json');
const gameSchedulePath = path.join(__dirname, 'game_schedule.json');

let config;
let WEEKDAY_MESSAGES = [];
let sentMessageIDs = new Set();
let postedMessageIDs = new Set();
let gameSchedule = {};

try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    gameSchedule = JSON.parse(fs.readFileSync(gameSchedulePath, 'utf8'));

    // Generate and sort messages with dates
    WEEKDAY_MESSAGES = generateAndSortMessagesWithDates();

    // Load sent message IDs from file
    if (fs.existsSync(sentMessageIDsPath)) {
        const data = JSON.parse(fs.readFileSync(sentMessageIDsPath, 'utf8'));
        sentMessageIDs = new Set(data);
    }

    // Load posted messages from file
    if (fs.existsSync(postedMessagesPath)) {
        const data = JSON.parse(fs.readFileSync(postedMessagesPath, 'utf8'));
        postedMessageIDs = new Set(data);
    }
} catch (error) {
    console.error('Error reading configuration files:', error);
    process.exit(1);
}

const YOUR_USER_ID = config.userID;
const CHANNEL_ID = config.channelID;
const CHANNEL_ID_MAIN = config.channelIDmain;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions
    ],
    partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction
    ],
});

// Function to get the date of a specific weekday
function getDateOfWeekday(dayOffset) {
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

    // Calculate the date for the target weekday
    const targetDay = (dayOffset + 1) % 7; // +1 to start from Monday as day 0
    const daysUntilTarget = (targetDay - currentDay + 7) % 7;
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + daysUntilTarget);
    return targetDate; // Return the Date object
}

// Function to format date as "D.M" without year
function formatDateSimple(date) {
    const day = date.getDate();
    const month = date.getMonth() + 1; // Months are 0-indexed
    return `${day}.${month}`;
}

// Function to generate and sort messages with dates
function generateAndSortMessagesWithDates() {
    const weekDays = [
        "Maanantai", // Monday
        "Tiistai", // Tuesday
        "Keskiviikko", // Wednesday
        "Torstai", // Thursday
        "Perjantai", // Friday
        "Lauantai", // Saturday
        "Sunnuntai" // Sunday
    ];

    // Generate messages with dates
    const messagesWithDates = weekDays.map((day, index) => {
        const date = getDateOfWeekday(index);
        return {
            content: `${day} ${formatDateSimple(date)} 21:00`,
            date
        };
    });

    // Sort messages by date, closest to today first
    messagesWithDates.sort((a, b) => a.date - b.date);

    return messagesWithDates;
}

// Function to check if the current time is past 9 PM
function isPast9PM() {
    const now = new Date();
    return now.getHours() >= 21; // 21:00 is 9 PM
}

// Function to check if there is a game on the given date
function getGameMessageForDate(date) {
    const formattedDate = formatDateSimple(date);

    for (const gameKey in gameSchedule) {
        const game = gameSchedule[gameKey];
        let original = game.date
        let result = original.substr(original.indexOf(" ") + 1);
        result = result.substring(0, result.length - 1);
        console.log(`Length of result: ${result.length}`);
        console.log(`Length of formatted: ${formattedDate.length}`);
        console.log("formatted", formattedDate)
        console.log("result", result)
        

        if (result === formattedDate) {
            console.log("on sama -------------------------------------------------------")
            return `---${game.date} ${game.time}: ${game.game} EI SCRIMEJÄ, GAME DAY`;
        }
    }

    return null;
}

// Function to post messages for each weekday or game day in the specified channel
async function postWeekdayMessages() {
    const channel = client.channels.cache.get(CHANNEL_ID);

    if (channel) {
        // Generate and sort messages with dates
        const WEEKDAY_MESSAGES = generateAndSortMessagesWithDates();

        // If current time is past 9 PM, adjust the first message
        if (isPast9PM()) {
            const firstMessage = WEEKDAY_MESSAGES.shift(); // Remove the first message
            // Adjust the date by adding 7 days
            firstMessage.date.setDate(firstMessage.date.getDate() + 7);
            // Re-format the message with the new date
            firstMessage.content = `${firstMessage.content.split(' ')[0]} ${formatDateSimple(firstMessage.date)} 21:00`;
            // Add the adjusted message to the end of the list
            WEEKDAY_MESSAGES.push(firstMessage);
        }

        // Post the messages
        for (const message of WEEKDAY_MESSAGES) {
            const { date } = message;
            const gameMessage = getGameMessageForDate(date);

            if (gameMessage) {
                // Post the game message instead of the weekday message
                if (!postedMessageIDs.has(gameMessage)) {
                    try {
                        const msg = await channel.send(gameMessage);
                        postedMessageIDs.add(msg.id); // Track the message ID
                        await msg.react('👍'); // Add an initial thumbs up reaction
                        await msg.react('👎'); // Add an initial thumbs down reaction

                        // Save the posted message IDs to the file
                        fs.writeFileSync(postedMessagesPath, JSON.stringify([...postedMessageIDs]));
                        console.log(`Posted and tracked game message ID: ${msg.id}`);
                    } catch (error) {
                        console.error('Error posting game message:', error);
                    }
                } else {
                    console.log(`Game message already posted: ${gameMessage}`);
                }
            } else {
                // Post the regular weekday message
                const { content } = message;
                if (!postedMessageIDs.has(content)) {
                    try {
                        const msg = await channel.send(content);
                        postedMessageIDs.add(msg.id); // Track the message ID
                        await msg.react('👍'); // Add an initial thumbs up reaction
                        await msg.react('👎'); // Add an initial thumbs down reaction

                        // Save the posted message IDs to the file
                        fs.writeFileSync(postedMessagesPath, JSON.stringify([...postedMessageIDs]));
                        console.log(`Posted and tracked weekday message ID: ${msg.id}`);
                    } catch (error) {
                        console.error('Error posting weekday message:', error);
                    }
                } else {
                    console.log(`Weekday message already posted: ${content}`);
                }
            }
        }

        // Send @everyone mention after posting all messages
        try {
            await channel.send('Viikon scrimit @everyone');
            console.log('Sent @everyone mention.');
        } catch (error) {
            console.error('Error sending @everyone mention:', error);
        }
    } else {
        console.error('Channel not found!');
    }
}


client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    // Execute message posting logic on startup
});


client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;

    // Ensure the reaction is fully cached
    if (reaction.partial) {
        try {
            await reaction.fetch();
        } catch (error) {
            console.error('Error fetching reaction:', error);
            return;
        }
    }

    // Check if the reacted message is a game day message
    const messageContent = reaction.message.content;
    const isGameDayMessage = messageContent.includes('EI SCRIMEJÄ, GAME DAY');

    // If it's a game day message, do nothing
    if (isGameDayMessage) {
        console.log('Reaction ignored for game day message.');
        return;
    }

    // Check for thumbs up reactions
    if (reaction.emoji.name === '👍' && reaction.count >= 6) {
        // Fetch the full message if it's not already cached
        if (reaction.message.partial) {
            try {
                await reaction.message.fetch();
            } catch (error) {
                console.error('Error fetching message:', error);
                return;
            }
        }

        const messageID = reaction.message.id;

        // Check if this message ID has already been sent privately
        if (!sentMessageIDs.has(messageID)) {
            try {
                const user = await client.users.fetch(YOUR_USER_ID); // Fetch the user object
                const dmMessage = await user.send(reaction.message.content); // Send the message content
                
                // Add check mark reaction to the DM message
                await dmMessage.react('✅');
                
                console.log('Sent DM with message content and added check mark reaction.');

                // Add message ID to sent messages set and save to file
                sentMessageIDs.add(messageID);
                fs.writeFileSync(sentMessageIDsPath, JSON.stringify([...sentMessageIDs]));
            } catch (error) {
                console.error('Error sending DM or adding reaction:', error);
            }
        } else {
            console.log('Message ID already sent in DM.');
        }
    }

    // Check for check mark reactions
    if (reaction.emoji.name === '✅') {
        // Fetch the full message if it's not already cached
        if (reaction.message.partial) {
            try {
                await reaction.message.fetch();
            } catch (error) {
                console.error('Error fetching message:', error);
                return;
            }
        }

        // Send the message content to the channel if the reaction was added to a message sent by the bot
        if (reaction.message.author.id === client.user.id) {
            try {
                const channel = client.channels.cache.get(CHANNEL_ID);
                if (channel) {
                    await channel.send(`Scrimit bookattu ajalle ${reaction.message.content} @everyone`);
                    console.log('Sent message content to channel.');
                } else {
                    console.error('Channel not found!');
                }
            } catch (error) {
                console.error('Error sending message content to channel:', error);
            }
        }
    }

    // Check for thumbs down reactions
    if (reaction.emoji.name === '👎' && reaction.count >= 2) {
        // Fetch the full message if it's not already cached
        if (reaction.message.partial) {
            try {
                await reaction.message.fetch();
            } catch (error) {
                console.error('Error fetching message:', error);
                return;
            }
        }

        // Delete the message
        try {
            console.log(`Voted down message: ${reaction.message}`);
            await reaction.message.delete();
            console.log('Message deleted due to thumbs down reactions.');
            // Remove the deleted message ID from the set
            postedMessageIDs.delete(reaction.message.id);
            // Save the updated message IDs to the file
            fs.writeFileSync(postedMessagesPath, JSON.stringify([...postedMessageIDs]));
            console.log(`Updated posted messages after deletion. ID removed: ${reaction.message.id}`);
        } catch (error) {
            console.error('Error deleting message:', error);
        }
    }
});


// Handle "scrimit" command and private messages
client.on('messageCreate', async (message) => {
    if (message.author.bot) return; // Ignore bot messages

    // Check if the message was sent in the specified channel and is the "scrimit" command
    if (message.channel.id === CHANNEL_ID_MAIN && message.content.trim().toLowerCase() === '!scrimit') {
        console.log('Scrimit command detected.');
        // Clear posted message IDs for a fresh start
        postedMessageIDs.clear();
        fs.writeFileSync(postedMessagesPath, JSON.stringify([...postedMessageIDs]));
        // Re-run the message posting logic
        postWeekdayMessages();
        return;
    }

    // Handle the "pelit" command
    if (message.channel.id === CHANNEL_ID_MAIN && message.content.trim().toLowerCase() === '!pelit') {
        console.log('Pelit command detected.');
        // Clear the channel and then post the game schedule
        await clearChannelMessages('1269412897382203402');
        postGameSchedule();
        return;
    }

    // Handle private messages or clear command in DMs
    if (message.channel.type === ChannelType.DM || message.channel.type === ChannelType.GuildText) {
        console.log(`Received message: ${message.content}`);

        if (message.content.trim().toLowerCase() === '!clear') {
            console.log('Clear command detected.');

            try {
                // Define the channel ID you want to clear
                const channelIDToClear = '1268698607247163525'; // Replace with the channel ID to clear

                // Fetch the channel
                const channel = await client.channels.fetch(channelIDToClear);

                if (channel instanceof TextChannel) {
                    // Fetch messages in the channel
                    const messages = await channel.messages.fetch({ limit: 100 }); // Adjust the limit as needed

                    // Filter out messages from the bot itself
                    const botMessages = messages.filter(msg => msg.author.id === client.user.id);

                    // Delete bot messages
                    await Promise.all(botMessages.map(msg => msg.delete()));
                    console.log('Cleared all previous messages from the specified channel.');
                } else {
                    console.error('Channel not found or is not a text channel.');
                }
            } catch (error) {
                console.error('Error clearing messages from channel:', error);
            }
        }
    }
});

// Function to clear all messages in the specified channel
async function clearChannelMessages(channelId) {
    const channel = client.channels.cache.get(channelId);

    if (channel instanceof TextChannel) {
        try {
            let fetched;
            do {
                fetched = await channel.messages.fetch({ limit: 100 }); // Fetch up to 100 messages
                await channel.bulkDelete(fetched);
            } while (fetched.size >= 2); // Keep fetching and deleting until less than 2 messages are fetched
            console.log(`Cleared all messages from channel ${channelId}.`);
        } catch (error) {
            console.error('Error clearing messages from channel:', error);
        }
    } else {
        console.error('Channel not found or is not a text channel.');
    }
}

// Function to post the game schedule
async function postGameSchedule() {
    const channel = client.channels.cache.get('1269412897382203402'); // The channel to post the games

    if (channel) {
        for (const gameKey in gameSchedule) {
            const game = gameSchedule[gameKey];
            const message = `Game on ${game.date} at ${game.time}: ${game.game}`;
            try {
                const msg = await channel.send(message);
                postedMessageIDs.add(msg.id); // Track the message ID
                console.log(`Posted game message ID: ${msg.id}`);
            } catch (error) {
                console.error('Error posting game message:', error);
            }
        }
    } else {
        console.error('Channel not found!');
    }
}

client.login(process.env.DISCORD_TOKEN);


