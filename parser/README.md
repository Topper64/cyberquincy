# Parsing

## Table of Contents

-   [For Command Developers](#command-devs)
    -   [Introduction](#introduction)
    -   [Utilization Techniques](#utilization)
    -   [The Above in Simple Terms](#simplified)
    -   [Parser Library Glimpse](#parser-library)
    -   [Parser Structure](#parser-class)

<a name="command-devs"></a>

## For Command Developers

<a name="introduction"></a>

#### Introduction

The cyberquincy parsing library is robust and thorough. It's highly recommended that all new commands use it.

The command parser serves a number of advantages

-   It makes you think carefully about what values each argument in the command expects
-   It makes it quite easy to accept arguments in any order
-   It allows you to make certain command arguments optional and provide a default value if the user doesn't provide a matching argument
-   It provides validations based on the permitted values that get passed into the parser's constructor
-   A user who structures a command + arguments incorrectly will be provided the smallest and most helpful set of error messages in order to understand what went wrong.

<a name="utilization"></a>

#### Utilization techniques

**Example Usage**

```js
try {
    parsed = CommandParser.parseAnyOrder(
        args,
        new OptionalParser(
            new ModeParser('CHIMPS', 'ABR', 'HALFCASH'),
            'CHIMPS' // default if not provided
        ),
        new RoundParser('IMPOPPABLE')
    );

    return message.channel.send(chincomeMessage(parsed.mode, parsed.round));
} catch (e) {
    if (e instanceof ParsingError) {
        module.exports.errorMessage(message, e);
    } else {
        throw e;
    }
}
```

The following parser usage guidelines will reference the above example.

**Requirements**

1. Must either call `.parse()` or `.parseAnyOrder()` on the global `CommandParser` module.
2. Arguments must be `args, Parser1, Parser2, ... ParserN`
3. The default value for `OptionalParser` must be a value that the wrapped parser would accept as an argument.

**Options**

1. `OptionalParser`: delegates parsing to the constructor's _first_ argument (which must be a parser). If the delegate parser succeeds, the `OptionalParser` will return that parsed value; otherwise it will return the default value that gets passed into the `OptionalParser` constructor's _second_ argument.
2. Call `CommandParser.parse()` to lock down the ordering in which discord users must provide the command arguments . Call `CommandParser.parseAnyOrder()` to allow any ordering of the arguments.
3. The returned value is a `Parsed` object, which is just an enhanced Object. It's accessor keys are based on the `types()`s of the parsers used.
   i. The key that gets added to `parsed` for an `OptionalParser` is the wrapped parser's `type()`. In the above example, that would be `mode`.
4. `Parsed` also keeps pluralized versions of each parser's `type()`. In the above example, that would be `rounds` and (optionally) `modes`. This should be used if something like 2 `RoundParser`s are supplied, in which case `pased.round` will remain the first round that was parsed while `parsed.rounds` will be a(n unordered) list of all `RoundParser` results.

**Recommendations**

1. Catch HELP arguments before parsing. Parsing will likely fail if you try to do so after.
2. If `parseAnyOrder()` is used with `OptionalParser`s, play around with the ordering of the parsers to consistently get the best error messages for incorrect inputs. It's likely that putting the optional parsers at the end will produce the best error messages, but not much testing on that has been done.
3. Use `try-catch` as done so in the above example:

    i. Catch a `ParsingError` and provide the user with the list of errors encountered by the `CommandParser`: `parsingError.parsingErrors.join('\n')`

    ii. Bubble up any other type of error

<a name="simplified"></a>

#### The Above in Simpler Terms

So you know how commands can take a long list of arguments? It's in the array `args`. The parser basically helps to parse all that raw user input.

First you define a variable. In the example above its called `parsed`. You let that either be a `CommandParser.parse()` or `CommandParser.parseAnyOrder()`.

You first put `args` inside the function. Then you put in your parsers. How? Lets say you want an optional parser for a mode, e.g. like in `q!income`, you don't need a mode, but the mode matters. you then put in `new OptionalParser()` into the function.

The function should look something like this:

```js
let parsed = CommandParser.parseAnyOrder(args, new OptionalParser());
```

In the new `OptionalParser()` it accepts 2 things, a parser and a "fallback option". So for example

```js
new OptionalParser(new ModeParser('CHIMPS', 'ABR', 'HALFCASH'), 'CHIMPS');
```

means that this `OptionalParser()` has `ModeParser()` as its parser, and if the parser can't find that mode, it resorts to the second input, in this case `'CHIMPS'`.
We can add more parsers inside the `parseAnyOrder()` function. In this case we would like to know the round (compulsory), so we add `newRoundParser('IMPOPPABLE')`. What this does is check whether the round provided fits into the impoppable gamemode criteria, i.e. whether or not `6<=round<=100`

So far, it should look something like this:

```js
parsed = CommandParser.parseAnyOrder(
    args,
    new OptionalParser(new ModeParser('CHIMPS', 'ABR', 'HALFCASH'), 'CHIMPS'),
    new RoundParser('IMPOPPABLE')
);
```

that is essentially it. There is just a few more steps:

1. add a `try{}` and `catch{}` code blocks:

```js
try {
    parsed = CommandParser.parseAnyOrder(
        args,
        new OptionalParser(
            new ModeParser('CHIMPS', 'ABR', 'HALFCASH'),
            'CHIMPS'
        ),
        new RoundParser('IMPOPPABLE')
    );
} catch (e) {}
```

2. add a form of error message for `ParsingError`s specifically

```js
try {
    parsed = CommandParser.parseAnyOrder(
        args,
        new OptionalParser(
            new ModeParser('CHIMPS', 'ABR', 'HALFCASH'),
            'CHIMPS'
        ),
        new RoundParser('IMPOPPABLE')
    );
} catch (e) {
    if (e instanceof ParsingError) {
        module.exports.errorMessage(message, e);
    } else {
        throw e;
    }
}
```

You can access the mode inputted by using `parsed.mode` like this:

```js
try {
    parsed = CommandParser.parseAnyOrder(
        args,
        new OptionalParser(
            new ModeParser('CHIMPS', 'ABR', 'HALFCASH'),
            'CHIMPS'
        ),
        new RoundParser('IMPOPPABLE')
    );

    return message.channel.send(
        `mode inputted is ${parsed.mode}, round inputted is ${parsed.round}`
    );
} catch (e) {
    if (e instanceof ParsingError) {
        module.exports.errorMessage(message, e);
    } else {
        throw e;
    }
}
```

and that's it! You've not only ensured that the commands you run are "safe", but you've also given the user opportunities to learn from entering incorrectly-formatted commands!

<a name="parser-library"></a>

### Parser Library Glimpse

<table>
    <thead>
        <tr>
            <th>Parser</th>
            <th>Description</th>
            <th>Developer Inputs</th>
            <th>User Inputs</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><code>RoundParser</code></td>
            <td>Utilizes <code>NaturalNumberParser</code> to parse a round number, limited by the difficulty (<code>IMPOPPABLE</code> --> <code>6-100</code>).</td>
            <td>"IMPOPPABLE", "HARD", "MEDIUM", "EASY"</td>
            <td>Formats: <code>15</code>, <code>R15</code>, <code>round15</code></td>
        </tr>
        <tr>
            <td><code>NaturalNumberParser</code></td>
            <td>Parses a positive integer between <code>low</code> and <code>high</code></td>
            <td><code>(6, 100)</code>, <code>(-Infinity, 0)</code>, ...</td>
            <td>1, 2, 3, ..., 1000, ..., <code>Infinity</code></td>
        </tr>
        <tr>
            <td><code>ModeParser</code></td>
            <td>Parses a Btd6 Gamemode</td>
            <td>"STANDARD","PRIMARYONLY","DEFLATION","MILITARYONLY",
            "APOPALYPSE","REVERSE","MAGICONLY","DOUBLEHP","HALFCASH"
            ,"ABR","IMPOPPABLE","CHIMPS"</td>
            <td><-- Same</td>
        </tr>
    </tbody>
    <tfoot>
        <tr>
            <th colspan="4">Check the /parser folder (you're in it) for a full list of parsers</th>
        </tr>
    </tfoot>
</table>

<a name="parser-class"></a>

## Parser Structure

There are 2 types of parsers, logic parsers (OrParser, OptionalParser, AnyOrderParser, etc) and arg parsers (map, mode, hero, difficulty, number, round, cash, etc...) This will be talking about arg parsers because logic parsers are deep

-   example: cashParser

```js
const NumberParser = require('./number-parser.js');

// Looks for a round number, permitting natural numbers based on the difficulty provided to the constructor.
// Discord command users can provide the round in any of the following forms:
//    - 15, r15, round15
// Check the DifficultyParser for all possible difficulties that can be provided
module.exports = class CashParser {
    type() {
        return 'cash';
    }

    constructor(low = 0, high = Infinity) {
        this.delegateParser = new NumberParser(low, high);
    }

    parse(arg) {
        // Convert `$5` to just `5`
        arg = this.transformArgument(arg);
        return this.delegateParser.parse(arg);
    }

    // Parses all ways the command user could enter a round
    transformArgument(arg) {
        if (arg[0] == '$') {
            return arg.slice(1);
        } else if (/\d|\./.test(arg[0])) {
            return arg;
        } else {
            throw new UserCommandError(
                `Cash must be of form \`15\` or \`$15\` (Got \`${arg}\` instead)`
            );
        }
    }
};
```

### type()

```js
type() {
        return 'cash';
    }

```

`type()` defines the key the value is stored. In this case since you get the cash using `parsed.cash`, it returns `'cash'`

### constructor()

```js
constructor(low=0, high=Infinity) {
        this.delegateParser = new NumberParser(low, high);
    }
```

`constructor()` only defines the `this` object, common examples include `this.delegateParser`, which is the "base" parser (for example round parser is basically a number parser for examoke)

### parse()

```js
parse(arg) {
        // Convert `$5` to just `5`
        arg = this.transformArgument(arg);
        return this.delegateParser.parse(arg);
    }
```

`parse()` does the actual parsing, though it usually calls upon the `this.delegateParser`

#### Any other functions are probably just to help the parsing go smoother
