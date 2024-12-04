const { google } = require('googleapis');
const fs = require('fs');
const cron = require('node-cron');

// Your API key here
const API_KEY = 'AIzaSyDdm-uIP9gf2KSRCa98bHoyElgMtbWQkts';

async function getSchedule() {
    const sheets = google.sheets({ version: 'v4', auth: API_KEY });
    const spreadsheetId = '1cegmZk3FRxBmzAA5-6mtz-ieGJc_eN_ksP5Y__tGk4k'; // Your spreadsheet ID
    const range = 'Runkosarja!A1:M45'; // The range you want to read from

    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range,
        });

        const rows = response.data.values;

        if (!rows || !rows.length) {
            console.log('No data found.');
            return;
        }

        // Example data processing
        const newData = {
            'Game1': { date: rows[3][1], time: rows[5][1], game: rows[5][2] },
            'Game2': { date: rows[8][1], time: rows[10][1], game: rows[10][2] },
            'Game3': { date: rows[3][6], time: rows[4][6], game: rows[4][7] },
            'Game4': { date: rows[8][11], time: rows[11][11], game: rows[11][12] },
            'Game5': { date: rows[17][1], time: rows[19][1], game: rows[19][2] },
            'Game6': { date: rows[22][6], time: rows[24][6], game: rows[24][7] },
            'Game7': { date: rows[17][11], time: rows[20][11], game: rows[20][12] },
            'Game8': { date: rows[22][11], time: rows[23][11], game: rows[23][12] },
            'Game9': { date: rows[36][1], time: rows[40][1], game: rows[40][2] }
        };

        // Check if the file exists and read the existing data
        let currentData = {};
        if (fs.existsSync('game_schedule.json')) {
            currentData = JSON.parse(fs.readFileSync('game_schedule.json', 'utf8'));
        }

        // Compare new data with current data
        const differences = getDifferences(currentData, newData);

        if (Object.keys(differences).length > 0) {
            // Save the new data to the JSON file if there are differences
            fs.writeFile('game_schedule.json', JSON.stringify(newData, null, 2), (err) => {
                if (err) throw err;
                console.log('Game schedules have been saved to game_schedule.json');
            });

            // Log the modified lines
            console.log('Modified data:', differences);
        } else {
            console.log('No changes detected. File not updated.');
        }
    } catch (err) {
        console.error('The API returned an error: ' + err);
    }
}

// Helper function to find differences between current data and new data
function getDifferences(currentData, newData) {
    const diffs = {};

    for (const key in newData) {
        if (!currentData[key] || JSON.stringify(currentData[key]) !== JSON.stringify(newData[key])) {
            diffs[key] = { 
                old: currentData[key] || 'N/A',
                new: newData[key]
            };
        }
    }

    return diffs;
}

// Run immediately on startup
getSchedule().catch(console.error);

// Schedule the task to run at 23:55 PM
cron.schedule('55 23 * * *', () => {
    console.log('Running task at 23:55');
    getSchedule().catch(console.error);
});

console.log('Task scheduled to run at 23:55.');
