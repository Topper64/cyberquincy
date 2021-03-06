const GoogleSheetsHelper = require('../helpers/google-sheets.js');

const OrParser = require('../parser/or-parser.js');
const OptionalParser = require('../parser/optional-parser.js');

const MapParser = require('../parser/map-parser.js');
const NaturalNumberParser = require('../parser/natural-number-parser.js');
const TowerUpgradeParser = require('../parser/tower-upgrade-parser.js');
const HeroParser = require('../parser/hero-parser.js');
const AnyOrderParser = require('../parser/any-order-parser.js');

const UserCommandError = require('../exceptions/user-command-error.js');

HEAVY_CHECK_MARK = String.fromCharCode(10004) + String.fromCharCode(65039);
WHITE_HEAVY_CHECK_MARK = String.fromCharCode(9989);

const OG_COLS = {
    NUMBER: 'B',
    TOWER_1: 'C',
    TOWER_2: 'E',
    UPGRADES: 'G',
    MAP: 'I',
    VERSION: 'K',
    DATE: 'L',
    PERSON: 'M',
    LINK: 'O',
    CURRENT: 'P',
};

const ALT_COLS = {
    NUMBER: 'R',
    MAP: 'S',
    PERSON: 'U',
    LINK: 'W',
};

module.exports = {
    name: '2tc',
    dependencies: ['btd6index'],

    execute(message, args) {
        if (args.length == 0 || (args.length == 1 && args[0] == 'help')) {
            return module.exports.helpMessage(message);
        }

        (towerOrHeroParser = new OrParser(
            new TowerUpgradeParser(),
            new HeroParser()
        )),
            (parsers = [
                // Which 2TC's have been done on this map?
                new MapParser(),
                // Get 2TC by combo number, optionally on the specified map
                new AnyOrderParser(
                    new NaturalNumberParser(),
                    new OptionalParser(new MapParser())
                ),
                // Get 2TCs containing tower (optionally both towers), optionally on the specified map
                new AnyOrderParser(
                    towerOrHeroParser,
                    new OptionalParser(towerOrHeroParser),
                    new OptionalParser(new MapParser())
                ),
            ]);

        const parsed = CommandParser.parse(args, new OrParser(...parsers));

        if (parsed.hasErrors()) {
            return module.exports.errorMessage(message, parsed.parsingErrors);
        }

        if (parsed.natural_number) {
            // Combo # provided
            if (parsed.map) {
                // and map specified
                return displayAlt2TCFromN(
                    message,
                    parsed.natural_number,
                    parsed.map
                ).catch((e) => err(e, message));
            } else {
                // and map NOT specified
                // OG completion
                return displayOG2TCFromN(
                    message,
                    parsed.natural_number
                ).catch((e) => err(e, message));
            }
        } else if (parsed.hero || parsed.tower_upgrade) {
            // Tower(s) specified
            towers = null;
            try {
                towers = normalizeTowers(parsed.tower_upgrades, parsed.heroes);
            } catch (e) {
                return err(e, message);
            }

            if (towers.length == 1) {
                // 1 tower provided
                return message.channel.send(
                    `Multiple-combo searching coming soon`
                );
            } else {
                // 2 towers provided
                if (parsed.map) {
                    return displayAlt2TCFromTowers(
                        message,
                        towers,
                        parsed.map
                    ).catch((e) => err(e, message));
                } else {
                    return displayOG2TCFromTowers(message, towers).catch((e) =>
                        err(e, message)
                    );
                }
            }
        } else {
            return message.channel.send('Multiple-combo searching coming soon');
        }
    },

    helpMessage(message) {
        let helpEmbed = new Discord.MessageEmbed()
            .setTitle('`q!2tc` HELP')
            .addField(
                '`q!2tc <n>`',
                'Get the nth combo on the OG map\n`q!2tc 44`'
            )
            .addField(
                '`q!2tc <n> <map>`',
                'Get the nth combo on the specified map\n`q!2tc 44 frozen_over`'
            )
            .addField(
                '`q!2tc <tower_upgrade/hero> <tower_upgrade/hero>`',
                'Get a combo by the towers involved on the OG map\n`q!2tc obyn dch`'
            )
            .addField(
                '`q!2tc <tower_upgrade/hero> <tower_upgrade/hero> <map>`',
                'Get a combo by the towers involved on the specified map\n`q!2tc obyn dch cube`'
            );

        return message.channel.send(helpEmbed);
    },

    errorMessage(message, parsingErrors) {
        let errorEmbed = new Discord.MessageEmbed()
            .setTitle('ERROR')
            .addField(
                'Likely Cause(s)',
                parsingErrors.map((msg) => ` • ${msg}`).join('\n')
            )
            .addField('Type `q!2tc` for help', '\u200b')
            .setColor(colours['orange']);

        return message.channel.send(errorEmbed);
    },
};

function err(e, message) {
    if (e instanceof UserCommandError) {
        return module.exports.errorMessage(message, [e.message]);
    } else {
        throw e;
    }
}

function normalizeTowers(tower_upgrades, heroes) {
    if (heroes && heroes.length == 2) {
        throw new UserCommandError(`Can't have a 2TC with 2 heroes`);
    }

    tower_upgrades = tower_upgrades
        ? tower_upgrades.map((tu) => Aliases.towerUpgradeToIndexNormalForm(tu))
        : [];
    heroes = heroes ? heroes.map((hr) => h.toTitleCase(hr)) : [];
    return heroes.concat(tower_upgrades);
}

async function numCombos() {
    const sheet = GoogleSheetsHelper.sheetByName(Btd6Index, '2tc');
    await sheet.loadCells(`J6`);
    return sheet.getCellByA1('J6').value;
}

function embed2TC(message, values, title, footer) {
    // Embed and send the message
    var challengeEmbed = new Discord.MessageEmbed()
        .setTitle(title)
        .setColor(colours['cyber']);

    for (field in values) {
        challengeEmbed = challengeEmbed.addField(
            h.toTitleCase(field.replace('_', ' ')),
            values[field],
            true
        );
    }

    if (footer) {
        challengeEmbed.setFooter(footer);
    }

    message.channel.send(challengeEmbed);
}

////////////////////////////////////////////////////////////
// OG Combos
////////////////////////////////////////////////////////////

async function getOG2TCFromRow(row) {
    const sheet = GoogleSheetsHelper.sheetByName(Btd6Index, '2tc');

    await sheet.loadCells(`${OG_COLS.NUMBER}${row}:${OG_COLS.CURRENT}${row}`);

    // Assign each value to be discord-embedded in a simple default way
    let values = {};
    for (key in OG_COLS) {
        values[key] = sheet.getCellByA1(`${OG_COLS[key]}${row}`).value;
    }

    const upgrades = values.UPGRADES.split('|').map((u) =>
        u.replace(/^\s+|\s+$/g, '')
    );
    for (var i = 0; i < upgrades.length; i++) {
        // Display upgrade next to tower
        values[`TOWER_${i + 1}`] += ' (' + upgrades[i] + ')';
    }
    delete values.UPGRADES; // Don't display upgrades on their own, display with towers

    // Recapture date to format properly
    values.DATE = sheet.getCellByA1(`${OG_COLS.DATE}${row}`).formattedValue;

    // Recapture link to format properly
    const linkCell = sheet.getCellByA1(`${OG_COLS.LINK}${row}`);
    values.LINK = `[${linkCell.value}](${linkCell.hyperlink})`;

    // Replace checkmark that doesn't display in embedded with one that does
    if (values.CURRENT === HEAVY_CHECK_MARK) {
        values.CURRENT = WHITE_HEAVY_CHECK_MARK;
    }

    return values;
}

////////////////
// N
////////////////

async function displayOG2TCFromN(message, n) {
    row = await getOGRowFromN(n);
    data = await getOG2TCFromRow(row);
    delete data.NUMBER;
    embed2TC(message, data, `2TC Combo #${n}`);
}

async function getOGRowFromN(n) {
    nCombos = await numCombos();
    if (n > nCombos) {
        throw new UserCommandError(
            `You asked for the ${h.toOrdinalSuffix(
                n
            )} combo but there are only ${nCombos} listed.`
        );
    }

    return n + (await findOGRowOffset());
}

async function findOGRowOffset() {
    const sheet = GoogleSheetsHelper.sheetByName(Btd6Index, '2tc');

    const MIN_OFFSET = 1;
    const MAX_OFFSET = 20;

    await sheet.loadCells(
        `${OG_COLS.NUMBER}${MIN_OFFSET}:${OG_COLS.NUMBER}${MAX_OFFSET}`
    );

    for (var row = MIN_OFFSET; row <= MAX_OFFSET; row++) {
        cellValue = sheet.getCellByA1(`B${row}`).value;
        if (cellValue) {
            if (cellValue.toLowerCase().includes('number')) {
                return row;
            }
        }
    }

    throw `Cannot find 2TC header "Number" to orient combo searching`;
}

////////////////
// Towers
////////////////

async function displayOG2TCFromTowers(message, towers) {
    row = await getOGRowFromTowers(towers);
    data = await getOG2TCFromRow(row);

    // Recollect towers in tower# order and with upgrades
    towers = [data.TOWER_1, data.TOWER_2];

    // Don't include tower info in embedded, only in title
    delete data.TOWER_1;
    delete data.TOWER_2;

    embed2TC(message, data, `2TC Combo: ${towers.join(' + ')}`);
}

async function getOGRowFromTowers(towers) {
    const sheet = GoogleSheetsHelper.sheetByName(Btd6Index, '2tc');

    startRow = (await findOGRowOffset(sheet)) + 1;
    endRow = startRow + (await numCombos()) - 1;

    await sheet.loadCells(
        `${OG_COLS.TOWER_1}${startRow}:${OG_COLS.TOWER_2}${endRow}`
    );

    for (var row = startRow; row <= endRow; row++) {
        candidateTowers = [];
        candidateTowers.push(
            sheet.getCellByA1(`${OG_COLS.TOWER_1}${row}`).value
        );
        candidateTowers.push(
            sheet.getCellByA1(`${OG_COLS.TOWER_2}${row}`).value
        );

        if (
            h.arraysEqual(
                towers.map((t) => t.toLowerCase()),
                candidateTowers.map((t) => t.toLowerCase())
            )
        ) {
            return row;
        }
    }
    throw new UserCommandError(`${towers.join(' + ')} isn't a 2TC yet.`);
}

////////////////////////////////////////////////////////////
// Alt Combos
////////////////////////////////////////////////////////////

async function getAlt2TCFromNAndMap(n, map) {
    const sheet = GoogleSheetsHelper.sheetByName(Btd6Index, '2tc');

    START_ROW = 12;
    END_ROW = sheet.rowCount;

    await sheet.loadCells(
        `${ALT_COLS.NUMBER}${START_ROW}:${ALT_COLS.MAP}${END_ROW}`
    );

    // Will be true towards the end of a below iteration if the alt row
    // being examined corresponds to the queried combo (whether by combo # or towers).
    let nActive = -1;
    for (var row = START_ROW; row <= END_ROW; row++) {
        let mapCandidate = sheet.getCellByA1(`${ALT_COLS.MAP}${row}`).value;
        // End condition
        if (!mapCandidate) {
            throw new UserCommandError(
                `Combo #${n} exists but doesn't have an alt map on ${map}`
            );
        }

        let numberCandidate = sheet.getCellByA1(`${ALT_COLS.NUMBER}${row}`)
            .value;
        if (numberCandidate) {
            nActive = parseInt(numberCandidate.match(/\d+.*?/)[0]);

            // If previous alt map rows were based off the correct combo number,
            // reaching a new combo number means that there wasn't a match with the queried map
            if (nActive > n) {
                throw new UserCommandError(
                    `Combo #${n} exists but doesn't have an alt map on ${map}`
                );
            }
        }

        // If combo number and map match up
        if (nActive == n && mapCandidate == Aliases.toIndexNormalForm(map)) {
            // Load the three unique data cells in the current alt combo row
            await sheet.loadCells(
                `${ALT_COLS.MAP}${row}:${ALT_COLS.LINK}${row}`
            );

            let values = {};
            values.MAP = map;
            values.PERSON = sheet.getCellByA1(`${ALT_COLS.PERSON}${row}`).value;

            // Format link properly
            const linkCell = sheet.getCellByA1(`${ALT_COLS.LINK}${row}`);
            values.LINK = `[${linkCell.value}](${linkCell.hyperlink})`;

            return values;
        }
    }
}

////////////////
// N
////////////////

async function displayAlt2TCFromN(message, n, map) {
    const ogRow = await getOGRowFromN(n);
    const og2TCData = await getOG2TCFromRow(ogRow);

    data = null;
    embedFooter = null;

    if (og2TCData.MAP == Aliases.toIndexNormalForm(map)) {
        data = og2TCData;
        embedFooter =
            'This is the OG map completion. Enter the same query without the map to see more info.';
    } else {
        const alt2TCData = await getAlt2TCFromNAndMap(parseInt(n), map);

        // Combine the data between OG and ALT, override shared data with the alt entry
        data = {
            ...og2TCData,
            ...alt2TCData,
        };
    }

    // Exclude irrelevant information from OG towers lookup and embed title
    delete data.NUMBER;
    delete data.MAP;
    delete data.VERSION;
    delete data.DATE;
    delete data.CURRENT;

    embed2TC(
        message,
        data,
        `2TC Combo #${n} on ${Aliases.toIndexNormalForm(map)}`,
        embedFooter
    );
}

////////////////
// Towers
////////////////

async function displayAlt2TCFromTowers(message, towers, map) {
    const ogRow = await getOGRowFromTowers(towers);
    const og2TCData = await getOG2TCFromRow(ogRow);

    data = null;
    embedFooter = null;

    // Stick with OG data if the map being queried is the OG map
    if (og2TCData.MAP == Aliases.toIndexNormalForm(map)) {
        data = og2TCData;
        embedFooter =
            'This is the OG map completion. Enter the same query without the map to see more info.';
    } else {
        // Otherwise, stick to the plan of parsing the alt maps table
        const alt2TCData = await getAlt2TCFromNAndMap(
            parseInt(og2TCData.NUMBER),
            map
        );

        // Combine the data between OG and ALT, override shared data with the alt entry
        data = {
            ...og2TCData,
            ...alt2TCData,
        };
    }

    // Recollect towers in tower# order and with upgrades
    towers = [data.TOWER_1, data.TOWER_2];

    // Exclude irrelevant information from OG towers lookup and embed title
    delete data.TOWER_1;
    delete data.TOWER_2;
    delete data.MAP;
    delete data.VERSION;
    delete data.DATE;
    delete data.CURRENT;
    data.NUMBER = data.NUMBER.replace('*', '');

    embed2TC(
        message,
        data,
        `2TC Combo on ${Aliases.toIndexNormalForm(map)}: ${towers.join(' + ')}`,
        embedFooter
    );
}
