(function () {
  "use strict";

  const STORAGE_KEY = "nathan_agent_academy_v3";
  const DEFAULT_SUBJECT_ID = "spelling";
  const DEFAULT_YEAR_GROUP = "year-3";
  const ADULT_YEAR_GROUP = "adult";
  const DEFAULT_CHARACTER_ID = "nathan";
  const NINJA_CAPTURE_DURATION = 1.6;
  const GUIDE_BREAKUP_STATIC_MS = 880;
  const GUIDE_BREAKUP_HIDE_MS = 1240;
  const CONFINEMENT_SCENE_SECONDS = 3;
  const GAME_OVER_HOLD_SECONDS = 5;
  const CHALLENGE_DOOR_VISIBLE_METERS = 22;
  const CHALLENGE_DOOR_CLEAR_METERS = 0.2;
  const CHALLENGE_DOOR_PIXELS_PER_METER = 34;
  const PUZZLE_ROTATIONS = {
    spelling: ["text"],
    grammar: ["wires", "keycard"],
    punctuation: ["wires", "keycard"],
    maths: ["power", "keycard"],
    science: ["power", "wires"],
    history: ["keycard", "wires"],
    geography: ["wires", "power"],
    dt: ["power", "keycard"],
    computing: ["power", "wires"],
    spanish: ["text", "keycard"],
    french: ["text", "keycard"],
  };
  const PUZZLE_LABELS = {
    text: "Code Keypad",
    wires: "Wire Console",
    keycard: "Keycard Reader",
    power: "Power Reroute",
  };
  const DOOR_DETAIL_BY_MODE = {
    text: "Answer keypad waiting",
    wires: "Route the right lesson wire",
    keycard: "Load the right answer pass",
    power: "Send power through the right channel",
  };
  const WIRE_COLOR_CLASSES = ["wire-color-1", "wire-color-2", "wire-color-3", "wire-color-4"];

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (start, end, amount) => start + (end - start) * amount;
  const rand = (min, max) => min + Math.random() * (max - min);
  const choice = (items) => items[Math.floor(Math.random() * items.length)];
  const shuffle = (items) => {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }
    return copy;
  };
  const titleCase = (value) =>
    value.replace(/\b\w/g, (match) => match.toUpperCase()).replace(/-/g, " ");
  const normalizeAnswer = (value) =>
    String(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  const escapeHtml = (value) =>
    String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;",
    })[char]);

  function createLessonSet(subjectId, yearGroup, label, items) {
    return items.map((item, index) => {
      const acceptedAnswers = (item.answers || [item.answer]).map((answer) => normalizeAnswer(answer));
      return {
        id: item.id || `${subjectId}:${yearGroup}:${index}`,
        subjectId,
        yearGroup,
        label,
        title: item.title || "Unlock the security door",
        prompt: item.prompt,
        answer: item.answer || item.answers[0],
        acceptedAnswers,
        voiceText: item.voiceText || item.prompt,
        inputLabel: item.inputLabel || "Type the unlock answer",
        revealLabel: item.revealLabel || "Correct answer",
      };
    });
  }

  function createSpellingLesson(yearGroup, words) {
    return createLessonSet(
      "spelling",
      yearGroup,
      `${YEAR_NAME_BY_ID[yearGroup]} Spelling`,
      words.map((word, index) => ({
        id: `spelling:${yearGroup}:${index}:${word}`,
        title: "Unlock the spelling door",
        prompt: "Spell the code word you hear.",
        answer: word,
        voiceText: word,
        inputLabel: "Type the code word",
        revealLabel: "Correct spelling",
      }))
    );
  }

  const LESSON_SUBJECTS = [
    { id: "spelling", name: "Spelling" },
    { id: "grammar", name: "Grammar" },
    { id: "punctuation", name: "Punctuation" },
    { id: "maths", name: "Maths" },
    { id: "science", name: "Science" },
    { id: "history", name: "History" },
    { id: "geography", name: "Geography" },
    { id: "dt", name: "DT" },
    { id: "computing", name: "Computing" },
    { id: "spanish", name: "Spanish" },
    { id: "french", name: "French" },
  ];

  const YEAR_GROUPS = [
    { id: "year-1", name: "Year 1" },
    { id: "year-2", name: "Year 2" },
    { id: "year-3", name: "Year 3" },
    { id: "year-4", name: "Year 4" },
    { id: "year-5", name: "Year 5" },
    { id: "year-6", name: "Year 6" },
    { id: "year-7", name: "Year 7" },
    { id: "year-8", name: "Year 8" },
    { id: "year-9", name: "Year 9" },
    { id: "year-10", name: "Year 10" },
    { id: "year-11", name: "Year 11" },
    { id: "year-12", name: "Year 12" },
    { id: "year-13", name: "Year 13" },
    { id: ADULT_YEAR_GROUP, name: "Adult Mode" },
  ];

  const SUBJECT_NAME_BY_ID = Object.fromEntries(LESSON_SUBJECTS.map((subject) => [subject.id, subject.name]));
  const YEAR_NAME_BY_ID = Object.fromEntries(YEAR_GROUPS.map((year) => [year.id, year.name]));

  function buildSubjectBanks(subjectId, rawYears) {
    return Object.fromEntries(
      Object.entries(rawYears).map(([yearGroup, items]) => [
        yearGroup,
        createLessonSet(subjectId, yearGroup, `${YEAR_NAME_BY_ID[yearGroup]} ${SUBJECT_NAME_BY_ID[subjectId]}`, items),
      ])
    );
  }

  function mergeWordPools(baseWords, extraWords) {
    return Object.fromEntries(
      YEAR_GROUPS.map((yearGroup) => [
        yearGroup.id,
        [...(baseWords[yearGroup.id] || []), ...(extraWords[yearGroup.id] || [])],
      ])
    );
  }

  function mergeRawLessonBanks(baseBanks, extraBanks) {
    return Object.fromEntries(
      Object.keys(baseBanks).map((subjectId) => [
        subjectId,
        Object.fromEntries(
          YEAR_GROUPS.map((yearGroup) => [
            yearGroup.id,
            [...(baseBanks[subjectId]?.[yearGroup.id] || []), ...(extraBanks[subjectId]?.[yearGroup.id] || [])],
          ])
        ),
      ])
    );
  }

  function addWordPoolYears(wordPools, extraYearWords) {
    const merged = Object.fromEntries(Object.entries(wordPools).map(([yearGroup, words]) => [yearGroup, [...words]]));
    for (const [yearGroup, words] of Object.entries(extraYearWords)) {
      merged[yearGroup] = [...(merged[yearGroup] || []), ...words];
    }
    return merged;
  }

  function addLessonBankYears(baseBanks, additionalBanks) {
    const subjectIds = new Set([...Object.keys(baseBanks), ...Object.keys(additionalBanks)]);
    return Object.fromEntries(
      [...subjectIds].map((subjectId) => {
        const nextYears = Object.fromEntries(
          Object.entries(baseBanks[subjectId] || {}).map(([yearGroup, items]) => [yearGroup, [...items]])
        );

        for (const [yearGroup, items] of Object.entries(additionalBanks[subjectId] || {})) {
          nextYears[yearGroup] = [...(nextYears[yearGroup] || []), ...items];
        }

        return [subjectId, nextYears];
      })
    );
  }

  const SPELLING_WORDS = {
    "year-1": ["rain", "queen", "night", "green", "train"],
    "year-2": ["because", "after", "again", "people", "pretty"],
    "year-3": ["accident", "calendar", "favourite", "library", "sentence"],
    "year-4": ["bicycle", "different", "important", "medicine", "separate"],
    "year-5": ["bruise", "desperate", "lightning", "parliament", "profession"],
    "year-6": ["accommodate", "awkward", "conscience", "government", "necessary"],
  };

  const RAW_LESSON_BANKS = {
    grammar: {
      "year-1": [
        { prompt: "Type the noun in this sentence: The dog barked.", answer: "dog" },
        { prompt: "Type the verb in this sentence: Sam jumps high.", answer: "jumps" },
        { prompt: "Type the describing word in: a red hat.", answer: "red" },
      ],
      "year-2": [
        { prompt: "Type the verb in: The birds sing.", answer: "sing" },
        { prompt: "Type the adjective in: the shiny coin.", answer: "shiny" },
        { prompt: "Which joining word could go in the gap: I packed my bag ___ put on my coat.", answer: "and" },
      ],
      "year-3": [
        { prompt: "Type the preposition in: The cat slept under the chair.", answer: "under" },
        { prompt: "Type the adverb in: The rabbit ran quickly.", answer: "quickly" },
        { prompt: "Which conjunction could complete this sentence: Wash your hands ___ you eat.", answer: "before" },
      ],
      "year-4": [
        { prompt: "Type the pronoun in: She carried the torch.", answer: "she" },
        { prompt: "Type the determiner in: Those children cheered.", answer: "those" },
        { prompt: "Type the fronted adverbial in: Later that day, we escaped.", answers: ["later that day"] },
      ],
      "year-5": [
        { prompt: "Which modal verb could complete this sentence: I ___ help you tomorrow.", answer: "could" },
        { prompt: "Type the relative pronoun in: The coat that I wore was blue.", answer: "that" },
        { prompt: "Type the adverb in: The spy moved silently.", answer: "silently" },
      ],
      "year-6": [
        { prompt: "Type the subject in: The guard opened the gate.", answers: ["guard", "the guard"] },
        { prompt: "Type the object in: Maya kicked the ball.", answers: ["ball", "the ball"] },
        { prompt: "Which sentence sounds more formal: assist me or gimme a hand?", answers: ["assist me"] },
      ],
    },
    punctuation: {
      "year-1": [
        { prompt: "Which punctuation mark should go at the end of this sentence: We can hide", answer: "full stop", answers: ["full stop", ".", "period"] },
        { prompt: "Which punctuation mark should go at the end of this question: Are you ready", answer: "question mark", answers: ["question mark", "?"] },
        { prompt: "What kind of letter should be at the start of a sentence?", answer: "capital letter", answers: ["capital letter", "capital"] },
      ],
      "year-2": [
        { prompt: "Which punctuation mark can show excitement or surprise?", answer: "exclamation mark", answers: ["exclamation mark", "!"] },
        { prompt: "Which punctuation shows missing letters in can't?", answer: "apostrophe" },
        { prompt: "Which punctuation separates items in a list?", answer: "comma" },
      ],
      "year-3": [
        { prompt: "Which punctuation goes around the words someone says?", answer: "speech marks", answers: ["speech marks", "inverted commas"] },
        { prompt: "Which punctuation shows possession in Ben's bag?", answer: "apostrophe" },
        { prompt: "Which punctuation can separate parts of a longer sentence?", answer: "comma" },
      ],
      "year-4": [
        { prompt: "Which punctuation marks show direct speech?", answer: "speech marks", answers: ["speech marks", "inverted commas"] },
        { prompt: "Which punctuation should come after a fronted adverbial such as 'Later that day'?", answer: "comma" },
        { prompt: "Which punctuation shows the plural possessive in the girls' coats?", answer: "apostrophe" },
      ],
      "year-5": [
        { prompt: "Which punctuation could go around extra information in this sentence: The map from Spain was missing", answer: "brackets" },
        { prompt: "Which punctuation can help clarify meaning in a longer sentence?", answer: "comma" },
        { prompt: "Which punctuation can create a strong dramatic break in a sentence?", answer: "dash" },
      ],
      "year-6": [
        { prompt: "Which punctuation joins two closely related clauses?", answer: "semicolon" },
        { prompt: "Which punctuation introduces a list or explanation?", answer: "colon" },
        { prompt: "Which punctuation joins the two parts of the word re-form?", answer: "hyphen" },
      ],
    },
    maths: {
      "year-1": [
        { prompt: "What is 4 + 3?", answer: "7" },
        { prompt: "What is 10 - 6?", answer: "4" },
        { prompt: "What is one more than 8?", answer: "9" },
      ],
      "year-2": [
        { prompt: "What is 5 + 17?", answer: "22" },
        { prompt: "What is 3 x 4?", answer: "12" },
        { prompt: "What is half of 18?", answer: "9" },
      ],
      "year-3": [
        { prompt: "What is 8 x 4?", answer: "32" },
        { prompt: "What is 24 ÷ 6?", answer: "4" },
        { prompt: "What is one half of 14?", answer: "7" },
      ],
      "year-4": [
        { prompt: "What is 6 x 7?", answer: "42" },
        { prompt: "A rectangle has sides of 5 cm and 3 cm. What is the perimeter?", answers: ["16", "16 cm"] },
        { prompt: "What is three quarters of 20?", answer: "15" },
      ],
      "year-5": [
        { prompt: "What is 2.5 + 1.5?", answers: ["4", "4.0"] },
        { prompt: "What is 40% of 50?", answer: "20" },
        { prompt: "What is three fifths of 25?", answer: "15" },
      ],
      "year-6": [
        { prompt: "What is 15% of 200?", answer: "30" },
        { prompt: "The ratio is 3:1 and the total is 20. What is the bigger share?", answer: "15" },
        { prompt: "What is the mean of 6, 8 and 10?", answer: "8" },
      ],
    },
    science: {
      "year-1": [
        { prompt: "Which season comes after summer?", answer: "autumn" },
        { prompt: "Which body part do you use to smell?", answer: "nose" },
        { prompt: "Which animal group has feathers?", answers: ["bird", "birds"] },
      ],
      "year-2": [
        { prompt: "What do plants need to grow besides water?", answer: "sunlight" },
        { prompt: "Which material is see-through: glass or wood?", answer: "glass" },
        { prompt: "What is the place where an animal lives called?", answer: "habitat" },
      ],
      "year-3": [
        { prompt: "What protects your brain?", answer: "skull" },
        { prompt: "Strong sunlight can hurt your what?", answers: ["eyes", "eye"] },
        { prompt: "Igneous, sedimentary and metamorphic are types of what?", answers: ["rock", "rocks"] },
      ],
      "year-4": [
        { prompt: "A complete electrical circuit needs a what to power it?", answer: "battery" },
        { prompt: "Solid, liquid and gas are states of what?", answer: "matter" },
        { prompt: "Which organ helps break food down in digestion?", answer: "stomach" },
      ],
      "year-5": [
        { prompt: "The Earth travels around the what?", answer: "sun" },
        { prompt: "What force pulls objects down to Earth?", answer: "gravity" },
        { prompt: "What do mammals feed their babies?", answer: "milk" },
      ],
      "year-6": [
        { prompt: "What pumps blood around the body?", answer: "heart" },
        { prompt: "Evolution by natural selection is linked with who?", answer: "darwin" },
        { prompt: "Light travels in straight what?", answers: ["lines", "line"] },
      ],
    },
    history: {
      "year-1": [
        { prompt: "Is a smartphone older or newer than a castle?", answer: "newer" },
        { prompt: "Florence Nightingale helped people in a what?", answer: "hospital" },
        { prompt: "Many toys from the past were made of what?", answer: "wood" },
      ],
      "year-2": [
        { prompt: "The Great Fire of London started in a baker's what?", answer: "bakery" },
        { prompt: "Samuel Pepys wrote about the Great Fire in his what?", answer: "diary" },
        { prompt: "Mary Seacole helped soldiers as a what?", answer: "nurse" },
      ],
      "year-3": [
        { prompt: "People in the Stone Age used tools made from what?", answer: "stone" },
        { prompt: "The Bronze Age came after the what Age?", answer: "stone" },
        { prompt: "Ancient Egyptians wrote in picture symbols called what?", answers: ["hieroglyphics", "hieroglyphs"] },
      ],
      "year-4": [
        { prompt: "The Romans built straight what across Britain?", answers: ["roads", "road"] },
        { prompt: "The Vikings travelled in long what?", answers: ["ships", "longships", "ship"] },
        { prompt: "Anglo-Saxons and Vikings lived a long time ago in the what?", answer: "past" },
      ],
      "year-5": [
        { prompt: "Ancient Greece is known for the first Olympic what?", answers: ["games", "game"] },
        { prompt: "Greek myths told stories about gods and what?", answers: ["goddesses", "goddess"] },
        { prompt: "Athens and Sparta were city what?", answers: ["states", "state"] },
      ],
      "year-6": [
        { prompt: "During World War Two, many children were sent away as what?", answers: ["evacuees", "evacuee"] },
        { prompt: "The Tudors were a royal what?", answer: "family" },
        { prompt: "A person who studies the past is a what?", answer: "historian" },
      ],
    },
    geography: {
      "year-1": [
        { prompt: "What do we call a large area of salt water?", answer: "sea" },
        { prompt: "A map shows places and where they are on what? Type land or paper. Best answer: paper.", answer: "paper" },
        { prompt: "What do we call the planet we live on?", answer: "earth" },
      ],
      "year-2": [
        { prompt: "The four compass directions are north, east, south and what?", answer: "west" },
        { prompt: "A city is bigger than a what?", answer: "town" },
        { prompt: "Land surrounded by water is an what?", answers: ["island", "an island"] },
      ],
      "year-3": [
        { prompt: "A river begins at its what?", answer: "source" },
        { prompt: "The Equator is an invisible what around Earth?", answer: "line" },
        { prompt: "Mountains are higher than what?", answers: ["hills", "hill"] },
      ],
      "year-4": [
        { prompt: "Europe is a what?", answer: "continent" },
        { prompt: "Hot wet weather near the Equator is called what climate?", answer: "tropical" },
        { prompt: "Water turning into gas in the water cycle is called what?", answer: "evaporation" },
      ],
      "year-5": [
        { prompt: "A book of maps is called an what?", answer: "atlas" },
        { prompt: "The climate in Antarctica is very what?", answer: "cold" },
        { prompt: "On many maps, letters and numbers make a grid what?", answer: "reference" },
      ],
      "year-6": [
        { prompt: "A biome is a large natural what?", answers: ["habitat", "region"] },
        { prompt: "Rock and soil being worn away is called what?", answer: "erosion" },
        { prompt: "Lines that measure east and west on Earth are lines of what?", answer: "longitude" },
      ],
    },
    dt: {
      "year-1": [
        { prompt: "In DT, what do we call the thing you make?", answers: ["model", "product"] },
        { prompt: "Card and paper are what?", answer: "materials" },
        { prompt: "What tool can measure length?", answer: "ruler" },
      ],
      "year-2": [
        { prompt: "Wheels turn around an what?", answer: "axle" },
        { prompt: "Something that stays up well is what?", answers: ["strong", "stable"] },
        { prompt: "Before making, you usually draw a what?", answer: "design" },
      ],
      "year-3": [
        { prompt: "A first version of a product is a what?", answer: "prototype" },
        { prompt: "A split pin can make a moving what?", answers: ["joint", "lever"] },
        { prompt: "After making, you can write an what about what worked well?", answer: "evaluation" },
      ],
      "year-4": [
        { prompt: "A buzzer and battery are part of a what?", answer: "circuit" },
        { prompt: "Triangles can make a frame what?", answers: ["strong", "stronger"] },
        { prompt: "Designers think about the what when making things for people?", answer: "user" },
      ],
      "year-5": [
        { prompt: "Gears can help change speed or what?", answer: "direction" },
        { prompt: "A list of what a product must do is a design what?", answer: "specification" },
        { prompt: "Reinforcing a structure can stop it from what?", answer: "bending" },
      ],
      "year-6": [
        { prompt: "Making a design better after testing is called what?", answers: ["iteration", "iterating"] },
        { prompt: "A cam, gear and pulley are all what?", answer: "mechanisms" },
        { prompt: "A good product is tested against the what?", answer: "specification" },
      ],
    },
    computing: {
      "year-1": [
        { prompt: "A set of instructions for a computer is called an what?", answer: "algorithm" },
        { prompt: "What do you type with on a computer?", answer: "keyboard" },
        { prompt: "What device moves the pointer on screen?", answer: "mouse" },
      ],
      "year-2": [
        { prompt: "Fixing mistakes in code is called what?", answers: ["debugging", "debug"] },
        { prompt: "A computer follows a what or program?", answers: ["program", "programme"] },
        { prompt: "Computers need clear what to follow?", answers: ["instructions", "instruction"] },
      ],
      "year-3": [
        { prompt: "Putting steps in the right order is called what?", answer: "sequence" },
        { prompt: "Facts stored on a computer are called what?", answer: "data" },
        { prompt: "Connected computers can form a what?", answer: "network" },
      ],
      "year-4": [
        { prompt: "A repeated set of instructions in code is a what?", answer: "loop" },
        { prompt: "A named value in a program is a what?", answer: "variable" },
        { prompt: "The worldwide network of computers is the what?", answer: "internet" },
      ],
      "year-5": [
        { prompt: "In code, an if statement checks a what?", answer: "condition" },
        { prompt: "A box in a spreadsheet is called a what?", answer: "cell" },
        { prompt: "Google is an example of a search what?", answer: "engine" },
      ],
      "year-6": [
        { prompt: "Computers store data using binary made from 0 and what?", answer: "1" },
        { prompt: "A secret word used to protect an account is a what?", answer: "password" },
        { prompt: "Breaking a big problem into smaller parts is called what?", answer: "decomposition" },
      ],
    },
    spanish: {
      "year-1": [
        { prompt: "Type the Spanish word for hello.", answer: "hola", inputLabel: "Type the Spanish word" },
        { prompt: "Type the Spanish word for red.", answer: "rojo", inputLabel: "Type the Spanish word" },
        { prompt: "Type the Spanish word for one.", answer: "uno", inputLabel: "Type the Spanish word" },
      ],
      "year-2": [
        { prompt: "Type the Spanish word for goodbye.", answer: "adios", inputLabel: "Type the Spanish word" },
        { prompt: "Type the Spanish word for blue.", answer: "azul", inputLabel: "Type the Spanish word" },
        { prompt: "Type the Spanish word for two.", answer: "dos", inputLabel: "Type the Spanish word" },
      ],
      "year-3": [
        { prompt: "Type the Spanish word for thank you.", answers: ["gracias"], answer: "gracias", inputLabel: "Type the Spanish word" },
        { prompt: "Type the Spanish word for house.", answer: "casa", inputLabel: "Type the Spanish word" },
        { prompt: "Type the Spanish word for three.", answer: "tres", inputLabel: "Type the Spanish word" },
      ],
      "year-4": [
        { prompt: "Type the Spanish word for water.", answer: "agua", inputLabel: "Type the Spanish word" },
        { prompt: "Type the Spanish word for cat.", answer: "gato", inputLabel: "Type the Spanish word" },
        { prompt: "Type the Spanish word for four.", answer: "cuatro", inputLabel: "Type the Spanish word" },
      ],
      "year-5": [
        { prompt: "Type the Spanish word for left.", answer: "izquierda", inputLabel: "Type the Spanish word" },
        { prompt: "Type the Spanish word for book.", answer: "libro", inputLabel: "Type the Spanish word" },
        { prompt: "Type the Spanish word for five.", answer: "cinco", inputLabel: "Type the Spanish word" },
      ],
      "year-6": [
        { prompt: "Type the Spanish word for school.", answer: "escuela", inputLabel: "Type the Spanish word" },
        { prompt: "Type the Spanish word for because.", answer: "porque", inputLabel: "Type the Spanish word" },
        { prompt: "Type the Spanish word for six.", answer: "seis", inputLabel: "Type the Spanish word" },
      ],
    },
    french: {
      "year-1": [
        { prompt: "Type the French word for hello.", answer: "bonjour", inputLabel: "Type the French word" },
        { prompt: "Type the French word for red.", answer: "rouge", inputLabel: "Type the French word" },
        { prompt: "Type the French word for one.", answer: "un", inputLabel: "Type the French word" },
      ],
      "year-2": [
        { prompt: "Type the French word for thank you.", answer: "merci", inputLabel: "Type the French word" },
        { prompt: "Type the French word for cat.", answer: "chat", inputLabel: "Type the French word" },
        { prompt: "Type the French word for two.", answer: "deux", inputLabel: "Type the French word" },
      ],
      "year-3": [
        { prompt: "Type the French word for house.", answer: "maison", inputLabel: "Type the French word" },
        { prompt: "Type the French words for goodbye.", answers: ["au revoir"], answer: "au revoir", inputLabel: "Type the French words" },
        { prompt: "Type the French word for three.", answer: "trois", inputLabel: "Type the French word" },
      ],
      "year-4": [
        { prompt: "Type the French word for water.", answer: "eau", inputLabel: "Type the French word" },
        { prompt: "Type the French word for dog.", answer: "chien", inputLabel: "Type the French word" },
        { prompt: "Type the French word for four.", answer: "quatre", inputLabel: "Type the French word" },
      ],
      "year-5": [
        { prompt: "Type the French word for left.", answer: "gauche", inputLabel: "Type the French word" },
        { prompt: "Type the French word for book.", answer: "livre", inputLabel: "Type the French word" },
        { prompt: "Type the French word for five.", answer: "cinq", inputLabel: "Type the French word" },
      ],
      "year-6": [
        { prompt: "Type the French word for school.", answer: "ecole", inputLabel: "Type the French word" },
        { prompt: "Type the French word for why.", answer: "pourquoi", inputLabel: "Type the French word" },
        { prompt: "Type the French word for six.", answer: "six", inputLabel: "Type the French word" },
      ],
    },
  };

  const EXTRA_SPELLING_WORDS = {
    "year-1": ["light", "storm", "boat", "play", "star"],
    "year-2": ["school", "children", "water", "would", "whole"],
    "year-3": ["answer", "appear", "address", "special", "earth"],
    "year-4": ["business", "exercise", "history", "quarter", "strength"],
    "year-5": ["curiosity", "equipment", "language", "temperature", "variety"],
    "year-6": ["appreciate", "environment", "explanation", "occupy", "rhythm"],
  };

  const SECONDARY_SPELLING_WORDS = {
    "year-7": ["accompany", "amateur", "category", "controversy", "desperate", "guarantee", "privilege"],
    "year-8": ["committee", "convenience", "determined", "embarrass", "harass", "interrupt", "restaurant"],
    "year-9": ["conscience", "correspond", "disastrous", "exaggerate", "independent", "mischievous", "yacht"],
    "year-10": ["aggressive", "environmental", "existence", "immediately", "pronunciation", "relevant", "sufficient"],
    "year-11": ["acquaintance", "conscientious", "discretion", "entrepreneur", "occurrence", "questionnaire", "threshold"],
    "year-12": ["bureaucratic", "coincidental", "deteriorate", "infrastructure", "miscellaneous", "pharmaceutical", "surveillance"],
    "year-13": ["archaeological", "authoritative", "commensurate", "idiosyncrasy", "indispensable", "juxtaposition", "responsibility"],
  };

  const ADULT_SPELLING_WORDS = [
    "bureaucracy",
    "camouflage",
    "conscientious",
    "fluorescent",
    "manoeuvre",
    "millennium",
    "questionnaire",
    "surveillance",
  ];

  const EXTRA_RAW_LESSON_BANKS = {
    grammar: {
      "year-1": [
        { prompt: "Type the noun in this sentence: The cat sleeps.", answer: "cat" },
        { prompt: "Type the verb in this sentence: Mum cooks dinner.", answer: "cooks" },
        { prompt: "Type the describing word in: a soft pillow.", answer: "soft" },
      ],
      "year-2": [
        { prompt: "Type the noun in: The clown waved.", answer: "clown" },
        { prompt: "Type the adjective in: the tiny ant.", answer: "tiny" },
        { prompt: "Which joining word could complete this sentence: We stayed inside ___ it was cold.", answer: "because" },
      ],
      "year-3": [
        { prompt: "Type the preposition in: The lamp is beside the sofa.", answer: "beside" },
        { prompt: "Type the adverb in: The turtle moved slowly.", answer: "slowly" },
        { prompt: "Which conjunction could complete this sentence: We hurried ___ the gate was closing.", answer: "because" },
      ],
      "year-4": [
        { prompt: "Type the pronoun in: They opened the map.", answer: "they" },
        { prompt: "Type the determiner in: These apples are ripe.", answer: "these" },
        { prompt: "Type the fronted adverbial in: Before sunrise, the crew left.", answers: ["before sunrise"] },
      ],
      "year-5": [
        { prompt: "Which modal verb could complete this sentence: I ___ visit tomorrow.", answer: "might" },
        { prompt: "Type the relative pronoun in: The bike, which was blue, rolled away.", answer: "which" },
        { prompt: "Type the adverb in: The class listened carefully.", answer: "carefully" },
      ],
      "year-6": [
        { prompt: "Type the subject in: The pilot checked the controls.", answers: ["pilot", "the pilot"] },
        { prompt: "Type the object in: The guard carried the message.", answers: ["message", "the message"] },
        { prompt: "Which sentence sounds more formal: I would like some help or Help me now?", answers: ["i would like some help"] },
      ],
    },
    punctuation: {
      "year-1": [
        { prompt: "Which punctuation mark should go at the end of this sentence: The door is locked", answer: "full stop", answers: ["full stop", ".", "period"] },
        { prompt: "Which punctuation mark should go at the end of this question: Where is the key", answer: "question mark", answers: ["question mark", "?"] },
        { prompt: "What kind of letter should start the name Sam?", answer: "capital letter", answers: ["capital letter", "capital"] },
      ],
      "year-2": [
        { prompt: "Which punctuation separates these list items: apples, pears and plums?", answer: "comma" },
        { prompt: "Which punctuation shows missing letters in I'm?", answer: "apostrophe" },
        { prompt: "Which punctuation mark can show surprise?", answer: "exclamation mark", answers: ["exclamation mark", "!"] },
      ],
      "year-3": [
        { prompt: "Which punctuation shows the words a person says?", answer: "speech marks", answers: ["speech marks", "inverted commas"] },
        { prompt: "Which punctuation is used in Mia's coat?", answer: "apostrophe" },
        { prompt: "Which punctuation separates items in a list?", answer: "comma" },
      ],
      "year-4": [
        { prompt: "Which punctuation is used in didn't?", answer: "apostrophe" },
        { prompt: "Which punctuation goes around the words someone says?", answer: "speech marks", answers: ["speech marks", "inverted commas"] },
        { prompt: "Which punctuation follows a fronted adverbial?", answer: "comma" },
      ],
      "year-5": [
        { prompt: "Which punctuation can add extra detail in a sentence?", answer: "brackets" },
        { prompt: "Which punctuation can create a pause stronger than a comma?", answer: "dash" },
        { prompt: "Which punctuation can separate extra information in a sentence?", answer: "comma", answers: ["comma", "commas"] },
      ],
      "year-6": [
        { prompt: "Which punctuation can join two closely linked clauses?", answer: "semicolon" },
        { prompt: "Which punctuation introduces an explanation or list?", answer: "colon" },
        { prompt: "Which punctuation can join mother-in-law?", answer: "hyphen" },
      ],
    },
    maths: {
      "year-1": [
        { prompt: "What is 6 + 2?", answer: "8" },
        { prompt: "What is 9 - 5?", answer: "4" },
        { prompt: "What is one less than 7?", answer: "6" },
      ],
      "year-2": [
        { prompt: "What is 14 + 9?", answer: "23" },
        { prompt: "What is 5 x 2?", answer: "10" },
        { prompt: "What is one quarter of 12?", answer: "3" },
      ],
      "year-3": [
        { prompt: "What is 7 x 3?", answer: "21" },
        { prompt: "What is 18 ÷ 3?", answer: "6" },
        { prompt: "What is double 16?", answer: "32" },
      ],
      "year-4": [
        { prompt: "What is 9 x 5?", answer: "45" },
        { prompt: "A square has sides of 4 cm. What is the perimeter?", answers: ["16", "16 cm"] },
        { prompt: "What is one quarter of 36?", answer: "9" },
      ],
      "year-5": [
        { prompt: "What is 3.2 + 0.8?", answers: ["4", "4.0"] },
        { prompt: "What is 25% of 40?", answer: "10" },
        { prompt: "What is 0.5 of 18?", answers: ["9", "9.0"] },
      ],
      "year-6": [
        { prompt: "What is 35% of 100?", answer: "35" },
        { prompt: "The ratio is 2:3 and the total is 25. What is the bigger share?", answer: "15" },
        { prompt: "What is the mean of 4, 7 and 10?", answer: "7" },
      ],
    },
    science: {
      "year-1": [
        { prompt: "Which body part do you use to hear?", answers: ["ears", "ear"] },
        { prompt: "Which season is usually the coldest?", answer: "winter" },
        { prompt: "Fish live in what?", answer: "water" },
      ],
      "year-2": [
        { prompt: "A baby frog is called a what?", answer: "tadpole" },
        { prompt: "A push or a pull is called a what?", answer: "force" },
        { prompt: "Wood comes from what?", answers: ["trees", "tree"] },
      ],
      "year-3": [
        { prompt: "Your body is supported by your what?", answer: "skeleton" },
        { prompt: "A shadow is made when light is what?", answer: "blocked" },
        { prompt: "Rocks that are melted and cooled are called what?", answer: "igneous" },
      ],
      "year-4": [
        { prompt: "What opens and closes an electrical circuit?", answer: "switch" },
        { prompt: "Which state of matter flows and takes the shape of its container?", answer: "liquid" },
        { prompt: "Which organ is used for breathing?", answers: ["lungs", "lung"] },
      ],
      "year-5": [
        { prompt: "The Moon orbits the Earth while Earth orbits the what?", answer: "sun" },
        { prompt: "A material that springs back into shape is called what?", answer: "elastic" },
        { prompt: "The force caused by moving air is called what?", answers: ["air resistance", "air-resistance"] },
      ],
      "year-6": [
        { prompt: "Which part of the eye controls how much light enters?", answer: "pupil" },
        { prompt: "What substance is carried around the body by the circulatory system?", answer: "blood" },
        { prompt: "White light can split into different what?", answers: ["colours", "colors", "colour", "color"] },
      ],
    },
    history: {
      "year-1": [
        { prompt: "The past means a time that has already what?", answer: "happened" },
        { prompt: "Florence Nightingale was known as the lady with the what?", answer: "lamp" },
        { prompt: "A castle is older or newer than a car?", answer: "older" },
      ],
      "year-2": [
        { prompt: "The Great Fire happened in which city?", answer: "london" },
        { prompt: "A diary helps us learn about the what?", answer: "past" },
        { prompt: "Florence Nightingale worked in a what?", answer: "hospital" },
      ],
      "year-3": [
        { prompt: "The Iron Age came after the what Age?", answer: "bronze" },
        { prompt: "Someone who digs up old objects is an what?", answer: "archaeologist" },
        { prompt: "The Stone Age, Bronze Age and Iron Age all happened in the what?", answer: "past" },
      ],
      "year-4": [
        { prompt: "The Romans built walls, forts and straight what?", answers: ["roads", "road"] },
        { prompt: "Vikings often travelled by long what?", answers: ["boats", "boat", "longboats", "longboat"] },
        { prompt: "Anglo-Saxons came to Britain from across the what?", answer: "sea" },
      ],
      "year-5": [
        { prompt: "Ancient Greece had famous city states such as Athens and what?", answer: "sparta" },
        { prompt: "What event began in Ancient Greece?", answers: ["olympics", "the olympics"] },
        { prompt: "A place where people watched plays in Ancient Greece was a what?", answers: ["theatre", "theater"] },
      ],
      "year-6": [
        { prompt: "Children who left cities in World War Two were called what?", answers: ["evacuees", "evacuee"] },
        { prompt: "Henry VIII was a Tudor what?", answer: "king" },
        { prompt: "The Blitz was a series of air what?", answers: ["raids", "raid"] },
      ],
    },
    geography: {
      "year-1": [
        { prompt: "What do we call frozen water that falls from the sky?", answer: "snow" },
        { prompt: "What do we call moving air?", answer: "wind" },
        { prompt: "What does a map help you find?", answers: ["places", "place"] },
      ],
      "year-2": [
        { prompt: "A very large area of salt water is an what?", answer: "ocean" },
        { prompt: "The direction opposite north is what?", answer: "south" },
        { prompt: "A map can use a simple picture called a what?", answer: "symbol" },
      ],
      "year-3": [
        { prompt: "A river ends at its what?", answer: "mouth" },
        { prompt: "The direction opposite east is what?", answer: "west" },
        { prompt: "A hot dry place with very little rain is a what?", answer: "desert" },
      ],
      "year-4": [
        { prompt: "The imaginary line around the middle of Earth is the what?", answer: "equator" },
        { prompt: "Land with very little rain can be described as what?", answer: "dry" },
        { prompt: "A sudden shaking of the ground is an what?", answer: "earthquake" },
      ],
      "year-5": [
        { prompt: "A mountain that can erupt is a what?", answer: "volcano" },
        { prompt: "The layer of air around Earth is called the what?", answer: "atmosphere" },
        { prompt: "A flat-topped area of high land is a what?", answer: "plateau" },
      ],
      "year-6": [
        { prompt: "Huge pieces of Earth's crust are called tectonic what?", answers: ["plates", "plate"] },
        { prompt: "Energy from the sun is what energy?", answer: "solar" },
        { prompt: "The number of people living in a place is its what?", answer: "population" },
      ],
    },
    dt: {
      "year-1": [
        { prompt: "What tool is used to cut paper?", answers: ["scissors", "a pair of scissors"] },
        { prompt: "What can join two pieces of paper?", answer: "glue" },
        { prompt: "A wheel helps something do what?", answer: "roll" },
      ],
      "year-2": [
        { prompt: "An axle goes through the middle of a what?", answer: "wheel" },
        { prompt: "What joins materials together: tape or wind? Type tape.", answer: "tape" },
        { prompt: "After making, you can say what worked well in an what?", answer: "evaluation" },
      ],
      "year-3": [
        { prompt: "A lever turns around a what?", answer: "pivot" },
        { prompt: "A frame is made from long pieces called what?", answers: ["struts", "strut"] },
        { prompt: "Testing can help you what your design?", answer: "improve" },
      ],
      "year-4": [
        { prompt: "A flat pattern that folds into a 3D shape is a what?", answer: "net" },
        { prompt: "A switch can break or complete a what?", answer: "circuit" },
        { prompt: "A user is the person who will what the product?", answer: "use" },
      ],
      "year-5": [
        { prompt: "A pulley helps lift a what?", answer: "load" },
        { prompt: "A first model used to test an idea is a what?", answer: "prototype" },
        { prompt: "A gear system can make something turn faster or what?", answer: "slower" },
      ],
      "year-6": [
        { prompt: "A structure that does not wobble is what?", answer: "stable" },
        { prompt: "Mechanisms have an input and an what?", answer: "output" },
        { prompt: "A fair test changes one thing at a what?", answer: "time" },
      ],
    },
    computing: {
      "year-1": [
        { prompt: "What part of a computer shows pictures and words?", answer: "screen" },
        { prompt: "Which key can start a new line?", answer: "enter" },
        { prompt: "What do we call a picture you click to open something?", answer: "icon" },
      ],
      "year-2": [
        { prompt: "A set of steps is an what?", answer: "algorithm" },
        { prompt: "The internet connects lots of what?", answers: ["computers", "computer"] },
        { prompt: "Information stored on a computer is called what?", answer: "data" },
      ],
      "year-3": [
        { prompt: "A mistake in a program is called a what?", answer: "bug" },
        { prompt: "Instructions that repeat again and again are a what?", answer: "loop" },
        { prompt: "A program that opens web pages is a what?", answer: "browser" },
      ],
      "year-4": [
        { prompt: "An if statement helps a program make a what?", answer: "decision" },
        { prompt: "Work saved on a computer is kept in a what?", answer: "file" },
        { prompt: "A spreadsheet is made from rows and what?", answers: ["columns", "column"] },
      ],
      "year-5": [
        { prompt: "A device like a keyboard or mouse is an input what?", answer: "device" },
        { prompt: "A screen or speaker is an output what?", answer: "device" },
        { prompt: "Clicking a result on a search page opens a web what?", answer: "page" },
      ],
      "year-6": [
        { prompt: "Scrambling data to keep it safe is called what?", answer: "encryption" },
        { prompt: "A web page can be written in HTML and what style language? Type css.", answer: "css" },
        { prompt: "An address that identifies a device on a network is an IP what?", answer: "address" },
      ],
    },
    spanish: {
      "year-1": [
        { prompt: "Type the Spanish word for yes.", answer: "si", answers: ["si", "sí"], inputLabel: "Type the Spanish word" },
        { prompt: "Type the Spanish word for sun.", answer: "sol", inputLabel: "Type the Spanish word" },
        { prompt: "Type the Spanish word for friend.", answer: "amigo", inputLabel: "Type the Spanish word" },
      ],
      "year-2": [
        { prompt: "Type the Spanish word for green.", answer: "verde", inputLabel: "Type the Spanish word" },
        { prompt: "Type the Spanish words for please.", answer: "por favor", inputLabel: "Type the Spanish words" },
        { prompt: "Type the Spanish word for three.", answer: "tres", inputLabel: "Type the Spanish word" },
      ],
      "year-3": [
        { prompt: "Type the Spanish word for family.", answer: "familia", inputLabel: "Type the Spanish word" },
        { prompt: "Type the Spanish word for black.", answer: "negro", inputLabel: "Type the Spanish word" },
        { prompt: "Type the Spanish word for school.", answer: "escuela", inputLabel: "Type the Spanish word" },
      ],
      "year-4": [
        { prompt: "Type the Spanish word for dog.", answer: "perro", inputLabel: "Type the Spanish word" },
        { prompt: "Type the Spanish word for five.", answer: "cinco", inputLabel: "Type the Spanish word" },
        { prompt: "Type the Spanish word for window.", answer: "ventana", inputLabel: "Type the Spanish word" },
      ],
      "year-5": [
        { prompt: "Type the Spanish word for right.", answer: "derecha", inputLabel: "Type the Spanish word" },
        { prompt: "Type the Spanish word for pencil.", answer: "lapiz", answers: ["lapiz", "lápiz"], inputLabel: "Type the Spanish word" },
        { prompt: "Type the Spanish word for seven.", answer: "siete", inputLabel: "Type the Spanish word" },
      ],
      "year-6": [
        { prompt: "Type the Spanish word for library.", answer: "biblioteca", inputLabel: "Type the Spanish word" },
        { prompt: "Type the Spanish word for today.", answer: "hoy", inputLabel: "Type the Spanish word" },
        { prompt: "Type the Spanish word for eight.", answer: "ocho", inputLabel: "Type the Spanish word" },
      ],
    },
    french: {
      "year-1": [
        { prompt: "Type the French word for yes.", answer: "oui", inputLabel: "Type the French word" },
        { prompt: "Type the French word for sun.", answer: "soleil", inputLabel: "Type the French word" },
        { prompt: "Type the French word for friend.", answer: "ami", inputLabel: "Type the French word" },
      ],
      "year-2": [
        { prompt: "Type the French word for blue.", answer: "bleu", inputLabel: "Type the French word" },
        { prompt: "Type the French word for green.", answer: "vert", inputLabel: "Type the French word" },
        { prompt: "Type the French word for bird.", answer: "oiseau", inputLabel: "Type the French word" },
      ],
      "year-3": [
        { prompt: "Type the French word for family.", answer: "famille", inputLabel: "Type the French word" },
        { prompt: "Type the French word for black.", answer: "noir", inputLabel: "Type the French word" },
        { prompt: "Type the French word for friend.", answer: "ami", inputLabel: "Type the French word" },
      ],
      "year-4": [
        { prompt: "Type the French word for apple.", answer: "pomme", inputLabel: "Type the French word" },
        { prompt: "Type the French word for school.", answer: "ecole", answers: ["ecole", "école"], inputLabel: "Type the French word" },
        { prompt: "Type the French word for seven.", answer: "sept", inputLabel: "Type the French word" },
      ],
      "year-5": [
        { prompt: "Type the French word for right.", answer: "droite", inputLabel: "Type the French word" },
        { prompt: "Type the French word for pencil.", answer: "crayon", inputLabel: "Type the French word" },
        { prompt: "Type the French word for eight.", answer: "huit", inputLabel: "Type the French word" },
      ],
      "year-6": [
        { prompt: "Type the French word for library.", answer: "bibliotheque", answers: ["bibliotheque", "bibliothèque"], inputLabel: "Type the French word" },
        { prompt: "Type the French word for tomorrow.", answer: "demain", inputLabel: "Type the French word" },
        { prompt: "Type the French word for question.", answer: "question", inputLabel: "Type the French word" },
      ],
    },
  };

  const SECONDARY_RAW_LESSON_BANKS = {
    grammar: {
      "year-7": [
        { prompt: "Type the subordinate conjunction in: Because the lights failed, we paused.", answer: "because" },
        { prompt: "Type the verb phrase in: The team was waiting outside.", answers: ["was waiting"] },
        { prompt: "Type the determiner in: Several students finished early.", answer: "several" },
      ],
      "year-8": [
        { prompt: "Type the relative pronoun in: The code that unlocked the door was hidden.", answer: "that" },
        { prompt: "Type the object in: Maya opened the cabinet.", answers: ["cabinet", "the cabinet"] },
        { prompt: "Type the adverbial phrase in: After the lesson, we compared answers.", answers: ["after the lesson"] },
      ],
      "year-9": [
        { prompt: "Type the modal verb in: You should check the answer twice.", answer: "should" },
        { prompt: "Type the passive verb phrase in: The gate was opened by the guard.", answers: ["was opened"] },
        { prompt: "Type the abstract noun in: Her bravery impressed the team.", answer: "bravery" },
      ],
      "year-10": [
        { prompt: "Which word completes the subjunctive sentence: If I ___ in charge, I would change the rule.", answer: "were" },
        { prompt: "Type the imperative verb in: Bring your notes to the table.", answer: "bring" },
        { prompt: "Type the cohesive device in: However, the result stayed the same.", answer: "however" },
      ],
      "year-11": [
        { prompt: "Type the pronoun in: Neither of them forgot their keycard.", answer: "their" },
        { prompt: "Type the subject in: The revised timetable solved the problem.", answers: ["timetable", "the revised timetable"] },
        { prompt: "Which sentence is more formal: I apologise for the delay or Sorry I was late?", answers: ["i apologise for the delay"] },
      ],
      "year-12": [
        { prompt: "Type the auxiliary verb in: The results have improved this term.", answer: "have" },
        { prompt: "Type the comparative adjective in: This method is more reliable.", answers: ["more reliable"] },
        { prompt: "Type the noun phrase in: The final decision shocked everyone.", answers: ["the final decision"] },
      ],
      "year-13": [
        { prompt: "Type the modal verb showing uncertainty in: The answer might change tomorrow.", answer: "might" },
        { prompt: "Type the nominalisation in: The expansion of the city continued rapidly.", answer: "expansion" },
        { prompt: "Type the pronoun in: This was unexpected, and it changed everything.", answer: "it" },
      ],
    },
    punctuation: {
      "year-7": [
        { prompt: "Which punctuation introduces a list after a complete clause?", answer: "colon" },
        { prompt: "Which punctuation can join two closely related clauses?", answer: "semicolon" },
        { prompt: "Which punctuation can show an interruption in a sentence?", answer: "dash" },
      ],
      "year-8": [
        { prompt: "Which punctuation shows possession in the players' kit?", answer: "apostrophe" },
        { prompt: "Which punctuation can add extra information like this (quietly)?", answer: "brackets" },
        { prompt: "Which punctuation shows trailing speech or suspense?", answer: "ellipsis" },
      ],
      "year-9": [
        { prompt: "Which punctuation joins the words in high-speed train?", answer: "hyphen" },
        { prompt: "Which punctuation introduces an explanation?", answer: "colon" },
        { prompt: "Which punctuation can separate two linked clauses without a conjunction?", answer: "semicolon" },
      ],
      "year-10": [
        { prompt: "Which punctuation should follow a discourse marker such as However at the start of a sentence?", answer: "comma" },
        { prompt: "Which punctuation can be used in pairs to insert extra information?", answers: ["commas", "comma"] },
        { prompt: "Which punctuation should end a direct question?", answer: "question mark", answers: ["question mark", "?"] },
      ],
      "year-11": [
        { prompt: "Which punctuation is needed in the teachers' office?", answer: "apostrophe" },
        { prompt: "Which punctuation introduces a quotation or explanation after a full clause?", answer: "colon" },
        { prompt: "Which punctuation can replace brackets in some writing?", answers: ["dashes", "dash"] },
      ],
      "year-12": [
        { prompt: "Which punctuation mark can separate detailed items in a complex list?", answer: "semicolon" },
        { prompt: "Which punctuation can mark an omitted letter in o'clock?", answer: "apostrophe" },
        { prompt: "Which punctuation can surround a parenthetical phrase?", answers: ["commas", "comma"] },
      ],
      "year-13": [
        { prompt: "Which punctuation joins a prefix to a word in ex-student?", answer: "hyphen" },
        { prompt: "Which punctuation can show unfinished thought in dialogue?", answer: "ellipsis" },
        { prompt: "Which punctuation can introduce a formal explanation or definition?", answer: "colon" },
      ],
    },
    maths: {
      "year-7": [
        { prompt: "What is 25% of 64?", answer: "16" },
        { prompt: "Solve x + 7 = 19.", answer: "12" },
        { prompt: "What is the perimeter of a triangle with sides 8 cm, 7 cm and 6 cm?", answers: ["21", "21 cm"] },
      ],
      "year-8": [
        { prompt: "Solve 3x = 27.", answer: "9" },
        { prompt: "What is the area of a triangle with base 10 cm and height 6 cm?", answers: ["30", "30 cm2", "30 cm^2"] },
        { prompt: "What is -4 + 11?", answer: "7" },
      ],
      "year-9": [
        { prompt: "Solve 2x + 5 = 17.", answer: "6" },
        { prompt: "A right-angled triangle has sides 3 cm and 4 cm. What is the hypotenuse?", answers: ["5", "5 cm"] },
        { prompt: "What is the probability of rolling a 6 on a fair die?", answers: ["1/6"] },
      ],
      "year-10": [
        { prompt: "What is the gradient between the points (1,2) and (5,10)?", answer: "2" },
        { prompt: "What is the square root of 144?", answer: "12" },
        { prompt: "Using pi = 3.14, what is the circumference of a circle with diameter 10 cm?", answers: ["31.4", "31.4 cm"] },
      ],
      "year-11": [
        { prompt: "What is 3/5 as a percentage?", answers: ["60", "60%"] },
        { prompt: "Solve x^2 - 49 = 0 for the positive value of x.", answer: "7" },
        { prompt: "What is the mean of 4, 7, 9 and 12?", answer: "8" },
      ],
      "year-12": [
        { prompt: "What is the derivative of x squared?", answers: ["2x"] },
        { prompt: "What is 2 to the power of 3 multiplied by 2 to the power of 4?", answer: "128" },
        { prompt: "What is the midpoint between 2 and 10?", answer: "6" },
      ],
      "year-13": [
        { prompt: "What is the derivative of x cubed?", answers: ["3x^2", "3x²"] },
        { prompt: "What is log base 10 of 1000?", answer: "3" },
        { prompt: "What is the gradient of y = 5x - 2?", answer: "5" },
      ],
    },
    science: {
      "year-7": [
        { prompt: "What is the control centre of a cell called?", answer: "nucleus" },
        { prompt: "What state of matter has a fixed shape and fixed volume?", answer: "solid" },
        { prompt: "Which planet is known for its rings?", answer: "saturn" },
      ],
      "year-8": [
        { prompt: "Which gas do plants take in for photosynthesis?", answers: ["carbon dioxide"] },
        { prompt: "What is the unit of electrical current?", answer: "ampere", answers: ["ampere", "amp", "amps"] },
        { prompt: "What type of reaction takes in heat?", answer: "endothermic" },
      ],
      "year-9": [
        { prompt: "What is the centre of an atom called?", answer: "nucleus" },
        { prompt: "A pH value below 7 shows a substance is what?", answer: "acidic", answers: ["acidic", "an acid", "acid"] },
        { prompt: "What is speed equal to distance divided by?", answer: "time" },
      ],
      "year-10": [
        { prompt: "What is the name of the process where particles spread from high concentration to low concentration?", answer: "diffusion" },
        { prompt: "Which group in the periodic table contains the alkali metals?", answer: "group 1", answers: ["group 1", "1"] },
        { prompt: "Which type of lens is thicker in the middle and can focus light to a point?", answer: "convex" },
      ],
      "year-11": [
        { prompt: "What molecule carries genetic information?", answer: "dna" },
        { prompt: "What is the formula linking force, mass and acceleration? Type the letters only.", answers: ["f=ma", "f = ma"] },
        { prompt: "What is the name of the carbon-containing compounds studied in chemistry?", answer: "organic" },
      ],
      "year-12": [
        { prompt: "What organelle is the site of aerobic respiration?", answers: ["mitochondria", "mitochondrion"] },
        { prompt: "What type of bond forms when electrons are shared?", answer: "covalent" },
        { prompt: "What is the SI unit of force?", answer: "newton", answers: ["newton", "newtons"] },
      ],
      "year-13": [
        { prompt: "What is the rate of change of velocity called?", answer: "acceleration" },
        { prompt: "What type of cell division produces gametes?", answer: "meiosis" },
        { prompt: "What is the term for heat energy needed to start a reaction?", answer: "activation energy" },
      ],
    },
    history: {
      "year-7": [
        { prompt: "The Norman Conquest happened in what year?", answer: "1066" },
        { prompt: "What was the name of the document King John sealed in 1215?", answers: ["magna carta", "the magna carta"] },
        { prompt: "What was the disease outbreak called that devastated Europe in the 1300s?", answers: ["black death", "the black death"] },
      ],
      "year-8": [
        { prompt: "What period of rapid factory growth began in Britain in the 1700s and 1800s?", answers: ["industrial revolution", "the industrial revolution"] },
        { prompt: "In what year was the transatlantic slave trade abolished in the British Empire?", answer: "1807" },
        { prompt: "Which machine became a symbol of early factory textile production: spinning jenny or telescope? Type spinning jenny.", answers: ["spinning jenny", "the spinning jenny"] },
      ],
      "year-9": [
        { prompt: "In what year did the First World War begin?", answer: "1914" },
        { prompt: "What type of warfare used long defended ditches on the Western Front?", answer: "trench warfare" },
        { prompt: "In what year did some women in Britain first gain the vote?", answer: "1918" },
      ],
      "year-10": [
        { prompt: "In what year did Hitler become Chancellor of Germany?", answer: "1933" },
        { prompt: "Which agreement ended the First World War and blamed Germany? Type treaty name only.", answers: ["versailles", "treaty of versailles"] },
        { prompt: "The Cold War mainly involved the USA and which other superpower?", answers: ["ussr", "soviet union", "the soviet union"] },
      ],
      "year-11": [
        { prompt: "In what year did the Wall Street Crash happen?", answer: "1929" },
        { prompt: "In what year was the Berlin Wall built?", answer: "1961" },
        { prompt: "What name is given to the genocide of Jews during World War Two?", answers: ["holocaust", "the holocaust"] },
      ],
      "year-12": [
        { prompt: "In what year did the Russian Revolution begin?", answer: "1917" },
        { prompt: "What movement in Europe revived interest in art and learning from classical times?", answers: ["renaissance", "the renaissance"] },
        { prompt: "What was the name of the bloodless change of monarch in 1688 in England?", answers: ["glorious revolution", "the glorious revolution"] },
      ],
      "year-13": [
        { prompt: "In what year did England break from Rome under Henry VIII?", answer: "1534" },
        { prompt: "In what year was the Cuban Missile Crisis?", answer: "1962" },
        { prompt: "In what year did the Soviet Union collapse?", answer: "1991" },
      ],
    },
    geography: {
      "year-7": [
        { prompt: "What process turns water vapour into liquid water in the water cycle?", answer: "condensation" },
        { prompt: "What do we call lines running east-west that measure north and south position?", answer: "latitude" },
        { prompt: "What is the imaginary line at 0 degrees latitude called?", answer: "equator" },
      ],
      "year-8": [
        { prompt: "What is the wearing away of rock by wind, water or ice called?", answer: "erosion" },
        { prompt: "What is the place where a river begins called?", answer: "source" },
        { prompt: "Which type of map shows height using contour lines?", answer: "topographic", answers: ["topographic", "topographical"] },
      ],
      "year-9": [
        { prompt: "What does GDP stand for? Type the full phrase.", answers: ["gross domestic product"] },
        { prompt: "What type of plate boundary has plates moving away from each other?", answers: ["constructive", "divergent"] },
        { prompt: "What do we call people moving from one place to another to live?", answer: "migration" },
      ],
      "year-10": [
        { prompt: "What is the increase in the percentage of people living in towns and cities called?", answer: "urbanisation", answers: ["urbanisation", "urbanization"] },
        { prompt: "Name one greenhouse gas. Best answer: carbon dioxide.", answers: ["carbon dioxide", "co2"] },
        { prompt: "What type of energy comes from resources that can be replaced naturally?", answer: "renewable" },
      ],
      "year-11": [
        { prompt: "What is a large-scale ecosystem like tundra or rainforest called?", answer: "biome" },
        { prompt: "What do we call the average number of years a person is expected to live?", answer: "life expectancy" },
        { prompt: "What word describes development that meets present needs without harming the future?", answer: "sustainable" },
      ],
      "year-12": [
        { prompt: "What term describes how countries are linked together through trade and communication?", answer: "globalisation", answers: ["globalisation", "globalization"] },
        { prompt: "What is underground water stored in permeable rock called?", answer: "aquifer" },
        { prompt: "What is the movement of people out of rural areas into towns called?", answer: "urbanisation", answers: ["urbanisation", "urbanization"] },
      ],
      "year-13": [
        { prompt: "What word describes reducing the causes of climate change?", answer: "mitigation" },
        { prompt: "What word describes adapting places or behaviour to cope with climate change?", answer: "adaptation" },
        { prompt: "What term means countries depending on each other for goods, services or ideas?", answer: "interdependence" },
      ],
    },
    dt: {
      "year-7": [
        { prompt: "What is the detailed list of what a product must do called?", answer: "specification" },
        { prompt: "What is the first model used to test an idea called?", answer: "prototype" },
        { prompt: "What do we call the person the product is designed for?", answer: "user" },
      ],
      "year-8": [
        { prompt: "What does CAD stand for? Type the full phrase.", answers: ["computer aided design", "computer-aided design"] },
        { prompt: "What word describes making a design fit the human body well?", answer: "ergonomics" },
        { prompt: "What type of drawing shows a 3D object on paper using one angle view? Type isometric.", answer: "isometric" },
      ],
      "year-9": [
        { prompt: "What is repeated improvement of a design called?", answer: "iteration" },
        { prompt: "What do we call a measurement range a product part is allowed to vary by?", answer: "tolerance" },
        { prompt: "What material property means it can bend without snapping?", answer: "flexible", answers: ["flexible", "flexibility"] },
      ],
      "year-10": [
        { prompt: "What does CAM stand for? Type the full phrase.", answers: ["computer aided manufacture", "computer-aided manufacture", "computer aided manufacturing", "computer-aided manufacturing"] },
        { prompt: "What type of production makes many identical items in groups?", answer: "batch production" },
        { prompt: "What word means using resources without wasting them or harming the future?", answer: "sustainability" },
      ],
      "year-11": [
        { prompt: "What is the process of judging how well a product worked called?", answer: "evaluation" },
        { prompt: "What term describes a thin decorative layer of wood on top of another material?", answer: "veneer" },
        { prompt: "What type of force stretches a material?", answer: "tension" },
      ],
      "year-12": [
        { prompt: "What term means body measurements used by designers?", answer: "anthropometrics" },
        { prompt: "What is a device used to guide tools or hold work accurately during manufacture called?", answers: ["jig", "fixture"] },
        { prompt: "What do we call a product designed to be taken apart easily for repair?", answer: "repairable" },
      ],
      "year-13": [
        { prompt: "What phrase describes making only what is needed when it is needed?", answers: ["just in time", "just-in-time"] },
        { prompt: "What term describes a product designed to stop working or go out of date on purpose?", answers: ["planned obsolescence"] },
        { prompt: "What word describes considering the environmental effect of a product from making to disposal?", answers: ["life cycle", "lifecycle", "life-cycle"] },
      ],
    },
    computing: {
      "year-7": [
        { prompt: "What number does the binary value 10 represent?", answer: "2" },
        { prompt: "What do we call a set of steps for solving a problem?", answer: "algorithm" },
        { prompt: "What is temporary computer memory called?", answer: "ram" },
      ],
      "year-8": [
        { prompt: "What programming structure repeats instructions?", answer: "loop" },
        { prompt: "What do we call a mistake in code?", answer: "bug" },
        { prompt: "What type of memory keeps data when the power is off: RAM or ROM? Type rom.", answer: "rom" },
      ],
      "year-9": [
        { prompt: "What does IP stand for in IP address? Type the two words.", answers: ["internet protocol"] },
        { prompt: "What language is often used to query databases? Type the four letters.", answer: "sql" },
        { prompt: "What do we call the main field that uniquely identifies each record in a table?", answers: ["primary key", "key"] },
      ],
      "year-10": [
        { prompt: "What logical operator only returns true when both inputs are true?", answer: "and" },
        { prompt: "What is translating source code into machine code called?", answer: "compiling", answers: ["compiling", "compilation"] },
        { prompt: "What numbering system is base 16?", answer: "hexadecimal" },
      ],
      "year-11": [
        { prompt: "What security process scrambles data to keep it unreadable?", answer: "encryption" },
        { prompt: "What do we call data copied from another place to store temporarily for quick use?", answer: "cache", answers: ["cache", "caching"] },
        { prompt: "What term means breaking a problem into smaller parts?", answer: "decomposition" },
      ],
      "year-12": [
        { prompt: "In object-oriented programming, what do we call a blueprint for creating objects?", answer: "class" },
        { prompt: "What is a function calling itself called?", answer: "recursion" },
        { prompt: "What data structure works last in, first out?", answer: "stack" },
      ],
      "year-13": [
        { prompt: "What does API stand for? Type the full phrase.", answers: ["application programming interface"] },
        { prompt: "What do we call the data used to teach a machine learning model?", answers: ["training data", "dataset"] },
        { prompt: "What term means converting data into a standard range before processing?", answer: "normalisation", answers: ["normalisation", "normalization"] },
      ],
    },
    spanish: {
      "year-7": [
        { prompt: "Type the Spanish for hello.", answer: "hola", inputLabel: "Type the Spanish word" },
        { prompt: "Type the Spanish for red.", answer: "rojo", inputLabel: "Type the Spanish word" },
        { prompt: "Type the Spanish for ten.", answer: "diez", inputLabel: "Type the Spanish word" },
      ],
      "year-8": [
        { prompt: "Type the Spanish for my name is.", answers: ["me llamo"], inputLabel: "Type the Spanish phrase" },
        { prompt: "Type the Spanish for brother.", answer: "hermano", inputLabel: "Type the Spanish word" },
        { prompt: "Type the Spanish for school bag.", answers: ["mochila"], inputLabel: "Type the Spanish word" },
      ],
      "year-9": [
        { prompt: "Type the Spanish for I live.", answers: ["vivo"], inputLabel: "Type the Spanish word" },
        { prompt: "Type the Spanish for because.", answers: ["porque"], inputLabel: "Type the Spanish word" },
        { prompt: "Type the Spanish for weekend.", answers: ["fin de semana"], inputLabel: "Type the Spanish phrase" },
      ],
      "year-10": [
        { prompt: "Type the Spanish for I would like.", answers: ["me gustaria", "me gustaría"], inputLabel: "Type the Spanish phrase" },
        { prompt: "Type the Spanish for yesterday.", answers: ["ayer"], inputLabel: "Type the Spanish word" },
        { prompt: "Type the Spanish for city.", answers: ["ciudad"], inputLabel: "Type the Spanish word" },
      ],
      "year-11": [
        { prompt: "Type the Spanish for in my opinion.", answers: ["en mi opinion", "en mi opinión"], inputLabel: "Type the Spanish phrase" },
        { prompt: "Type the Spanish for environment.", answers: ["medio ambiente"], inputLabel: "Type the Spanish phrase" },
        { prompt: "Type the Spanish for important.", answers: ["importante"], inputLabel: "Type the Spanish word" },
      ],
      "year-12": [
        { prompt: "Type the Spanish for although.", answers: ["aunque"], inputLabel: "Type the Spanish word" },
        { prompt: "Type the Spanish for freedom.", answers: ["libertad"], inputLabel: "Type the Spanish word" },
        { prompt: "Type the Spanish for society.", answers: ["sociedad"], inputLabel: "Type the Spanish word" },
      ],
      "year-13": [
        { prompt: "Type the Spanish for challenge.", answers: ["desafio", "desafío"], inputLabel: "Type the Spanish word" },
        { prompt: "Type the Spanish for government.", answers: ["gobierno"], inputLabel: "Type the Spanish word" },
        { prompt: "Type the Spanish for future.", answers: ["futuro"], inputLabel: "Type the Spanish word" },
      ],
    },
    french: {
      "year-7": [
        { prompt: "Type the French for hello.", answer: "bonjour", inputLabel: "Type the French word" },
        { prompt: "Type the French for red.", answer: "rouge", inputLabel: "Type the French word" },
        { prompt: "Type the French for ten.", answer: "dix", inputLabel: "Type the French word" },
      ],
      "year-8": [
        { prompt: "Type the French for my name is.", answers: ["je m'appelle"], inputLabel: "Type the French phrase" },
        { prompt: "Type the French for brother.", answer: "frere", answers: ["frere", "frère"], inputLabel: "Type the French word" },
        { prompt: "Type the French for school bag.", answers: ["sac"], inputLabel: "Type the French word" },
      ],
      "year-9": [
        { prompt: "Type the French for I live.", answers: ["j'habite"], inputLabel: "Type the French phrase" },
        { prompt: "Type the French for because.", answers: ["parce que"], inputLabel: "Type the French phrase" },
        { prompt: "Type the French for weekend.", answers: ["week-end", "weekend"], inputLabel: "Type the French word" },
      ],
      "year-10": [
        { prompt: "Type the French for I would like.", answers: ["je voudrais"], inputLabel: "Type the French phrase" },
        { prompt: "Type the French for yesterday.", answers: ["hier"], inputLabel: "Type the French word" },
        { prompt: "Type the French for city.", answers: ["ville"], inputLabel: "Type the French word" },
      ],
      "year-11": [
        { prompt: "Type the French for in my opinion.", answers: ["a mon avis", "à mon avis"], inputLabel: "Type the French phrase" },
        { prompt: "Type the French for environment.", answers: ["environnement", "l'environnement"], inputLabel: "Type the French word" },
        { prompt: "Type the French for important.", answers: ["important"], inputLabel: "Type the French word" },
      ],
      "year-12": [
        { prompt: "Type the French for although.", answers: ["bien que"], inputLabel: "Type the French phrase" },
        { prompt: "Type the French for freedom.", answers: ["liberte", "liberté"], inputLabel: "Type the French word" },
        { prompt: "Type the French for society.", answers: ["societe", "société"], inputLabel: "Type the French word" },
      ],
      "year-13": [
        { prompt: "Type the French for challenge.", answers: ["defi", "défi"], inputLabel: "Type the French word" },
        { prompt: "Type the French for government.", answers: ["gouvernement"], inputLabel: "Type the French word" },
        { prompt: "Type the French for future.", answers: ["avenir"], inputLabel: "Type the French word" },
      ],
    },
  };

  const ADULT_RAW_LESSON_BANKS = {
    grammar: [
      { prompt: "Type the subordinate conjunction in: Although it was late, we finished the report.", answer: "although" },
      { prompt: "Type the passive verb phrase in: The parcel was delivered before noon.", answers: ["was delivered"] },
      { prompt: "Which sentence sounds more formal: children require support or kids need help?", answers: ["children require support"] },
    ],
    punctuation: [
      { prompt: "Which punctuation introduces a list after a complete clause?", answer: "colon" },
      { prompt: "Which punctuation can join two closely related independent clauses?", answer: "semicolon" },
      { prompt: "Which punctuation marks can show an interruption in a sentence?", answers: ["dashes", "dash"] },
    ],
    maths: [
      { prompt: "What is 17.5% of 80?", answer: "14" },
      { prompt: "A train leaves at 14:35 and the trip takes 1 hour 45 minutes. What time does it arrive? Type 24-hour time.", answers: ["16:20", "1620"] },
      { prompt: "A bill is 48 pounds and a 12.5% tip is added. What is the total cost?", answers: ["54", "54.0", "54.00"] },
    ],
    science: [
      { prompt: "What gas do humans need to breathe to stay alive?", answer: "oxygen" },
      { prompt: "The instructions in your cells are stored in what molecule?", answer: "dna" },
      { prompt: "Changing from a liquid to a gas is called what?", answer: "evaporation" },
    ],
    history: [
      { prompt: "The Battle of Hastings happened in what year?", answer: "1066" },
      { prompt: "The Magna Carta was first agreed in what year?", answer: "1215" },
      { prompt: "The First World War began in what year?", answer: "1914" },
    ],
    geography: [
      { prompt: "Lines measuring east and west on Earth are lines of what?", answer: "longitude" },
      { prompt: "Lines measuring north and south on Earth are lines of what?", answer: "latitude" },
      { prompt: "The imaginary line dividing Earth into the Northern and Southern Hemispheres is the what?", answer: "equator" },
    ],
    dt: [
      { prompt: "A detailed list of what a product must do is a design what?", answer: "specification" },
      { prompt: "Repeatedly improving a design after testing is called what?", answer: "iteration" },
      { prompt: "A full-size or test version made before the final product is a what?", answer: "prototype" },
    ],
    computing: [
      { prompt: "What does CPU stand for?", answers: ["central processing unit"] },
      { prompt: "Scrambling data so other people cannot read it is called what?", answer: "encryption" },
      { prompt: "The process of finding and fixing errors in code is called what?", answer: "debugging" },
    ],
    spanish: [
      { prompt: "Type the Spanish for good morning.", answers: ["buenos dias", "buenos días"], inputLabel: "Type the Spanish phrase" },
      { prompt: "Type the Spanish for thank you very much.", answers: ["muchas gracias"], inputLabel: "Type the Spanish phrase" },
      { prompt: "Type the Spanish for where is the station?", answers: ["donde esta la estacion", "dónde está la estación"], inputLabel: "Type the Spanish phrase" },
    ],
    french: [
      { prompt: "Type the French for good morning.", answers: ["bonjour"], inputLabel: "Type the French phrase" },
      { prompt: "Type the French for thank you very much.", answers: ["merci beaucoup"], inputLabel: "Type the French phrase" },
      { prompt: "Type the French for where is the station?", answers: ["ou est la gare", "où est la gare"], inputLabel: "Type the French phrase" },
    ],
  };

  function addAdultWordPool(wordPools) {
    return {
      ...wordPools,
      [ADULT_YEAR_GROUP]: [...(wordPools["year-13"] || []), ...ADULT_SPELLING_WORDS],
    };
  }

  function addAdultLessonBanks(rawBanks) {
    return Object.fromEntries(
      Object.entries(rawBanks).map(([subjectId, yearBanks]) => [
        subjectId,
        {
          ...yearBanks,
          [ADULT_YEAR_GROUP]: [...(yearBanks["year-13"] || []), ...(ADULT_RAW_LESSON_BANKS[subjectId] || [])],
        },
      ])
    );
  }

  const EXPANDED_SPELLING_WORDS = addAdultWordPool(
    addWordPoolYears(mergeWordPools(SPELLING_WORDS, EXTRA_SPELLING_WORDS), SECONDARY_SPELLING_WORDS)
  );
  const EXPANDED_RAW_LESSON_BANKS = addAdultLessonBanks(
    addLessonBankYears(mergeRawLessonBanks(RAW_LESSON_BANKS, EXTRA_RAW_LESSON_BANKS), SECONDARY_RAW_LESSON_BANKS)
  );

  const LESSON_BANKS = {
    spelling: Object.fromEntries(Object.entries(EXPANDED_SPELLING_WORDS).map(([yearGroup, words]) => [yearGroup, createSpellingLesson(yearGroup, words)])),
    grammar: buildSubjectBanks("grammar", EXPANDED_RAW_LESSON_BANKS.grammar),
    punctuation: buildSubjectBanks("punctuation", EXPANDED_RAW_LESSON_BANKS.punctuation),
    maths: buildSubjectBanks("maths", EXPANDED_RAW_LESSON_BANKS.maths),
    science: buildSubjectBanks("science", EXPANDED_RAW_LESSON_BANKS.science),
    history: buildSubjectBanks("history", EXPANDED_RAW_LESSON_BANKS.history),
    geography: buildSubjectBanks("geography", EXPANDED_RAW_LESSON_BANKS.geography),
    dt: buildSubjectBanks("dt", EXPANDED_RAW_LESSON_BANKS.dt),
    computing: buildSubjectBanks("computing", EXPANDED_RAW_LESSON_BANKS.computing),
    spanish: buildSubjectBanks("spanish", EXPANDED_RAW_LESSON_BANKS.spanish),
    french: buildSubjectBanks("french", EXPANDED_RAW_LESSON_BANKS.french),
  };

  const MISSION_WORLD = {
    id: "black-site",
    name: "Black Site Corridor",
    subtitle: "Steel floors, laser traps, and sealed lesson doors.",
    palette: {
      skyTop: "#09111b",
      skyBottom: "#03070c",
      wall: "#101b27",
      wall2: "#142333",
      steel: "#1d2a36",
      floor: "#0b1219",
      floor2: "#17222d",
      gold: "#f2c86f",
      red: "#ff4d59",
      blue: "#68a9ff",
      cyan: "#9ee9ff",
    },
  };

  const CHARACTER_PROFILES = {
    nathan: {
      id: "nathan",
      name: "Agent N",
      likesLabel: "Favorite Things",
      likes: "his brother Agent M and gaming",
      dislikes: "veggies",
      portraitBackdropTop: "#23324b",
      portraitBackdropBottom: "#101925",
      portraitAccent: "#f2c86f",
      hairStyle: "ponytail",
      hair: "#d9b05b",
      hairShadow: "#b28c43",
      skin: "#f2d0b1",
      skinShadow: "#d4af8b",
      blush: "rgba(232, 148, 132, 0.34)",
      suit: "#1c2430",
      suitHighlight: "#354458",
      suitEdge: "#283141",
      shirt: "#eff4f7",
      shirtShadow: "#cad6df",
      tie: "#0d1016",
      button: "#9aa9b8",
      shoe: "#10161c",
      eye: "#56a7ff",
      brow: "#7f6334",
      freckles: "#c68c6b",
    },
    matthew: {
      id: "matthew",
      name: "Agent M",
      likesLabel: "Likes",
      likes: "Subway Surfers and his bro Agent N",
      dislikes: "veggies",
      portraitBackdropTop: "#284036",
      portraitBackdropBottom: "#101a18",
      portraitAccent: "#8bc4ff",
      hairStyle: "crop",
      hair: "#8a6249",
      hairShadow: "#654733",
      skin: "#f2d4bc",
      skinShadow: "#d7b395",
      blush: "rgba(218, 142, 121, 0.28)",
      suit: "#202937",
      suitHighlight: "#41566f",
      suitEdge: "#2b3748",
      shirt: "#f3f5f8",
      shirtShadow: "#ced7df",
      tie: "#20344a",
      button: "#9aabba",
      shoe: "#111920",
      eye: "#6e7e52",
      brow: "#5f4332",
      freckles: "rgba(0,0,0,0)",
    },
    sarah: {
      id: "sarah",
      name: "Agent Mum",
      likesLabel: "Likes",
      likes: "sunshine, happy moods and her husband Agent Dad",
      dislikes: "arguing and bad moods",
      portraitBackdropTop: "#38435b",
      portraitBackdropBottom: "#151c28",
      portraitAccent: "#f1d26e",
      hairStyle: "bob",
      hair: "#d7be6d",
      hairShadow: "#b0974f",
      skin: "#efcfb7",
      skinShadow: "#d0ab8c",
      blush: "rgba(231, 150, 138, 0.26)",
      suit: "#283248",
      suitHighlight: "#4a5e83",
      suitEdge: "#334055",
      shirt: "#f6f2eb",
      shirtShadow: "#d9d3cb",
      tie: "#2f5d67",
      button: "#aeb8c6",
      shoe: "#121821",
      eye: "#5e7ea3",
      brow: "#927944",
      freckles: "rgba(0,0,0,0)",
      standingHeight: 164,
      duckHeight: 121,
      headOffset: 8,
    },
    mike: {
      id: "mike",
      name: "Agent Dad",
      likesLabel: "Likes",
      likes: "lego, computers and his wife Agent Mum",
      dislikes: "polluters",
      portraitBackdropTop: "#3a352f",
      portraitBackdropBottom: "#171513",
      portraitAccent: "#d8aa68",
      hairStyle: "bald",
      hair: "#5e4637",
      hairShadow: "#47352a",
      skin: "#c99872",
      skinShadow: "#aa7c5e",
      blush: "rgba(193, 115, 95, 0.16)",
      suit: "#262d37",
      suitHighlight: "#465565",
      suitEdge: "#303b48",
      shirt: "#f3f4f0",
      shirtShadow: "#d6d9d2",
      tie: "#6d7c8b",
      button: "#b2bcc8",
      shoe: "#11161d",
      eye: "#6f4f31",
      brow: "#4c3528",
      freckles: "rgba(0,0,0,0)",
      facialHair: "short-beard",
      facialHairColor: "#4e3426",
      standingHeight: 166,
      duckHeight: 122,
      headOffset: 8,
    },
  };
  const CHARACTER_LIST = Object.values(CHARACTER_PROFILES);

  const refs = {
    canvas: document.getElementById("game-canvas"),
    hud: document.getElementById("hud"),
    hudLocation: document.getElementById("hud-location"),
    hudLesson: document.getElementById("hud-lesson"),
    hudDistance: document.getElementById("hud-distance"),
    hudLives: document.getElementById("hud-lives"),
    hudLocks: document.getElementById("hud-locks"),
    muteButton: document.getElementById("mute-button"),
    toast: document.getElementById("toast"),
    guideWidget: document.getElementById("guide-widget"),
    guideCanvas: document.getElementById("guide-canvas"),
    guideName: document.getElementById("guide-name"),
    guideText: document.getElementById("guide-text"),
    menuScreen: document.getElementById("menu-screen"),
    challengeScreen: document.getElementById("challenge-screen"),
    gameOverScreen: document.getElementById("game-over-screen"),
    subjectSelector: document.getElementById("subject-selector"),
    yearSelector: document.getElementById("year-selector"),
    characterSelector: document.getElementById("character-selector"),
    missionSummary: document.getElementById("mission-summary"),
    menuTotalCorrect: document.getElementById("menu-total-correct"),
    menuBestDistance: document.getElementById("menu-best-distance"),
    menuTotalRuns: document.getElementById("menu-total-runs"),
    menuCurrentMission: document.getElementById("menu-current-mission"),
    playMainButton: document.getElementById("play-main-button"),
    playPracticeButton: document.getElementById("play-practice-button"),
    challengeForm: document.getElementById("challenge-form"),
    challengeMode: document.getElementById("challenge-mode"),
    challengeTitle: document.getElementById("challenge-title"),
    challengeDoor: document.getElementById("challenge-door"),
    challengeDoorStatus: document.getElementById("challenge-door-status"),
    challengeDoorDetail: document.getElementById("challenge-door-detail"),
    challengeBody: document.getElementById("challenge-body"),
    challengePuzzleArea: document.getElementById("challenge-puzzle-area"),
    challengeInputLabel: document.getElementById("challenge-input-label"),
    challengeInput: document.getElementById("challenge-input"),
    challengeAnswer: document.getElementById("challenge-answer"),
    challengeFeedback: document.getElementById("challenge-feedback"),
    challengeSpeak: document.getElementById("challenge-speak"),
    challengeSubmit: document.getElementById("challenge-submit"),
    challengeContinue: document.getElementById("challenge-continue"),
    challengeFace: document.getElementById("challenge-face"),
    challengeAlert: document.getElementById("challenge-alert"),
    gameOverTitle: document.getElementById("game-over-title"),
    gameOverBody: document.getElementById("game-over-body"),
    gameOverDistance: document.getElementById("game-over-distance"),
    gameOverCorrect: document.getElementById("game-over-correct"),
    gameOverLives: document.getElementById("game-over-lives"),
    gameOverStatus: document.getElementById("game-over-status"),
    retryButton: document.getElementById("retry-button"),
    menuButton: document.getElementById("menu-button"),
    touchControls: document.getElementById("touch-controls"),
    jumpButton: document.getElementById("jump-button"),
    duckButton: document.getElementById("duck-button"),
  };

  const ctx = refs.canvas.getContext("2d");
  const subjectMap = new Map(LESSON_SUBJECTS.map((subject) => [subject.id, subject]));
  const yearGroupMap = new Map(YEAR_GROUPS.map((year) => [year.id, year]));
  const characterMap = new Map(CHARACTER_LIST.map((character) => [character.id, character]));

  const state = {
    viewWidth: window.innerWidth,
    viewHeight: window.innerHeight,
    currentScreen: "menu",
    run: null,
    cutscene: null,
    challenge: null,
    challengeContinueMode: "resume",
    voiceEnabled: true,
    touchDuckHeld: false,
    keyDuckHeld: false,
    jumpQueued: false,
    lastTime: performance.now(),
    toastTimer: 0,
    guideTimer: 0,
    guideStatic: false,
    guideBreakupStaticTimer: 0,
    guideBreakupHideTimer: 0,
    launchOptions: {},
    lastRunConfig: null,
    lastVirtualJumpAt: 0,
  };

  let progress = loadProgress();

  function getViewportSize() {
    const viewport = window.visualViewport;
    if (viewport) {
      return {
        width: Math.max(320, Math.round(viewport.width)),
        height: Math.max(320, Math.round(viewport.height)),
      };
    }

    return {
      width: window.innerWidth,
      height: window.innerHeight,
    };
  }

  function createDefaultProgress() {
    return {
      totalCorrect: 0,
      totalWrong: 0,
      bestDistance: 0,
      totalRuns: 0,
      selectedSubjectId: DEFAULT_SUBJECT_ID,
      selectedYearGroup: DEFAULT_YEAR_GROUP,
      selectedCharacterId: DEFAULT_CHARACTER_ID,
      challengeStats: {},
      wordStats: {},
    };
  }

  function loadProgress() {
    const fallback = createDefaultProgress();
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return fallback;
      }
      const saved = JSON.parse(raw);
      const next = Object.assign({}, fallback, saved);
      next.challengeStats = next.challengeStats || {};
      next.wordStats = next.wordStats || {};
      next.selectedSubjectId = subjectMap.has(next.selectedSubjectId) ? next.selectedSubjectId : DEFAULT_SUBJECT_ID;
      next.selectedYearGroup = yearGroupMap.has(next.selectedYearGroup) ? next.selectedYearGroup : DEFAULT_YEAR_GROUP;
      next.selectedCharacterId = characterMap.has(next.selectedCharacterId) ? next.selectedCharacterId : DEFAULT_CHARACTER_ID;
      return next;
    } catch (error) {
      console.warn("Could not load saved progress:", error);
      return fallback;
    }
  }

  function saveProgress() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch (error) {
      console.warn("Could not save progress:", error);
    }
  }

  function getSubject(subjectId) {
    return subjectMap.get(subjectId) || LESSON_SUBJECTS[0];
  }

  function getYearGroup(yearGroupId) {
    return yearGroupMap.get(yearGroupId) || YEAR_GROUPS[2];
  }

  function getCharacter(characterId) {
    return characterMap.get(characterId) || CHARACTER_PROFILES[DEFAULT_CHARACTER_ID];
  }

  function getSelectedCharacter() {
    return getCharacter(progress.selectedCharacterId);
  }

  function getRunCharacter(run) {
    return getCharacter(run?.characterId || progress.selectedCharacterId);
  }

  function getSelectedMission() {
    return {
      subjectId: subjectMap.has(progress.selectedSubjectId) ? progress.selectedSubjectId : DEFAULT_SUBJECT_ID,
      yearGroup: yearGroupMap.has(progress.selectedYearGroup) ? progress.selectedYearGroup : DEFAULT_YEAR_GROUP,
      characterId: characterMap.has(progress.selectedCharacterId) ? progress.selectedCharacterId : DEFAULT_CHARACTER_ID,
    };
  }

  function getMissionLabel(subjectId, yearGroup) {
    return `${getSubject(subjectId).name} · ${getYearGroup(yearGroup).name}`;
  }

  function isTouchDevice() {
    return (
      navigator.maxTouchPoints > 0 ||
      "ontouchstart" in window ||
      window.matchMedia("(hover: none) and (pointer: coarse)").matches
    );
  }

  function showToast(message) {
    refs.toast.textContent = message;
    refs.toast.classList.add("visible");
    if (state.toastTimer) {
      window.clearTimeout(state.toastTimer);
    }
    state.toastTimer = window.setTimeout(() => {
      refs.toast.classList.remove("visible");
    }, 2600);
  }

  function setGuideVisible(visible) {
    refs.guideWidget.classList.toggle("is-hidden", !visible);
  }

  function createVirtualKeyEvent(key) {
    return {
      key,
      preventDefault() {},
    };
  }

  function pressVirtualArrow(key) {
    handleKeyDown(createVirtualKeyEvent(key));
  }

  function releaseVirtualArrow(key) {
    handleKeyUp(createVirtualKeyEvent(key));
  }

  function handleUpArrowButtonPress(event) {
    event.preventDefault();
    const now = performance.now();
    if (now - state.lastVirtualJumpAt < 360) {
      return;
    }
    state.lastVirtualJumpAt = now;
    pressVirtualArrow("ArrowUp");
  }

  function handleDownArrowButtonPress(event) {
    event.preventDefault();
    pressVirtualArrow("ArrowDown");
  }

  function handleDownArrowButtonRelease(event) {
    event.preventDefault();
    releaseVirtualArrow("ArrowDown");
  }

  function clearGuideBreakupSequence(resetPortrait = true) {
    if (state.guideBreakupStaticTimer) {
      window.clearTimeout(state.guideBreakupStaticTimer);
      state.guideBreakupStaticTimer = 0;
    }
    if (state.guideBreakupHideTimer) {
      window.clearTimeout(state.guideBreakupHideTimer);
      state.guideBreakupHideTimer = 0;
    }
    if (state.guideStatic) {
      state.guideStatic = false;
      if (resetPortrait) {
        drawGuidePortrait();
      }
    }
  }

  function speakGuide(message, onEnd) {
    if (!state.voiceEnabled || !("speechSynthesis" in window)) {
      if (onEnd) {
        window.setTimeout(onEnd, 300);
      }
      return;
    }

    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 1.01;
    utterance.pitch = 0.78;
    utterance.volume = 0.92;
    if (onEnd) {
      utterance.addEventListener("end", onEnd, { once: true });
    }
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  function getIdleGuideMessage() {
    return "";
  }

  function announceSelection(label) {
    showGuideMessage(`${label}, good choice!`, {
      speak: true,
      duration: 2600,
    });
  }

  function startGuideBreakupSequence() {
    clearGuideBreakupSequence(false);
    if (state.guideTimer) {
      window.clearTimeout(state.guideTimer);
      state.guideTimer = 0;
    }

    refs.guideName.textContent = "Mission Handler";
    refs.guideText.textContent = "We're breaking u..";
    state.guideStatic = false;
    setGuideVisible(true);
    drawGuidePortrait();

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      if (state.voiceEnabled) {
        const utterance = new SpeechSynthesisUtterance("We're breaking u");
        utterance.rate = 1.02;
        utterance.pitch = 0.78;
        utterance.volume = 0.92;
        window.speechSynthesis.speak(utterance);
      }
    }

    state.guideBreakupStaticTimer = window.setTimeout(() => {
      state.guideBreakupStaticTimer = 0;
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      state.guideStatic = true;
      drawGuidePortrait();
    }, GUIDE_BREAKUP_STATIC_MS);

    state.guideBreakupHideTimer = window.setTimeout(() => {
      state.guideBreakupHideTimer = 0;
      state.guideStatic = false;
      drawGuidePortrait();
      refs.guideText.textContent = getIdleGuideMessage();
      setGuideVisible(false);
    }, GUIDE_BREAKUP_HIDE_MS);
  }

  function showGuideMessage(message, options = {}) {
    const { speak = false, duration = 4200, sticky = false, hideOnEnd = false } = options;
    clearGuideBreakupSequence();
    setGuideVisible(true);
    refs.guideName.textContent = "Mission Handler";
    refs.guideText.textContent = message;

    if (state.guideTimer) {
      window.clearTimeout(state.guideTimer);
      state.guideTimer = 0;
    }

    if (speak) {
      speakGuide(message, hideOnEnd ? () => setGuideVisible(false) : null);
    } else if (hideOnEnd) {
      window.setTimeout(() => {
        setGuideVisible(false);
      }, duration);
    }

    if (!sticky) {
      state.guideTimer = window.setTimeout(() => {
        refs.guideText.textContent = getIdleGuideMessage();
      }, duration);
    }
  }

  function refreshGuideMessage() {
    if (state.guideTimer) {
      return;
    }
    refs.guideText.textContent = getIdleGuideMessage();
  }

  function drawGuidePortrait() {
    const canvas = refs.guideCanvas;
    const guideCtx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    guideCtx.clearRect(0, 0, width, height);

    const bg = guideCtx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, "rgba(37, 115, 138, 0.95)");
    bg.addColorStop(0.55, "rgba(16, 51, 66, 0.98)");
    bg.addColorStop(1, "rgba(5, 15, 22, 1)");
    guideCtx.fillStyle = bg;
    guideCtx.fillRect(0, 0, width, height);

    const glow = guideCtx.createRadialGradient(width * 0.5, height * 0.22, 8, width * 0.5, height * 0.22, width * 0.5);
    glow.addColorStop(0, "rgba(141, 247, 255, 0.24)");
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    guideCtx.fillStyle = glow;
    guideCtx.fillRect(0, 0, width, height);

    guideCtx.fillStyle = "rgba(0, 0, 0, 0.24)";
    guideCtx.beginPath();
    guideCtx.ellipse(width * 0.5, height - 28, 42, 12, 0, 0, Math.PI * 2);
    guideCtx.fill();

    guideCtx.fillStyle = "#16212d";
    guideCtx.beginPath();
    guideCtx.moveTo(width * 0.3, height - 8);
    guideCtx.lineTo(width * 0.39, height - 112);
    guideCtx.lineTo(width * 0.61, height - 112);
    guideCtx.lineTo(width * 0.7, height - 8);
    guideCtx.closePath();
    guideCtx.fill();

    guideCtx.fillStyle = "#f2f5f8";
    guideCtx.beginPath();
    guideCtx.moveTo(width * 0.45, height - 112);
    guideCtx.lineTo(width * 0.5, height - 84);
    guideCtx.lineTo(width * 0.55, height - 112);
    guideCtx.closePath();
    guideCtx.fill();

    guideCtx.fillStyle = "#0f1720";
    guideCtx.beginPath();
    guideCtx.moveTo(width * 0.5, height - 108);
    guideCtx.lineTo(width * 0.54, height - 80);
    guideCtx.lineTo(width * 0.5, height - 48);
    guideCtx.lineTo(width * 0.46, height - 80);
    guideCtx.closePath();
    guideCtx.fill();

    guideCtx.fillStyle = "#d3b194";
    guideCtx.fillRect(width * 0.47, height - 132, width * 0.06, 18);

    const faceGradient = guideCtx.createLinearGradient(0, height - 212, 0, height - 108);
    faceGradient.addColorStop(0, "#f1d8c4");
    faceGradient.addColorStop(1, "#d7b79d");
    guideCtx.fillStyle = faceGradient;
    guideCtx.beginPath();
    guideCtx.ellipse(width * 0.5, height - 154, 38, 46, 0, 0, Math.PI * 2);
    guideCtx.fill();

    guideCtx.fillStyle = "#7b573f";
    guideCtx.beginPath();
    guideCtx.moveTo(width * 0.32, height - 168);
    guideCtx.quadraticCurveTo(width * 0.4, height - 200, width * 0.54, height - 198);
    guideCtx.quadraticCurveTo(width * 0.66, height - 195, width * 0.7, height - 170);
    guideCtx.quadraticCurveTo(width * 0.63, height - 158, width * 0.56, height - 154);
    guideCtx.quadraticCurveTo(width * 0.49, height - 150, width * 0.43, height - 150);
    guideCtx.quadraticCurveTo(width * 0.36, height - 151, width * 0.32, height - 168);
    guideCtx.closePath();
    guideCtx.fill();

    guideCtx.fillStyle = "#6c4936";
    guideCtx.beginPath();
    guideCtx.moveTo(width * 0.38, height - 166);
    guideCtx.quadraticCurveTo(width * 0.46, height - 178, width * 0.58, height - 176);
    guideCtx.quadraticCurveTo(width * 0.63, height - 174, width * 0.66, height - 164);
    guideCtx.quadraticCurveTo(width * 0.58, height - 162, width * 0.51, height - 155);
    guideCtx.quadraticCurveTo(width * 0.43, height - 149, width * 0.38, height - 166);
    guideCtx.closePath();
    guideCtx.fill();

    guideCtx.fillStyle = "#10161d";
    guideCtx.fillRect(width * 0.36, height - 164, width * 0.28, 16);
    guideCtx.beginPath();
    guideCtx.arc(width * 0.38, height - 156, 12, 0, Math.PI * 2);
    guideCtx.arc(width * 0.62, height - 156, 12, 0, Math.PI * 2);
    guideCtx.fill();

    guideCtx.strokeStyle = "#d4dde4";
    guideCtx.lineWidth = 2;
    guideCtx.beginPath();
    guideCtx.moveTo(width * 0.44, height - 156);
    guideCtx.lineTo(width * 0.56, height - 156);
    guideCtx.stroke();

    guideCtx.strokeStyle = "rgba(255,255,255,0.2)";
    guideCtx.lineWidth = 1.5;
    guideCtx.beginPath();
    guideCtx.moveTo(width * 0.36, height - 161);
    guideCtx.lineTo(width * 0.64, height - 161);
    guideCtx.stroke();

    guideCtx.strokeStyle = "#bccad4";
    guideCtx.lineWidth = 5;
    guideCtx.beginPath();
    guideCtx.moveTo(width * 0.69, height - 145);
    guideCtx.quadraticCurveTo(width * 0.82, height - 134, width * 0.82, height - 112);
    guideCtx.stroke();

    guideCtx.fillStyle = "#ced7de";
    guideCtx.beginPath();
    guideCtx.moveTo(width * 0.76, height - 138);
    guideCtx.lineTo(width * 0.88, height - 138);
    guideCtx.quadraticCurveTo(width * 0.92, height - 138, width * 0.92, height - 130);
    guideCtx.lineTo(width * 0.92, height - 122);
    guideCtx.quadraticCurveTo(width * 0.92, height - 114, width * 0.88, height - 114);
    guideCtx.lineTo(width * 0.76, height - 114);
    guideCtx.quadraticCurveTo(width * 0.72, height - 114, width * 0.72, height - 122);
    guideCtx.lineTo(width * 0.72, height - 130);
    guideCtx.quadraticCurveTo(width * 0.72, height - 138, width * 0.76, height - 138);
    guideCtx.closePath();
    guideCtx.fill();

    guideCtx.strokeStyle = "rgba(100, 229, 255, 0.54)";
    guideCtx.lineWidth = 2.5;
    guideCtx.beginPath();
    guideCtx.moveTo(width * 0.24, 20);
    guideCtx.lineTo(width * 0.76, 20);
    guideCtx.stroke();

    if (state.guideStatic) {
      guideCtx.fillStyle = "rgba(255,255,255,0.05)";
      guideCtx.fillRect(0, 0, width, height);
      for (let line = 0; line < 18; line += 1) {
        const y = (line / 18) * height;
        guideCtx.fillStyle = line % 2 === 0 ? "rgba(120, 230, 255, 0.14)" : "rgba(255,255,255,0.06)";
        guideCtx.fillRect(0, y, width, 4);
      }
      for (let noise = 0; noise < 54; noise += 1) {
        guideCtx.fillStyle = Math.random() > 0.5 ? "rgba(255,255,255,0.32)" : "rgba(125,235,255,0.24)";
        guideCtx.fillRect(rand(0, width - 18), rand(0, height - 4), rand(8, 36), rand(1, 4));
      }
    }
  }

  function showScreen(screenId) {
    refs.menuScreen.classList.remove("active");
    refs.challengeScreen.classList.remove("active");
    refs.gameOverScreen.classList.remove("active");
    refs.hud.classList.add("hidden");

    if (!screenId) {
      state.currentScreen = "playing";
      setGuideVisible(true);
      refs.hud.classList.remove("hidden");
      refs.touchControls.classList.toggle("hidden", !isTouchDevice());
      refreshGuideMessage();
      return;
    }

    state.currentScreen = screenId;
    refs.touchControls.classList.add("hidden");

    if (screenId === "menu") {
      setGuideVisible(true);
      refs.menuScreen.classList.add("active");
    } else if (screenId === "challenge") {
      setGuideVisible(true);
      refs.challengeScreen.classList.add("active");
      refs.hud.classList.remove("hidden");
    } else if (screenId === "game-over") {
      setGuideVisible(false);
      refs.gameOverScreen.classList.add("active");
    } else if (screenId === "confinement") {
      setGuideVisible(false);
    }

    refreshGuideMessage();
  }

  function updateStaticUI() {
    const mission = getSelectedMission();
    const missionLabel = getMissionLabel(mission.subjectId, mission.yearGroup);
    refs.menuTotalCorrect.textContent = progress.totalCorrect;
    refs.menuBestDistance.textContent = `${Math.floor(progress.bestDistance)}m`;
    refs.menuTotalRuns.textContent = progress.totalRuns;
    refs.menuCurrentMission.textContent = missionLabel;
    refs.missionSummary.textContent = `Mission loaded: ${missionLabel}`;
    refs.playMainButton.textContent = `Start ${getSubject(mission.subjectId).name} Mission`;
    refs.playPracticeButton.textContent = `Practice ${getSubject(mission.subjectId).name}`;
    refs.muteButton.textContent = `Voice: ${state.voiceEnabled ? "On" : "Off"}`;
    refs.muteButton.setAttribute("aria-pressed", String(state.voiceEnabled));
    if (!state.run) {
      refs.hudLocation.textContent = MISSION_WORLD.name;
      refs.hudLesson.textContent = missionLabel;
      refs.hudDistance.textContent = "0m";
      refs.hudLives.textContent = "3";
      refs.hudLocks.textContent = "0";
    }
  }

  function renderSubjectSelector() {
    const mission = getSelectedMission();
    refs.subjectSelector.innerHTML = LESSON_SUBJECTS.map((subject) => `
      <button
        class="action choice-button ${subject.id === mission.subjectId ? "selected" : ""}"
        type="button"
        data-select-subject="${subject.id}">
        ${subject.name}
      </button>
    `).join("");
  }

  function renderYearSelector() {
    const mission = getSelectedMission();
    refs.yearSelector.innerHTML = YEAR_GROUPS.map((yearGroup) => `
      <button
        class="action choice-button ${yearGroup.id === mission.yearGroup ? "selected" : ""}"
        type="button"
        data-select-year="${yearGroup.id}">
        ${yearGroup.name}
      </button>
    `).join("");
  }

  function renderCharacterSelector() {
    const mission = getSelectedMission();
    refs.characterSelector.innerHTML = CHARACTER_LIST.map((character) => `
      <button
        class="character-card ${character.id === mission.characterId ? "selected" : ""}"
        type="button"
        data-select-character="${character.id}">
        <canvas
          class="character-portrait-canvas"
          data-character-portrait="${character.id}"
          width="220"
          height="170"
          aria-hidden="true"></canvas>
        <div class="character-copy">
          <h4>${character.name}</h4>
          <p><strong>Name:</strong> ${character.name}</p>
          <p><strong>${character.likesLabel}:</strong> ${character.likes}</p>
          <p><strong>Dislikes:</strong> ${character.dislikes}</p>
        </div>
      </button>
    `).join("");
  }

  function paintCharacterPortraits() {
    refs.characterSelector.querySelectorAll("[data-character-portrait]").forEach((canvas) => {
      const character = getCharacter(canvas.dataset.characterPortrait);
      const portraitCtx = canvas.getContext("2d");
      if (!portraitCtx || !character) {
        return;
      }

      const width = canvas.width;
      const height = canvas.height;
      portraitCtx.clearRect(0, 0, width, height);

      const bg = portraitCtx.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, character.portraitBackdropTop);
      bg.addColorStop(1, character.portraitBackdropBottom);
      portraitCtx.fillStyle = bg;
      portraitCtx.fillRect(0, 0, width, height);

      portraitCtx.fillStyle = "rgba(255,255,255,0.08)";
      portraitCtx.fillRect(0, height - 38, width, 38);

      portraitCtx.fillStyle = "rgba(0,0,0,0.18)";
      portraitCtx.beginPath();
      portraitCtx.ellipse(width * 0.5, height - 24, 42, 12, 0, 0, Math.PI * 2);
      portraitCtx.fill();

      portraitCtx.fillStyle = character.suit;
      portraitCtx.beginPath();
      portraitCtx.moveTo(width * 0.28, height - 10);
      portraitCtx.lineTo(width * 0.4, height - 84);
      portraitCtx.lineTo(width * 0.6, height - 84);
      portraitCtx.lineTo(width * 0.72, height - 10);
      portraitCtx.closePath();
      portraitCtx.fill();

      portraitCtx.fillStyle = character.shirt;
      portraitCtx.beginPath();
      portraitCtx.moveTo(width * 0.46, height - 84);
      portraitCtx.lineTo(width * 0.5, height - 58);
      portraitCtx.lineTo(width * 0.54, height - 84);
      portraitCtx.closePath();
      portraitCtx.fill();

      portraitCtx.fillStyle = character.tie;
      portraitCtx.beginPath();
      portraitCtx.moveTo(width * 0.5, height - 80);
      portraitCtx.lineTo(width * 0.53, height - 58);
      portraitCtx.lineTo(width * 0.5, height - 32);
      portraitCtx.lineTo(width * 0.47, height - 58);
      portraitCtx.closePath();
      portraitCtx.fill();

      portraitCtx.fillStyle = character.skinShadow;
      portraitCtx.fillRect(width * 0.47, height - 102, width * 0.06, 16);

      portraitCtx.fillStyle = character.skin;
      portraitCtx.beginPath();
      portraitCtx.ellipse(width * 0.5, height - 120, 36, 44, 0, 0, Math.PI * 2);
      portraitCtx.fill();

      portraitCtx.fillStyle = character.blush;
      portraitCtx.beginPath();
      portraitCtx.ellipse(width * 0.44, height - 110, 8, 5, 0, 0, Math.PI * 2);
      portraitCtx.ellipse(width * 0.57, height - 108, 8, 5, 0, 0, Math.PI * 2);
      portraitCtx.fill();

      portraitCtx.fillStyle = character.hairShadow;
      if (character.hairStyle === "ponytail") {
        portraitCtx.beginPath();
        portraitCtx.ellipse(width * 0.5, height - 138, 31, 16, 0, 0, Math.PI * 2);
        portraitCtx.ellipse(width * 0.39, height - 122, 14, 26, -0.15, 0, Math.PI * 2);
        portraitCtx.ellipse(width * 0.35, height - 104, 11, 20, -0.18, 0, Math.PI * 2);
        portraitCtx.fill();
        portraitCtx.beginPath();
        portraitCtx.moveTo(width * 0.34, height - 112);
        portraitCtx.quadraticCurveTo(width * 0.24, height - 118, width * 0.21, height - 96);
        portraitCtx.quadraticCurveTo(width * 0.25, height - 78, width * 0.36, height - 88);
        portraitCtx.closePath();
        portraitCtx.fill();
      } else if (character.hairStyle === "crop") {
        portraitCtx.beginPath();
        portraitCtx.ellipse(width * 0.5, height - 137, 28, 12, 0, 0, Math.PI * 2);
        portraitCtx.ellipse(width * 0.41, height - 128, 7.2, 12.2, -0.12, 0, Math.PI * 2);
        portraitCtx.ellipse(width * 0.59, height - 127, 6.8, 11.6, 0.12, 0, Math.PI * 2);
        portraitCtx.fill();
      } else if (character.hairStyle === "bob") {
        portraitCtx.beginPath();
        portraitCtx.ellipse(width * 0.39, height - 112, 12, 28, -0.1, 0, Math.PI * 2);
        portraitCtx.ellipse(width * 0.61, height - 112, 12, 28, 0.1, 0, Math.PI * 2);
        portraitCtx.ellipse(width * 0.5, height - 135, 33, 18, 0, 0, Math.PI * 2);
        portraitCtx.fill();
      } else if (character.hairStyle === "bald") {
        portraitCtx.fillStyle = "rgba(0,0,0,0.08)";
        portraitCtx.beginPath();
        portraitCtx.ellipse(width * 0.5, height - 138, 19, 7, 0, 0, Math.PI * 2);
        portraitCtx.fill();
        portraitCtx.fillStyle = "rgba(0,0,0,0.05)";
        portraitCtx.beginPath();
        portraitCtx.ellipse(width * 0.42, height - 126, 3, 7, -0.1, 0, Math.PI * 2);
        portraitCtx.ellipse(width * 0.58, height - 126, 3, 7, 0.1, 0, Math.PI * 2);
        portraitCtx.fill();
      }

      portraitCtx.fillStyle = character.hair;
      if (character.hairStyle === "ponytail") {
        portraitCtx.beginPath();
        portraitCtx.arc(width * 0.5, height - 132, 38, Math.PI * 0.84, Math.PI * 1.99);
        portraitCtx.fill();
        portraitCtx.beginPath();
        portraitCtx.moveTo(width * 0.34, height - 122);
        portraitCtx.quadraticCurveTo(width * 0.47, height - 156, width * 0.66, height - 130);
        portraitCtx.quadraticCurveTo(width * 0.61, height - 118, width * 0.54, height - 112);
        portraitCtx.quadraticCurveTo(width * 0.42, height - 103, width * 0.34, height - 122);
        portraitCtx.closePath();
        portraitCtx.fill();
        portraitCtx.beginPath();
        portraitCtx.moveTo(width * 0.36, height - 108);
        portraitCtx.quadraticCurveTo(width * 0.24, height - 114, width * 0.2, height - 96);
        portraitCtx.quadraticCurveTo(width * 0.21, height - 74, width * 0.32, height - 72);
        portraitCtx.quadraticCurveTo(width * 0.29, height - 87, width * 0.36, height - 108);
        portraitCtx.closePath();
        portraitCtx.fill();
        portraitCtx.fillStyle = character.hairShadow;
        portraitCtx.fillRect(width * 0.33, height - 104, 8, 10);
      } else if (character.hairStyle === "crop") {
        portraitCtx.beginPath();
        portraitCtx.moveTo(width * 0.33, height - 133);
        portraitCtx.quadraticCurveTo(width * 0.43, height - 160, width * 0.61, height - 151);
        portraitCtx.quadraticCurveTo(width * 0.69, height - 146, width * 0.68, height - 132);
        portraitCtx.quadraticCurveTo(width * 0.64, height - 125, width * 0.57, height - 121);
        portraitCtx.quadraticCurveTo(width * 0.5, height - 124, width * 0.45, height - 126);
        portraitCtx.quadraticCurveTo(width * 0.39, height - 123, width * 0.34, height - 119);
        portraitCtx.quadraticCurveTo(width * 0.32, height - 124, width * 0.33, height - 133);
        portraitCtx.closePath();
        portraitCtx.fill();
        portraitCtx.beginPath();
        portraitCtx.moveTo(width * 0.38, height - 134);
        portraitCtx.quadraticCurveTo(width * 0.47, height - 147, width * 0.6, height - 143);
        portraitCtx.quadraticCurveTo(width * 0.64, height - 139, width * 0.63, height - 130);
        portraitCtx.quadraticCurveTo(width * 0.58, height - 125, width * 0.55, height - 122);
        portraitCtx.quadraticCurveTo(width * 0.5, height - 125, width * 0.46, height - 126);
        portraitCtx.quadraticCurveTo(width * 0.41, height - 124, width * 0.37, height - 121);
        portraitCtx.quadraticCurveTo(width * 0.36, height - 126, width * 0.38, height - 134);
        portraitCtx.closePath();
        portraitCtx.fill();
        portraitCtx.strokeStyle = "rgba(255,255,255,0.22)";
        portraitCtx.lineWidth = 1.8;
        portraitCtx.beginPath();
        portraitCtx.moveTo(width * 0.5, height - 143);
        portraitCtx.quadraticCurveTo(width * 0.55, height - 136, width * 0.58, height - 126);
        portraitCtx.stroke();
      } else if (character.hairStyle === "bob") {
        portraitCtx.beginPath();
        portraitCtx.moveTo(width * 0.31, height - 128);
        portraitCtx.quadraticCurveTo(width * 0.37, height - 158, width * 0.56, height - 149);
        portraitCtx.quadraticCurveTo(width * 0.68, height - 144, width * 0.68, height - 121);
        portraitCtx.quadraticCurveTo(width * 0.67, height - 87, width * 0.61, height - 64);
        portraitCtx.quadraticCurveTo(width * 0.55, height - 64, width * 0.51, height - 60);
        portraitCtx.quadraticCurveTo(width * 0.5, height - 84, width * 0.5, height - 104);
        portraitCtx.quadraticCurveTo(width * 0.5, height - 84, width * 0.49, height - 60);
        portraitCtx.quadraticCurveTo(width * 0.45, height - 64, width * 0.39, height - 64);
        portraitCtx.quadraticCurveTo(width * 0.33, height - 87, width * 0.31, height - 128);
        portraitCtx.closePath();
        portraitCtx.fill();
        portraitCtx.beginPath();
        portraitCtx.moveTo(width * 0.5, height - 142);
        portraitCtx.quadraticCurveTo(width * 0.55, height - 136, width * 0.59, height - 122);
        portraitCtx.strokeStyle = "rgba(255,255,255,0.18)";
        portraitCtx.lineWidth = 1.7;
        portraitCtx.stroke();
      } else if (character.hairStyle === "bald") {
        portraitCtx.strokeStyle = "rgba(255,255,255,0.22)";
        portraitCtx.lineWidth = 1.8;
        portraitCtx.beginPath();
        portraitCtx.moveTo(width * 0.43, height - 141);
        portraitCtx.quadraticCurveTo(width * 0.5, height - 149, width * 0.57, height - 140);
        portraitCtx.stroke();
      }

      portraitCtx.fillStyle = "#ffffff";
      portraitCtx.beginPath();
      portraitCtx.ellipse(width * 0.46, height - 120, 6, 8, 0, 0, Math.PI * 2);
      portraitCtx.ellipse(width * 0.56, height - 119, 6, 8, 0, 0, Math.PI * 2);
      portraitCtx.fill();

      portraitCtx.fillStyle = character.eye;
      portraitCtx.beginPath();
      portraitCtx.arc(width * 0.46, height - 119, 2.8, 0, Math.PI * 2);
      portraitCtx.arc(width * 0.56, height - 118, 2.8, 0, Math.PI * 2);
      portraitCtx.fill();

      portraitCtx.fillStyle = "#10151b";
      portraitCtx.beginPath();
      portraitCtx.arc(width * 0.46, height - 119, 1.1, 0, Math.PI * 2);
      portraitCtx.arc(width * 0.56, height - 118, 1.1, 0, Math.PI * 2);
      portraitCtx.fill();

      portraitCtx.strokeStyle = character.brow;
      portraitCtx.lineWidth = 2;
      portraitCtx.beginPath();
      portraitCtx.moveTo(width * 0.42, height - 128);
      portraitCtx.lineTo(width * 0.48, height - 130);
      portraitCtx.moveTo(width * 0.54, height - 129);
      portraitCtx.lineTo(width * 0.6, height - 127);
      portraitCtx.stroke();

      if (character.freckles && character.freckles !== "rgba(0,0,0,0)") {
        portraitCtx.fillStyle = character.freckles;
        portraitCtx.beginPath();
        portraitCtx.arc(width * 0.47, height - 108, 1, 0, Math.PI * 2);
        portraitCtx.arc(width * 0.5, height - 106, 1, 0, Math.PI * 2);
        portraitCtx.arc(width * 0.54, height - 108, 1, 0, Math.PI * 2);
        portraitCtx.fill();
      }

      if (character.facialHair === "short-beard") {
        portraitCtx.fillStyle = character.facialHairColor || character.hairShadow;
        portraitCtx.beginPath();
        portraitCtx.ellipse(width * 0.5, height - 94, 12, 9, 0, 0, Math.PI * 2);
        portraitCtx.ellipse(width * 0.5, height - 100, 8, 3.8, 0, 0, Math.PI * 2);
        portraitCtx.fill();
        portraitCtx.strokeStyle = "rgba(255,255,255,0.14)";
        portraitCtx.lineWidth = 1.3;
        portraitCtx.beginPath();
        portraitCtx.moveTo(width * 0.46, height - 98);
        portraitCtx.quadraticCurveTo(width * 0.5, height - 95, width * 0.54, height - 98);
        portraitCtx.stroke();
      }

      portraitCtx.strokeStyle = "rgba(107,74,52,0.5)";
      portraitCtx.lineWidth = 1.4;
      portraitCtx.beginPath();
      portraitCtx.moveTo(width * 0.5, height - 116);
      portraitCtx.quadraticCurveTo(width * 0.51, height - 108, width * 0.49, height - 104);
      portraitCtx.stroke();

      portraitCtx.strokeStyle = "#131b22";
      portraitCtx.lineWidth = 2.2;
      portraitCtx.beginPath();
      portraitCtx.moveTo(width * 0.46, height - 96);
      portraitCtx.quadraticCurveTo(width * 0.5, height - 90, width * 0.55, height - 96);
      portraitCtx.stroke();

      portraitCtx.strokeStyle = "rgba(255,255,255,0.16)";
      portraitCtx.lineWidth = 3;
      portraitCtx.beginPath();
      portraitCtx.moveTo(16, 20);
      portraitCtx.lineTo(width - 16, 20);
      portraitCtx.stroke();

      portraitCtx.fillStyle = character.portraitAccent;
      portraitCtx.fillRect(16, 20, 54, 4);
    });
  }

  function refreshAllUI() {
    updateStaticUI();
    renderSubjectSelector();
    renderYearSelector();
    renderCharacterSelector();
    paintCharacterPortraits();
    drawGuidePortrait();
    refreshGuideMessage();
    saveProgress();
  }

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const viewport = getViewportSize();
    document.documentElement.classList.toggle("touch-device", isTouchDevice());
    state.viewWidth = viewport.width;
    state.viewHeight = viewport.height;
    refs.canvas.width = Math.floor(state.viewWidth * dpr);
    refs.canvas.height = Math.floor(state.viewHeight * dpr);
    refs.canvas.style.width = `${state.viewWidth}px`;
    refs.canvas.style.height = `${state.viewHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (state.run) {
      state.run.groundY = getGroundY();
      state.run.player.x = state.viewWidth * 0.22;
    }
  }

  function getGroundY() {
    return state.viewHeight * 0.8;
  }

  function getLessonPool(subjectId, yearGroup) {
    const subjectPools = LESSON_BANKS[subjectId] || LESSON_BANKS[DEFAULT_SUBJECT_ID];
    return subjectPools[yearGroup] || subjectPools[DEFAULT_YEAR_GROUP] || LESSON_BANKS[DEFAULT_SUBJECT_ID][DEFAULT_YEAR_GROUP];
  }

  function getChallengeKey(challenge) {
    return challenge.id || `${challenge.subjectId}:${challenge.yearGroup}:${challenge.answer}`;
  }

  function getChallengeStats(challenge) {
    const key = getChallengeKey(challenge);
    return progress.challengeStats[key] || { correct: 0, wrong: 0 };
  }

  function chooseChallenge(run) {
    const pool = getLessonPool(run.subjectId, run.yearGroup);
    const recentKeys = new Set(run.recentChallengeKeys || []);
    const sourcePool = pool.filter((challenge) => !recentKeys.has(getChallengeKey(challenge)));
    const activePool = sourcePool.length ? sourcePool : pool;
    const weighted = [];

    for (const challenge of activePool) {
      const stats = getChallengeStats(challenge);
      const weight = run.mode === "practice"
        ? clamp(1 + stats.wrong * 2 - stats.correct, 1, 8)
        : clamp(1 + stats.wrong - stats.correct * 0.5, 1, 4);

      for (let index = 0; index < weight; index += 1) {
        weighted.push(challenge);
      }
    }

    const selected = weighted.length ? choice(weighted) : activePool[0];
    if (selected) {
      run.recentChallengeKeys = [...(run.recentChallengeKeys || []), getChallengeKey(selected)].slice(-4);
    }
    return selected;
  }

  function choosePuzzleMode(challenge, run) {
    const modes = PUZZLE_ROTATIONS[challenge.subjectId] || ["text"];
    return modes[(run.locksOpened + run.wrongAnswers) % modes.length];
  }

  function buildChoiceOptions(challenge) {
    const correctValue = challenge.acceptedAnswers[0];
    const options = [{ value: correctValue, label: challenge.answer, correct: true }];
    const seen = new Set(challenge.acceptedAnswers);
    const distractors = [];

    function collectFromPool(pool) {
      for (const item of pool) {
        const itemValue = item.acceptedAnswers[0];
        if (!seen.has(itemValue)) {
          seen.add(itemValue);
          distractors.push({
            value: itemValue,
            label: item.answer,
            correct: false,
          });
        }
      }
    }

    collectFromPool(getLessonPool(challenge.subjectId, challenge.yearGroup));

    if (distractors.length < 2) {
      const subjectPools = LESSON_BANKS[challenge.subjectId] || {};
      for (const pool of Object.values(subjectPools)) {
        collectFromPool(pool);
        if (distractors.length >= 2) {
          break;
        }
      }
    }

    if (!distractors.length) {
      return [];
    }

    return shuffle(options.concat(distractors.slice(0, 2)));
  }

  function createChallengeSession(baseChallenge, run) {
    const session = {
      ...baseChallenge,
      acceptedAnswers: [...baseChallenge.acceptedAnswers],
      interfaceType: choosePuzzleMode(baseChallenge, run),
      options: [],
      selectedOptionIndex: -1,
      resolved: false,
    };

    if (session.interfaceType !== "text") {
      session.options = buildChoiceOptions(baseChallenge);
      if (session.options.length < 2) {
        session.interfaceType = "text";
      }
    }

    return session;
  }

  function setDoorState(doorState, detailText) {
    refs.challengeDoor.dataset.doorState = doorState;

    if (doorState === "open") {
      refs.challengeDoorStatus.textContent = "Door Open";
    } else if (doorState === "error") {
      refs.challengeDoorStatus.textContent = "Access Denied";
    } else if (doorState === "alarm") {
      refs.challengeDoorStatus.textContent = "Alarm Triggered";
    } else {
      refs.challengeDoorStatus.textContent = "Door Sealed";
    }

    refs.challengeDoorDetail.textContent = detailText || DOOR_DETAIL_BY_MODE[state.challenge?.interfaceType || "text"];
  }

  function syncPuzzleSelection() {
    const challenge = state.challenge;
    if (!challenge) {
      return;
    }

    refs.challengePuzzleArea.querySelectorAll("[data-option-index]").forEach((button) => {
      const active = Number(button.dataset.optionIndex) === challenge.selectedOptionIndex;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    if (challenge.interfaceType === "keycard") {
      const selectedLabel = challenge.selectedOptionIndex >= 0
        ? challenge.options[challenge.selectedOptionIndex].label
        : "Select an answer chip";
      const status = refs.challengePuzzleArea.querySelector("[data-keycard-answer]");
      if (status) {
        status.textContent = selectedLabel;
      }
    }
  }

  function renderChallengePuzzle() {
    const challenge = state.challenge;
    if (!challenge) {
      refs.challengePuzzleArea.innerHTML = "";
      return;
    }

    refs.challengeInputLabel.hidden = challenge.interfaceType !== "text";
    refs.challengeInput.hidden = challenge.interfaceType !== "text";
    refs.challengeInput.disabled = false;
    refs.challengeSubmit.hidden = challenge.interfaceType === "wires" || challenge.interfaceType === "power";
    refs.challengeSubmit.disabled = false;
    refs.challengeSubmit.textContent = challenge.interfaceType === "keycard" ? "Swipe Keycard" : "Unlock Door";

    if (challenge.interfaceType === "text") {
      refs.challengePuzzleArea.innerHTML = `
        <div class="puzzle-panel text-console">
          <p class="puzzle-instruction">Type the exact lesson answer into the keypad to open the security door.</p>
          <div class="text-console-display">Lesson key required</div>
          <div class="text-console-grid" aria-hidden="true">
            <div class="text-console-key">CODE</div>
            <div class="text-console-key">LEARN</div>
            <div class="text-console-key">OPEN</div>
            <div class="text-console-key">SCAN</div>
            <div class="text-console-key">CHECK</div>
            <div class="text-console-key">GO</div>
          </div>
        </div>
      `;
      return;
    }

    const optionButtons = challenge.options.map((option, index) => {
      const label = escapeHtml(option.label);
      const colorClass = WIRE_COLOR_CLASSES[index % WIRE_COLOR_CLASSES.length];

      if (challenge.interfaceType === "wires") {
        return `
          <button class="puzzle-option wire-row ${colorClass}" type="button" data-option-index="${index}" aria-pressed="false">
            <span class="wire-node">${index + 1}</span>
            <span class="wire-line"></span>
            <span class="wire-terminal">${label}</span>
          </button>
        `;
      }

      if (challenge.interfaceType === "power") {
        return `
          <button class="puzzle-option power-route" type="button" data-option-index="${index}" aria-pressed="false">
            <span class="power-lane">
              <span class="power-spark" aria-hidden="true"></span>
              <span class="power-column"><span class="power-fill" style="--fill-level: ${56 + index * 10}%"></span></span>
              <span class="power-label">${label}</span>
            </span>
          </button>
        `;
      }

      return `
        <button class="puzzle-option keycard-chip" type="button" data-option-index="${index}" aria-pressed="false">
          ${label}
        </button>
      `;
    }).join("");

    if (challenge.interfaceType === "wires") {
      refs.challengePuzzleArea.innerHTML = `
        <div class="puzzle-panel">
          <p class="puzzle-instruction">Tap the wire carrying the correct lesson answer to route the door lock.</p>
          <div class="wire-grid">${optionButtons}</div>
        </div>
      `;
      return;
    }

    if (challenge.interfaceType === "power") {
      refs.challengePuzzleArea.innerHTML = `
        <div class="puzzle-panel">
          <p class="puzzle-instruction">Tap the right lesson channel to send power into the door.</p>
          <div class="power-grid">${optionButtons}</div>
        </div>
      `;
      return;
    }

    refs.challengePuzzleArea.innerHTML = `
      <div class="puzzle-panel keycard-panel">
        <p class="puzzle-instruction">Pick the right answer chip, then swipe the pass through the reader.</p>
        <div class="keycard-preview">
          <div class="keycard-status">
            <strong>Agent Pass Loaded</strong>
            <span data-keycard-answer>Select an answer chip</span>
          </div>
        </div>
        <div class="keycard-chips">${optionButtons}</div>
      </div>
    `;
    refs.challengeSubmit.disabled = true;
    syncPuzzleSelection();
  }

  function recordChallengeResult(challenge, correct) {
    const key = getChallengeKey(challenge);
    const stats = progress.challengeStats[key] || { correct: 0, wrong: 0 };
    if (correct) {
      stats.correct += 1;
      progress.totalCorrect += 1;
    } else {
      stats.wrong += 1;
      progress.totalWrong += 1;
    }
    progress.challengeStats[key] = stats;

    if (challenge.subjectId === "spelling") {
      const wordKey = normalizeAnswer(challenge.answer);
      const wordStats = progress.wordStats[wordKey] || { correct: 0, wrong: 0 };
      if (correct) {
        wordStats.correct += 1;
      } else {
        wordStats.wrong += 1;
      }
      progress.wordStats[wordKey] = wordStats;
    }

    saveProgress();
    refreshAllUI();
  }

  function resetChallengeUI() {
    refs.challengeScreen.classList.remove("success-state");
    refs.challengeScreen.classList.remove("alarm-state");
    refs.challengeAlert.hidden = true;
    refs.challengeFace.textContent = ":|";
    refs.challengeAnswer.hidden = true;
    refs.challengeAnswer.textContent = "";
    refs.challengeFeedback.textContent = "";
    refs.challengePuzzleArea.innerHTML = "";
    refs.challengeInput.value = "";
    refs.challengeInput.hidden = false;
    refs.challengeInput.disabled = false;
    refs.challengeInputLabel.hidden = false;
    refs.challengeSubmit.hidden = false;
    refs.challengeSubmit.disabled = false;
    refs.challengeSubmit.textContent = "Unlock Door";
    refs.challengeContinue.hidden = true;
    refs.challengeContinue.textContent = "Continue Mission";
    setDoorState("sealed", "Security panel waiting");
    state.challengeContinueMode = "resume";
  }

  function openChallenge() {
    if (!state.run || state.challenge) {
      return;
    }

    const run = state.run;
    run.nextChallengeAt += run.mode === "practice" ? 105 : 135;
    state.challenge = createChallengeSession(chooseChallenge(run), run);

    resetChallengeUI();

    const missionLabel = getMissionLabel(state.challenge.subjectId, state.challenge.yearGroup);
    refs.challengeMode.textContent = `${missionLabel} · ${PUZZLE_LABELS[state.challenge.interfaceType]}`;
    refs.challengeTitle.textContent = state.challenge.title;
    refs.challengeBody.textContent = `A sealed corridor door is ahead. ${state.challenge.prompt} Solve this ${getSubject(state.challenge.subjectId).name.toLowerCase()} lock to keep the mission moving.`;
    refs.challengeInputLabel.textContent = state.challenge.inputLabel;
    refs.challengeInput.placeholder = state.challenge.subjectId === "spelling"
      ? "Type the code word"
      : "Type the unlock answer";
    setDoorState("sealed");
    renderChallengePuzzle();

    showScreen("challenge");
    speakCurrentChallenge();

    window.requestAnimationFrame(() => {
      if (state.challenge?.interfaceType === "text") {
        refs.challengeInput.focus();
      } else {
        refs.challengePuzzleArea.querySelector("button")?.focus();
      }
    });
  }

  function closeChallenge() {
    state.challenge = null;
    resetChallengeUI();
    showScreen(null);
  }

  function speakCurrentChallenge() {
    if (!state.voiceEnabled || !state.challenge || !("speechSynthesis" in window)) {
      return;
    }

    const utterance = new SpeechSynthesisUtterance(state.challenge.voiceText || state.challenge.prompt);
    utterance.rate = 0.92;
    utterance.pitch = 0.98;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  function createLaserObstacle(x) {
    const lowLaser = {
      type: "floor-laser",
      x,
      width: rand(112, 132),
      hit: false,
      phase: rand(0, Math.PI * 2),
    };

    const highLaser = {
      type: "head-laser",
      x,
      width: rand(96, 116),
      hit: false,
      phase: rand(0, Math.PI * 2),
    };

    return Math.random() < 0.56 ? lowLaser : highLaser;
  }

  function createRun(mode, mission) {
    return {
      world: MISSION_WORLD,
      mode,
      subjectId: mission.subjectId,
      yearGroup: mission.yearGroup,
      characterId: mission.characterId,
      distance: 0,
      speed: mode === "practice" ? 205 : 220,
      maxSpeed: mode === "practice" ? 255 : 285,
      acceleration: mode === "practice" ? 1.2 : 1.45,
      player: {
        x: state.viewWidth * 0.22,
        y: 0,
        vy: 0,
        duckBlend: 0,
        invulnerability: 0,
      },
      groundY: getGroundY(),
      obstacles: [],
      obstacleTimer: rand(1.9, 2.45),
      nextChallengeAt: mode === "practice" ? 110 : 145,
      locksOpened: 0,
      wrongAnswers: 0,
      recentChallengeKeys: [],
      lives: 3,
      flashTimer: 0,
      captureTimer: 0,
      ending: null,
    };
  }

  function getObstacleRect(run, obstacle) {
    if (obstacle.type === "head-laser") {
      return {
        x: obstacle.x + 14,
        y: run.groundY - 138,
        width: obstacle.width - 28,
        height: 10,
      };
    }

    return {
      x: obstacle.x + 18,
      y: run.groundY - 18,
      width: obstacle.width - 36,
      height: 10,
    };
  }

  function spawnObstacle(run) {
    const x = state.viewWidth + rand(100, 220);
    run.obstacles.push(createLaserObstacle(x));
  }

  function getDoorApproach(run) {
    if (!run) {
      return null;
    }

    const remainingMeters = run.nextChallengeAt - run.distance;
    if (remainingMeters < 0 || remainingMeters > CHALLENGE_DOOR_VISIBLE_METERS) {
      return null;
    }

    const scale = clamp(1.18 - remainingMeters * 0.012, 0.92, 1.18);
    return {
      remainingMeters,
      scale,
      x: run.player.x + 176 + remainingMeters * CHALLENGE_DOOR_PIXELS_PER_METER,
      width: 134 * scale,
      height: 194 * scale,
      clearGap: Math.max(18 * scale, CHALLENGE_DOOR_CLEAR_METERS * CHALLENGE_DOOR_PIXELS_PER_METER),
    };
  }

  function getPlayerRect(run) {
    const player = run.player;
    const width = 60;
    const height = lerp(132, 86, player.duckBlend);
    return {
      x: player.x - 28,
      y: run.groundY - player.y - height,
      width,
      height,
    };
  }

  function intersects(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  }

  function updateRun(dt) {
    const run = state.run;
    if (!run || state.currentScreen !== "playing") {
      return;
    }

    const player = run.player;
    const onGround = player.y <= 0.001;
    const effectiveDuck = state.keyDuckHeld || state.touchDuckHeld;

    if (run.captureTimer > 0) {
      run.captureTimer -= dt;
      run.flashTimer = Math.max(run.flashTimer, 0.08);
      if (run.captureTimer <= 0) {
        startConfinementCutscene("ninja");
      }
      return;
    }

    if (state.jumpQueued && onGround) {
      player.vy = 820;
      state.jumpQueued = false;
    } else {
      state.jumpQueued = false;
    }

    player.duckBlend = lerp(player.duckBlend, effectiveDuck && onGround ? 1 : 0, 0.18);
    player.y += player.vy * dt;
    player.vy -= 2140 * dt;

    if (player.y < 0) {
      player.y = 0;
      player.vy = 0;
    }

    if (player.invulnerability > 0) {
      player.invulnerability -= dt;
    }
    if (run.flashTimer > 0) {
      run.flashTimer -= dt;
    }

    run.speed = clamp(run.speed + dt * run.acceleration, run.mode === "practice" ? 205 : 220, run.maxSpeed);
    const moveSpeed = run.speed;
    run.distance += moveSpeed * dt * 0.046;
    const doorApproach = getDoorApproach(run);

    if (!doorApproach || doorApproach.remainingMeters > CHALLENGE_DOOR_CLEAR_METERS) {
      run.obstacleTimer -= dt * clamp(moveSpeed / 220, 0.82, 1.12);
    } else {
      run.obstacleTimer = Math.max(run.obstacleTimer, 0.45);
    }

    if (run.obstacleTimer <= 0) {
      spawnObstacle(run);
      run.obstacleTimer = rand(1.9, 2.65);
    }

    const playerRect = getPlayerRect(run);

    for (const obstacle of run.obstacles) {
      obstacle.x -= moveSpeed * dt;
      const obstacleRect = getObstacleRect(run, obstacle);

      if (!obstacle.hit && player.invulnerability <= 0 && intersects(playerRect, obstacleRect)) {
        obstacle.hit = true;
        player.invulnerability = 1.08;
        run.flashTimer = 0.26;
        run.lives = Math.max(0, run.lives - 1);

        if (run.lives <= 0) {
          run.captureTimer = NINJA_CAPTURE_DURATION;
          run.ending = "ninja";
          showToast("Third hit. Ninja capture incoming.");
          startGuideBreakupSequence();
        } else if (run.lives === 1) {
          showToast(`Laser clipped you. ${run.lives} lives left.`);
          showGuideMessage("1 life remaining, use it wisely.", {
            speak: true,
            duration: 3600,
          });
        } else {
          showToast(`Laser clipped you. ${run.lives} lives left.`);
        }
      }
    }

    const doorCutoff = doorApproach && doorApproach.remainingMeters <= CHALLENGE_DOOR_CLEAR_METERS
      ? doorApproach.x - doorApproach.clearGap
      : Number.POSITIVE_INFINITY;

    run.obstacles = run.obstacles.filter((obstacle) =>
      obstacle.x + obstacle.width > -120 &&
      (doorCutoff === Number.POSITIVE_INFINITY || obstacle.x + obstacle.width < doorCutoff)
    );

    if (run.distance >= run.nextChallengeAt) {
      openChallenge();
      updateHud();
      return;
    }

    updateHud();
  }

  function updateHud() {
    if (!state.run) {
      return;
    }
    refs.hudLocation.textContent = state.run.world.name;
    refs.hudLesson.textContent = getMissionLabel(state.run.subjectId, state.run.yearGroup);
    refs.hudDistance.textContent = `${Math.floor(state.run.distance)}m`;
    refs.hudLives.textContent = String(state.run.lives);
    refs.hudLocks.textContent = String(state.run.locksOpened);
  }

  function getEndingSummary(run, reason) {
    if (reason === "ninja") {
      if (run.locksOpened >= 4 || run.distance >= 165) {
        return {
          title: "Late Ambush",
          body: `The agent nearly escaped, but a last-second ninja ambush dragged him away after ${run.locksOpened} opened locks. This run ended deeper in the corridor than most captures.`,
          status: "Close Call Capture",
        };
      }

      if (run.locksOpened <= 1 && run.distance < 80) {
        return {
          title: "Rookie Capture",
          body: `The lasers stacked up early and the ninja scooped the agent away before the mission had really started. Only ${run.locksOpened} door${run.locksOpened === 1 ? "" : "s"} opened before the capture.`,
          status: "Early Capture",
        };
      }

      return {
        title: "Shadow Snatch",
        body: `After the third laser hit, a ninja burst in through the smoke and hauled the agent away. You still opened ${run.locksOpened} locks before the corridor won.`,
        status: "Ninja Capture",
      };
    }

    if (reason === "alarm") {
      if (run.locksOpened >= 4) {
        return {
          title: "Almost Had It",
          body: `The mission was nearly complete, but the last-life answer was wrong and the red alarm shut the whole black site down after ${run.locksOpened} opened doors.`,
          status: "Late Alarm",
        };
      }

      return {
        title: "Alarm Triggered",
        body: `The final-life security door was answered incorrectly. The corridor flashed red, the alarm sounded, and the mission was blown.`,
        status: "Red Alarm",
      };
    }

    if (reason === "complete") {
      if (run.lives === 3 && run.wrongAnswers === 0) {
        return {
          title: "Perfect Agent Exit",
          body: `No hits, no mistakes, and ${run.locksOpened} clean door unlocks. The corridor never touched the agent.`,
          status: "Perfect Exit",
        };
      }

      if (run.lives === 1) {
        return {
          title: "Barely Escaped",
          body: `The mission was completed with only one life left, but the agent still forced through ${run.locksOpened} security doors and got out.`,
          status: "Scrappy Escape",
        };
      }

      return {
        title: "Mission Complete",
        body: `You cleared the corridor with ${run.locksOpened} unlocked doors on ${getMissionLabel(run.subjectId, run.yearGroup)}.`,
        status: "Clean Exit",
      };
    }

    return {
      title: "Mission Ended",
      body: `You reached ${Math.floor(run.distance)}m in ${run.world.name} on ${getMissionLabel(run.subjectId, run.yearGroup)}.`,
      status: "Debrief",
    };
  }

  function finalizeRunStats(run) {
    if (!run || run.statsRecorded) {
      return;
    }

    run.statsRecorded = true;
    progress.totalRuns += 1;
    progress.bestDistance = Math.max(progress.bestDistance, Math.floor(run.distance));
    saveProgress();
    refreshAllUI();
  }

  function startConfinementCutscene(reason) {
    const run = state.run;
    if (!run || state.currentScreen === "confinement") {
      return;
    }

    finalizeRunStats(run);
    state.cutscene = {
      reason,
      elapsed: 0,
      characterId: run.characterId,
      distance: Math.floor(run.distance),
      locksOpened: run.locksOpened,
      lessonLabel: getMissionLabel(run.subjectId, run.yearGroup),
    };
    showScreen("confinement");
  }

  function finishRun(reason) {
    const run = state.run;
    if (!run || state.currentScreen === "game-over") {
      return;
    }

    finalizeRunStats(run);

    const ending = getEndingSummary(run, reason);

    refs.gameOverTitle.textContent = ending.title;
    refs.gameOverBody.textContent = ending.body;
    refs.gameOverDistance.textContent = `${Math.floor(run.distance)}m`;
    refs.gameOverCorrect.textContent = String(run.locksOpened);
    refs.gameOverLives.textContent = String(run.lives);
    refs.gameOverStatus.textContent = ending.status;
    showScreen("game-over");
  }

  function startRun(options = {}) {
    clearGuideBreakupSequence();
    state.cutscene = null;
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    const mission = {
      subjectId: subjectMap.has(options.subjectId) ? options.subjectId : getSelectedMission().subjectId,
      yearGroup: yearGroupMap.has(options.yearGroup) ? options.yearGroup : getSelectedMission().yearGroup,
      characterId: characterMap.has(options.characterId) ? options.characterId : getSelectedMission().characterId,
    };

    progress.selectedSubjectId = mission.subjectId;
    progress.selectedYearGroup = mission.yearGroup;
    progress.selectedCharacterId = mission.characterId;
    state.run = createRun(options.mode || "mission", mission);
    state.challenge = null;
    state.challengeContinueMode = "resume";
    resetChallengeUI();
    state.lastRunConfig = {
      mode: options.mode || "mission",
      subjectId: mission.subjectId,
      yearGroup: mission.yearGroup,
      characterId: mission.characterId,
    };
    updateHud();
    refreshAllUI();
    showScreen(null);
    showGuideMessage(`Roger, can you hear me ${getCharacter(mission.characterId).name}? Are you ready for the mission?`, {
      speak: true,
      duration: 5200,
    });
  }

  function disableChallengePuzzle() {
    refs.challengePuzzleArea.querySelectorAll("button").forEach((button) => {
      button.disabled = true;
    });
  }

  function resolveChallengeAttempt(rawAnswer) {
    if (!state.run || !state.challenge || state.challenge.resolved) {
      return;
    }

    const answer = normalizeAnswer(rawAnswer);
    if (!answer) {
      refs.challengeFeedback.textContent = "Choose or type an answer first.";
      return;
    }

    const challenge = state.challenge;
    const correct = challenge.acceptedAnswers.includes(answer);
    const run = state.run;

    challenge.resolved = true;
    refs.challengeInput.disabled = true;
    refs.challengeSubmit.disabled = true;
    disableChallengePuzzle();

    if (correct) {
      recordChallengeResult(challenge, true);
      run.locksOpened += 1;
      refs.challengeScreen.classList.add("success-state");
      refs.challengeFace.textContent = ":)";
      refs.challengeFeedback.textContent = `Door unlocked. ${challenge.answer} was correct.`;
      setDoorState("open", `Security path cleared for ${challenge.answer}`);
      state.challengeContinueMode = "auto";
      showToast(`Door unlocked: ${challenge.answer}`);
      showGuideMessage(`Good job ${getRunCharacter(run).name}.`, {
        speak: true,
        duration: 2800,
      });
      updateHud();
      window.setTimeout(() => {
        if (state.currentScreen === "challenge" && state.challengeContinueMode === "auto") {
          closeChallenge();
        }
      }, 900);
      return;
    }

    recordChallengeResult(challenge, false);
    run.wrongAnswers += 1;
    run.lives = Math.max(0, run.lives - 1);
    refs.challengeSubmit.hidden = true;
    refs.challengeContinue.hidden = false;
    refs.challengeAnswer.textContent = `${challenge.revealLabel}: ${challenge.answer}`;
    refs.challengeAnswer.hidden = false;

    if (run.lives <= 0) {
      refs.challengeScreen.classList.add("alarm-state");
      refs.challengeAlert.hidden = false;
      refs.challengeFace.textContent = "D:";
      refs.challengeFeedback.textContent = "Wrong answer on your last life. The alarm is going off. Click to see the outcome.";
      refs.challengeContinue.textContent = "See Outcome";
      setDoorState("alarm", "Security lockdown in progress");
      state.challengeContinueMode = "alarm";
      showToast("Alarm triggered");
      showGuideMessage("You can do it next time.", {
        speak: true,
        duration: 3200,
      });
    } else {
      refs.challengeFace.textContent = ":(";
      refs.challengeFeedback.textContent = `Lock failed. You lost 1 life. ${run.lives} ${run.lives === 1 ? "life" : "lives"} left. Study the answer, then continue the mission.`;
      refs.challengeContinue.textContent = "Continue Mission";
      setDoorState("error", `Correct answer: ${challenge.answer}`);
      state.challengeContinueMode = "resume";
      showToast(`Wrong answer. ${run.lives} ${run.lives === 1 ? "life" : "lives"} left.`);
      showGuideMessage("You can do it next time.", {
        speak: true,
        duration: 3200,
      });
    }

    refs.challengeContinue.focus();
    updateHud();
  }

  function handleChallengePuzzleClick(event) {
    const button = event.target.closest("[data-option-index]");
    if (!button || !state.challenge || state.challenge.resolved) {
      return;
    }

    const optionIndex = Number(button.dataset.optionIndex);
    const option = state.challenge.options[optionIndex];
    if (!option) {
      return;
    }

    if (state.challenge.interfaceType === "keycard") {
      state.challenge.selectedOptionIndex = optionIndex;
      refs.challengeFeedback.textContent = "Pass loaded. Swipe the keycard to test the door.";
      refs.challengeSubmit.disabled = false;
      syncPuzzleSelection();
      return;
    }

    resolveChallengeAttempt(option.value);
  }

  function handleChallengeSubmit(event) {
    event.preventDefault();

    if (!state.run || !state.challenge || state.challenge.resolved) {
      return;
    }

    if (state.challenge.interfaceType === "keycard") {
      if (state.challenge.selectedOptionIndex < 0) {
        refs.challengeFeedback.textContent = "Pick the answer chip first.";
        return;
      }

      resolveChallengeAttempt(state.challenge.options[state.challenge.selectedOptionIndex].value);
      return;
    }

    const answer = normalizeAnswer(refs.challengeInput.value);
    if (!answer) {
      refs.challengeFeedback.textContent = "Type the unlock answer first.";
      return;
    }

    resolveChallengeAttempt(answer);
  }

  function handleChallengeContinue() {
    if (state.challengeContinueMode === "alarm") {
      state.challenge = null;
      resetChallengeUI();
      startConfinementCutscene("alarm");
      startGuideBreakupSequence();
      return;
    }
    closeChallenge();
  }

  function abandonToMenu() {
    clearGuideBreakupSequence();
    state.cutscene = null;
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    state.run = null;
    state.challenge = null;
    state.challengeContinueMode = "resume";
    resetChallengeUI();
    showScreen("menu");
    updateStaticUI();
  }

  function queueJump() {
    state.jumpQueued = true;
  }

  function setDuckHeld(active) {
    state.touchDuckHeld = active;
  }

  function handleSelectorClick(event) {
    const button = event.target.closest("button");
    if (!button) {
      return;
    }

    if (button.dataset.selectSubject) {
      progress.selectedSubjectId = button.dataset.selectSubject;
      refreshAllUI();
      showToast(`${getSubject(progress.selectedSubjectId).name} selected`);
      announceSelection(getSubject(progress.selectedSubjectId).name);
      return;
    }

    if (button.dataset.selectYear) {
      progress.selectedYearGroup = button.dataset.selectYear;
      refreshAllUI();
      showToast(`${getYearGroup(progress.selectedYearGroup).name} selected`);
      return;
    }

    if (button.dataset.selectCharacter) {
      progress.selectedCharacterId = button.dataset.selectCharacter;
      refreshAllUI();
      showToast(`${getCharacter(progress.selectedCharacterId).name} selected`);
      announceSelection(getCharacter(progress.selectedCharacterId).name);
    }
  }

  function handleKeyDown(event) {
    const key = event.key.toLowerCase();

    if (state.currentScreen === "challenge") {
      if (key === "escape") {
        event.preventDefault();
        return;
      }
      return;
    }

    if (state.currentScreen === "playing") {
      if (key === " " || key === "arrowup" || key === "w") {
        event.preventDefault();
        queueJump();
      }
      if (key === "arrowdown" || key === "s") {
        event.preventDefault();
        state.keyDuckHeld = true;
      }
      if (key === "m" || key === "escape") {
        abandonToMenu();
      }
      if (key === "r" && state.lastRunConfig) {
        startRun(state.lastRunConfig);
      }
      return;
    }

    if (state.currentScreen === "game-over" && (key === "r" || key === "enter")) {
      if (state.lastRunConfig) {
        startRun(state.lastRunConfig);
      }
      return;
    }

    if (state.currentScreen === "menu" && key === "enter") {
      startRun({
        mode: "mission",
        subjectId: progress.selectedSubjectId,
        yearGroup: progress.selectedYearGroup,
        characterId: progress.selectedCharacterId,
      });
    }
  }

  function handleKeyUp(event) {
    const key = event.key.toLowerCase();
    if (key === "arrowdown" || key === "s") {
      state.keyDuckHeld = false;
    }
  }

  function pathRoundedRect(x, y, width, height, radius) {
    const r = Math.min(radius, width * 0.5, height * 0.5);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function fillStrokeRoundedRect(x, y, width, height, radius, fill, stroke, lineWidth = 1) {
    pathRoundedRect(x, y, width, height, radius);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }

  function drawEllipseShadow(x, y, width, height, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, height / width);
    ctx.beginPath();
    ctx.arc(0, 0, width, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  function hexToRgb(hex) {
    const value = hex.replace("#", "");
    const full = value.length === 3
      ? value.split("").map((char) => char + char).join("")
      : value;
    const int = Number.parseInt(full, 16);
    return {
      r: (int >> 16) & 255,
      g: (int >> 8) & 255,
      b: int & 255,
    };
  }

  function rgbString({ r, g, b }, alpha = 1) {
    return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`;
  }

  function shadeHex(hex, amount, alpha = 1) {
    const { r, g, b } = hexToRgb(hex);
    return rgbString(
      {
        r: clamp(r + amount, 0, 255),
        g: clamp(g + amount, 0, 255),
        b: clamp(b + amount, 0, 255),
      },
      alpha
    );
  }

  function drawLaserBeam(x1, y1, x2, y2, color, width) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = Math.max(1.4, width * 0.28);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function drawSmokePuff(x, y, scale, alpha, timeSeconds) {
    const puffs = [
      { ox: -22, oy: 4, r: 20 },
      { ox: -4, oy: -8, r: 26 },
      { ox: 18, oy: -2, r: 22 },
      { ox: 34, oy: 8, r: 17 },
      { ox: 4, oy: 14, r: 18 },
    ];
    const drift = Math.sin(timeSeconds * 5.2) * 2;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = "rgba(220, 232, 242, 0.2)";
    ctx.shadowBlur = 18 * scale;

    for (const puff of puffs) {
      const gradient = ctx.createRadialGradient(
        x + puff.ox * scale,
        y + puff.oy * scale,
        2,
        x + puff.ox * scale,
        y + puff.oy * scale,
        puff.r * scale
      );
      gradient.addColorStop(0, "rgba(228, 236, 245, 0.86)");
      gradient.addColorStop(0.58, "rgba(173, 187, 201, 0.52)");
      gradient.addColorStop(1, "rgba(110, 124, 138, 0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x + (puff.ox + drift) * scale, y + puff.oy * scale, puff.r * scale, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawMonitor(x, y, width, height, accent) {
    fillStrokeRoundedRect(x, y, width, height, 10, "rgba(8,14,22,0.94)", "rgba(255,255,255,0.08)", 2);
    const screen = ctx.createLinearGradient(x, y, x + width, y + height);
    screen.addColorStop(0, "rgba(65, 144, 255, 0.24)");
    screen.addColorStop(1, "rgba(158, 233, 255, 0.12)");
    fillStrokeRoundedRect(x + 8, y + 8, width - 16, height - 16, 8, screen, null, 0);
    ctx.fillStyle = accent;
    ctx.fillRect(x + 16, y + 16, width * 0.42, 4);
    ctx.fillRect(x + 16, y + 28, width * 0.26, 4);
    ctx.fillRect(x + 16, y + 40, width * 0.52, 4);
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.fillRect(x + width - 24, y + 14, 8, height - 28);
  }

  function drawBackground(timeSeconds, distanceMeters) {
    const width = state.viewWidth;
    const height = state.viewHeight;
    const groundY = getGroundY();
    const scroll = distanceMeters * 10;

    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, shadeHex(MISSION_WORLD.palette.skyTop, 6));
    bg.addColorStop(0.48, MISSION_WORLD.palette.skyTop);
    bg.addColorStop(1, MISSION_WORLD.palette.skyBottom);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const glow = ctx.createRadialGradient(width * 0.76, groundY - 250, 30, width * 0.76, groundY - 250, width * 0.28);
    glow.addColorStop(0, "rgba(242, 200, 111, 0.22)");
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, groundY);

    ctx.fillStyle = MISSION_WORLD.palette.wall;
    ctx.fillRect(0, 0, width, groundY - 18);

    ctx.fillStyle = "rgba(255,255,255,0.03)";
    for (let row = 0; row < 3; row += 1) {
      ctx.fillRect(0, 112 + row * 118, width, 2);
    }

    const columnSpacing = 220;
    for (let index = -1; index < Math.ceil(width / columnSpacing) + 2; index += 1) {
      const x = ((index * columnSpacing - scroll * 0.26) % (columnSpacing * 8) + columnSpacing * 8) % (columnSpacing * 8) - columnSpacing;
      const panelX = x - 24;
      const panelWidth = 82;
      const panelGradient = ctx.createLinearGradient(panelX, 0, panelX + panelWidth, 0);
      panelGradient.addColorStop(0, "rgba(12,22,32,0.96)");
      panelGradient.addColorStop(0.45, "rgba(28,42,57,0.98)");
      panelGradient.addColorStop(1, "rgba(9,16,24,0.96)");
      fillStrokeRoundedRect(panelX, 78, panelWidth, groundY - 100, 18, panelGradient, "rgba(255,255,255,0.05)", 2);
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fillRect(panelX + 12, 108, 4, groundY - 170);
      ctx.fillRect(panelX + panelWidth - 16, 108, 4, groundY - 170);

      drawMonitor(panelX + 12, 156, panelWidth - 24, 52, "rgba(104,169,255,0.72)");
      drawMonitor(panelX + 12, 232, panelWidth - 24, 42, "rgba(158,233,255,0.58)");

      ctx.fillStyle = "rgba(255,77,89,0.7)";
      ctx.beginPath();
      ctx.arc(panelX + panelWidth * 0.5, 112, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.fillRect(panelX + panelWidth * 0.5 - 18, 126, 36, 2);
    }

    fillStrokeRoundedRect(width * 0.67, groundY - 270, width * 0.18, 184, 28, "rgba(12,18,28,0.96)", "rgba(255,255,255,0.08)", 3);
    fillStrokeRoundedRect(width * 0.695, groundY - 242, width * 0.13, 128, 24, "rgba(18,29,42,0.94)", "rgba(104,169,255,0.16)", 2);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(width * 0.76, groundY - 178, 42, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(width * 0.76, groundY - 220);
    ctx.lineTo(width * 0.76, groundY - 136);
    ctx.moveTo(width * 0.718, groundY - 178);
    ctx.lineTo(width * 0.802, groundY - 178);
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.fillRect(0, 56, width, 18);
    ctx.fillRect(0, groundY - 42, width, 8);

    for (let beam = 0; beam < 3; beam += 1) {
      const y = 146 + beam * 84 + Math.sin(timeSeconds * 0.7 + beam) * 6;
      drawLaserBeam(28, y, width - 28, y, "rgba(255,77,89,0.16)", 2.2);
    }

    const floorGradient = ctx.createLinearGradient(0, groundY - 26, 0, height);
    floorGradient.addColorStop(0, shadeHex(MISSION_WORLD.palette.floor2, 6));
    floorGradient.addColorStop(1, MISSION_WORLD.palette.floor);
    ctx.fillStyle = floorGradient;
    ctx.fillRect(0, groundY - 22, width, height - groundY + 24);

    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fillRect(0, groundY - 8, width, 2);

    for (let stripe = -2; stripe < Math.ceil(width / 140) + 2; stripe += 1) {
      const x = ((stripe * 140 - scroll * 0.9) % (width + 220)) - 110;
      ctx.fillStyle = "rgba(255,255,255,0.035)";
      ctx.beginPath();
      ctx.moveTo(x, groundY + 8);
      ctx.lineTo(x + 26, groundY + 8);
      ctx.lineTo(x + 74, height);
      ctx.lineTo(x + 36, height);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = "rgba(255,77,89,0.09)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + 18, groundY + 8);
      ctx.lineTo(x + 58, height);
      ctx.stroke();
    }

    for (let marker = -1; marker < Math.ceil(width / 180) + 2; marker += 1) {
      const x = ((marker * 180 - scroll * 1.15) % (width + 260)) - 120;
      fillStrokeRoundedRect(x, groundY + 18, 72, 14, 6, "rgba(255,255,255,0.04)", null, 0);
      fillStrokeRoundedRect(x + 12, groundY + 22, 18, 6, 3, "rgba(242,200,111,0.32)", null, 0);
      fillStrokeRoundedRect(x + 38, groundY + 22, 22, 6, 3, "rgba(255,77,89,0.32)", null, 0);
    }

    const stripeWidth = 52;
    for (let stripe = -2; stripe < Math.ceil(width / stripeWidth) + 2; stripe += 1) {
      const x = ((stripe * stripeWidth - scroll * 1.5) % (width + 160)) - 80;
      ctx.fillStyle = stripe % 2 === 0 ? "rgba(242,200,111,0.2)" : "rgba(12,18,27,0.04)";
      ctx.beginPath();
      ctx.moveTo(x, groundY + 4);
      ctx.lineTo(x + 24, groundY + 4);
      ctx.lineTo(x + 12, groundY + 18);
      ctx.lineTo(x - 12, groundY + 18);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawAgent(character, x, footY, jumpHeight, duckBlend, timeSeconds, expression) {
    const agent = character || CHARACTER_PROFILES[DEFAULT_CHARACTER_ID];
    const hairStyle = agent.hairStyle || "ponytail";
    const cycle = timeSeconds * 10.8;
    const stride = Math.sin(cycle);
    const counterStride = Math.sin(cycle + Math.PI);
    const ponySwing = Math.sin(cycle + 0.7) * 4.2;
    const standingHeight = agent.standingHeight || (agent.id === "matthew" ? 150 : 158);
    const duckHeight = agent.duckHeight || (agent.id === "matthew" ? 112 : 116);
    const bodyHeight = lerp(standingHeight, duckHeight, duckBlend);
    const baseY = footY - jumpHeight + Math.abs(Math.sin(cycle)) * (duckBlend > 0.2 ? 1.6 : 4.4);
    const headY = -bodyHeight - (agent.headOffset ?? (agent.id === "matthew" ? 6 : 8));
    const outline = "#111821";
    const worry = expression === "worry" || expression === "alarm";
    const lean = (worry ? 0.015 : 0.075) + stride * 0.028;

    function strokeLimb(points, innerColor, outlineWidth, innerWidth) {
      ctx.strokeStyle = outline;
      ctx.lineWidth = outlineWidth;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let index = 1; index < points.length; index += 1) {
        ctx.lineTo(points[index].x, points[index].y);
      }
      ctx.stroke();

      ctx.strokeStyle = innerColor;
      ctx.lineWidth = innerWidth;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let index = 1; index < points.length; index += 1) {
        ctx.lineTo(points[index].x, points[index].y);
      }
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(x, baseY);
    ctx.rotate(lean);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    drawEllipseShadow(0, 10, 36, 12, "rgba(0,0,0,0.24)");

    const leftHip = { x: -12, y: -44 };
    const rightHip = { x: 12, y: -44 };
    const leftKnee = { x: -18 + counterStride * 9, y: -14 - Math.max(0, stride) * 2 };
    const rightKnee = { x: 18 + stride * 9, y: -14 - Math.max(0, counterStride) * 2 };
    const leftAnkle = { x: -23 + counterStride * 14, y: 0 - Math.max(0, stride) * 10 };
    const rightAnkle = { x: 23 + stride * 14, y: 0 - Math.max(0, counterStride) * 10 };

    strokeLimb([leftHip, leftKnee, leftAnkle], agent.suitHighlight, 11, 7);
    strokeLimb([rightHip, rightKnee, rightAnkle], agent.suitHighlight, 11, 7);
    fillStrokeRoundedRect(leftAnkle.x - 10, leftAnkle.y - 7, 22, 11, 6, agent.shoe, outline, 2);
    fillStrokeRoundedRect(rightAnkle.x - 10, rightAnkle.y - 7, 22, 11, 6, agent.shoe, outline, 2);

    const leftShoulder = { x: -24, y: -bodyHeight + 46 };
    const rightShoulder = { x: 22, y: -bodyHeight + 48 };
    const leftElbow = { x: -33 - stride * 7, y: -bodyHeight + 72 };
    const rightElbow = { x: 31 - stride * 8, y: -bodyHeight + 76 };
    const leftHand = { x: -35 - stride * 13, y: -bodyHeight + 108 + Math.max(0, stride) * 5 };
    const rightHand = { x: 34 - stride * 14, y: -bodyHeight + 112 + Math.max(0, counterStride) * 6 };

    strokeLimb([leftShoulder, leftElbow, leftHand], agent.suitHighlight, 10, 6.2);
    strokeLimb([rightShoulder, rightElbow, rightHand], agent.suitHighlight, 10, 6.2);
    fillStrokeRoundedRect(leftHand.x - 6, leftHand.y - 10, 10, 8, 3, agent.shirt, outline, 1.5);
    fillStrokeRoundedRect(rightHand.x - 5, rightHand.y - 10, 10, 8, 3, agent.shirt, outline, 1.5);
    ctx.fillStyle = agent.skin;
    ctx.beginPath();
    ctx.arc(leftHand.x, leftHand.y, 4.6, 0, Math.PI * 2);
    ctx.arc(rightHand.x, rightHand.y, 4.6, 0, Math.PI * 2);
    ctx.fill();

    const jacketGradient = ctx.createLinearGradient(0, -bodyHeight, 0, -10);
    jacketGradient.addColorStop(0, shadeHex(agent.suitHighlight, 10));
    jacketGradient.addColorStop(1, agent.suit);
    fillStrokeRoundedRect(-30, -bodyHeight + 22, 62, 98, 21, jacketGradient, outline, 3);

    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath();
    ctx.moveTo(-22, -bodyHeight + 30);
    ctx.quadraticCurveTo(-6, -bodyHeight + 42, -10, -bodyHeight + 88);
    ctx.lineTo(-24, -bodyHeight + 84);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = shadeHex(agent.suitEdge, 6);
    ctx.beginPath();
    ctx.moveTo(-24, -bodyHeight + 34);
    ctx.lineTo(-6, -bodyHeight + 53);
    ctx.lineTo(-15, -bodyHeight + 92);
    ctx.lineTo(-28, -bodyHeight + 79);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(24, -bodyHeight + 34);
    ctx.lineTo(6, -bodyHeight + 53);
    ctx.lineTo(15, -bodyHeight + 92);
    ctx.lineTo(28, -bodyHeight + 79);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.09)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-22, -bodyHeight + 35);
    ctx.lineTo(-6, -bodyHeight + 52);
    ctx.lineTo(-13, -bodyHeight + 86);
    ctx.moveTo(22, -bodyHeight + 35);
    ctx.lineTo(6, -bodyHeight + 52);
    ctx.lineTo(13, -bodyHeight + 86);
    ctx.stroke();

    fillStrokeRoundedRect(-6, -bodyHeight + 36, 12, 52, 6, agent.shirt, outline, 2);
    fillStrokeRoundedRect(-5, -bodyHeight + 56, 10, 18, 5, agent.shirtShadow, null, 0);
    ctx.fillStyle = agent.shirt;
    ctx.beginPath();
    ctx.moveTo(-9, -bodyHeight + 36);
    ctx.lineTo(0, -bodyHeight + 48);
    ctx.lineTo(-2, -bodyHeight + 52);
    ctx.lineTo(-16, -bodyHeight + 36);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(9, -bodyHeight + 36);
    ctx.lineTo(0, -bodyHeight + 48);
    ctx.lineTo(2, -bodyHeight + 52);
    ctx.lineTo(16, -bodyHeight + 36);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(17,24,33,0.16)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-9, -bodyHeight + 36);
    ctx.lineTo(0, -bodyHeight + 48);
    ctx.lineTo(9, -bodyHeight + 36);
    ctx.stroke();
    ctx.fillStyle = agent.tie;
    ctx.beginPath();
    ctx.moveTo(0, -bodyHeight + 38);
    ctx.lineTo(6, -bodyHeight + 50);
    ctx.lineTo(1, -bodyHeight + 82);
    ctx.lineTo(-6, -bodyHeight + 50);
    ctx.closePath();
    ctx.fill();
    fillStrokeRoundedRect(-3, -bodyHeight + 36, 6, 9, 3, shadeHex(agent.tie, 18), null, 0);
    fillStrokeRoundedRect(-2, -bodyHeight + 96, 4, 4, 2, agent.button, null, 0);
    fillStrokeRoundedRect(11, -bodyHeight + 69, 8, 5, 2.5, agent.shirt, outline, 1);
    fillStrokeRoundedRect(11, -bodyHeight + 66, 2.8, 10, 1.4, "rgba(255,255,255,0.3)", null, 0);

    fillStrokeRoundedRect(-5, headY + 45, 10, 12, 5, agent.skinShadow, outline, 2);

    ctx.fillStyle = agent.skinShadow;
    ctx.beginPath();
    ctx.ellipse(-18, headY + 3, 5.5, 8.5, -0.14, 0, Math.PI * 2);
    ctx.ellipse(18, headY + 5, 5.5, 9, 0.1, 0, Math.PI * 2);
    ctx.fill();

    const faceGradient = ctx.createLinearGradient(0, headY - 28, 0, headY + 36);
    faceGradient.addColorStop(0, shadeHex(agent.skin, 18));
    faceGradient.addColorStop(1, shadeHex(agent.skin, -8));
    ctx.fillStyle = faceGradient;
    ctx.beginPath();
    ctx.ellipse(0, headY, 23, 27, -0.03, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = outline;
    ctx.stroke();

    ctx.fillStyle = agent.blush;
    ctx.beginPath();
    ctx.ellipse(-9, headY + 9, 5.5, 3.5, 0, 0, Math.PI * 2);
    ctx.ellipse(11, headY + 11, 5.8, 3.7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = agent.hairShadow;
    if (hairStyle === "ponytail") {
      ctx.beginPath();
      ctx.ellipse(0, headY - 17, 18, 7.4, 0, 0, Math.PI * 2);
      ctx.ellipse(-23, headY + 1, 7.8, 14.2, -0.2, 0, Math.PI * 2);
      ctx.ellipse(-26, headY + 11, 6.5, 11.2, -0.24, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(-25, headY + 5);
      ctx.quadraticCurveTo(-41 - ponySwing * 0.35, headY + 1, -47 - ponySwing, headY + 14);
      ctx.quadraticCurveTo(-43 - ponySwing * 0.6, headY + 28, -27, headY + 18);
      ctx.closePath();
      ctx.fill();
    } else if (hairStyle === "crop") {
      ctx.beginPath();
      ctx.ellipse(0, headY - 17, 16, 6.8, 0, 0, Math.PI * 2);
      ctx.ellipse(-16, headY - 4, 5.8, 8.6, -0.14, 0, Math.PI * 2);
      ctx.ellipse(15, headY - 3, 5.5, 8.1, 0.14, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-18, headY - 12);
      ctx.quadraticCurveTo(-9, headY - 23, 5, headY - 25);
      ctx.quadraticCurveTo(18, headY - 24, 21, headY - 14);
      ctx.quadraticCurveTo(18, headY - 11, 13, headY - 9);
      ctx.quadraticCurveTo(7, headY - 12, 2, headY - 13);
      ctx.quadraticCurveTo(-8, headY - 11, -18, headY - 9);
      ctx.closePath();
      ctx.fill();
    } else if (hairStyle === "bob") {
      ctx.beginPath();
      ctx.ellipse(-16, headY + 10, 8.6, 20, -0.06, 0, Math.PI * 2);
      ctx.ellipse(16, headY + 10, 8.6, 20, 0.06, 0, Math.PI * 2);
      ctx.ellipse(0, headY - 12, 20, 9.8, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (hairStyle === "bald") {
      ctx.fillStyle = "rgba(0,0,0,0.08)";
      ctx.beginPath();
      ctx.ellipse(0, headY - 18, 12.5, 4.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.05)";
      ctx.beginPath();
      ctx.ellipse(-15, headY - 1, 2.2, 4.2, -0.1, 0, Math.PI * 2);
      ctx.ellipse(15, headY, 2.2, 4.2, 0.1, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = agent.hair;
    if (hairStyle === "ponytail") {
      ctx.beginPath();
      ctx.arc(-2, headY - 10, 23.5, Math.PI * 0.82, Math.PI * 1.99);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(-25, headY - 8);
      ctx.quadraticCurveTo(-10, headY - 28, 6, headY - 22);
      ctx.quadraticCurveTo(18, headY - 19, 20, headY - 3);
      ctx.quadraticCurveTo(8, headY - 7, -9, headY + 2);
      ctx.quadraticCurveTo(-18, headY + 5, -25, headY - 8);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(-22, headY + 2, 7.5, 14, -0.18, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(-25, headY + 7);
      ctx.quadraticCurveTo(-35 - ponySwing * 0.18, headY + 3, -44 - ponySwing * 0.45, headY + 11);
      ctx.quadraticCurveTo(-50 - ponySwing * 0.75, headY + 18, -49 - ponySwing * 0.85, headY + 24);
      ctx.quadraticCurveTo(-43 - ponySwing * 0.45, headY + 26, -35, headY + 20);
      ctx.quadraticCurveTo(-27, headY + 15, -25, headY + 7);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(-49 - ponySwing * 0.9, headY + 22, 6.8, 5.1, 0.14, 0, Math.PI * 2);
      ctx.fill();
      fillStrokeRoundedRect(-30, headY + 8, 6, 6, 3, shadeHex(agent.hair, -16), outline, 1.2);
      fillStrokeRoundedRect(-28, headY + 7, 2.5, 9, 1.2, shadeHex(agent.hair, -30), null, 0);
    } else if (hairStyle === "crop") {
      ctx.beginPath();
      ctx.moveTo(-21, headY - 16);
      ctx.quadraticCurveTo(-8, headY - 34, 10, headY - 31);
      ctx.quadraticCurveTo(22, headY - 29, 24, headY - 15);
      ctx.quadraticCurveTo(22, headY - 9, 17, headY - 7);
      ctx.quadraticCurveTo(10, headY - 11, 4, headY - 12);
      ctx.quadraticCurveTo(-7, headY - 10, -14, headY - 6);
      ctx.quadraticCurveTo(-21, headY - 8, -21, headY - 16);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(2, headY - 22);
      ctx.quadraticCurveTo(9, headY - 18, 14, headY - 10);
      ctx.quadraticCurveTo(8, headY - 11, 3, headY - 11);
      ctx.quadraticCurveTo(-1, headY - 12, 2, headY - 22);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(-16, headY - 3, 4.9, 7.5, -0.14, 0, Math.PI * 2);
      ctx.ellipse(16, headY - 2, 4.5, 6.8, 0.14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.14)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(1, headY - 21);
      ctx.quadraticCurveTo(6, headY - 17, 10, headY - 11);
      ctx.moveTo(-7, headY - 20);
      ctx.quadraticCurveTo(-2, headY - 15, 2, headY - 13);
      ctx.stroke();
    } else if (hairStyle === "bob") {
      ctx.beginPath();
      ctx.moveTo(-19, headY - 14);
      ctx.quadraticCurveTo(-10, headY - 32, 9, headY - 28);
      ctx.quadraticCurveTo(19, headY - 27, 22, headY - 14);
      ctx.quadraticCurveTo(23, headY + 7, 18, headY + 24);
      ctx.quadraticCurveTo(13, headY + 31, 8, headY + 34);
      ctx.quadraticCurveTo(4, headY + 21, 0, headY + 12);
      ctx.quadraticCurveTo(-4, headY + 21, -8, headY + 34);
      ctx.quadraticCurveTo(-13, headY + 31, -18, headY + 24);
      ctx.quadraticCurveTo(-23, headY + 7, -19, headY - 14);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.16)";
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(1, headY - 20);
      ctx.quadraticCurveTo(7, headY - 14, 10, headY - 4);
      ctx.stroke();
    } else if (hairStyle === "bald") {
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(-7, headY - 20);
      ctx.quadraticCurveTo(0, headY - 25, 8, headY - 18);
      ctx.stroke();
    }

    ctx.fillStyle = agent.brow;
    ctx.beginPath();
    ctx.ellipse(-7, headY - 11, 5.5, 1.6, -0.08, 0, Math.PI * 2);
    ctx.ellipse(10, headY - 10, 6.4, 1.8, 0.08, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fdfefe";
    ctx.beginPath();
    ctx.ellipse(-7, headY - 2, 4.2, 5.7, -0.08, 0, Math.PI * 2);
    ctx.ellipse(9, headY - 1, 5.6, 7.1, 0.04, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(17,24,33,0.22)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(-7, headY - 2, 4.2, 5.7, -0.08, 0, Math.PI * 2);
    ctx.ellipse(9, headY - 1, 5.6, 7.1, 0.04, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = agent.eye;
    ctx.beginPath();
    ctx.arc(-7, headY - 1.5, 2.15, 0, Math.PI * 2);
    ctx.arc(9.3, headY - 0.6, 2.85, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#121920";
    ctx.beginPath();
    ctx.arc(-6.8, headY - 1.3, 0.95, 0, Math.PI * 2);
    ctx.arc(9.6, headY - 0.4, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.beginPath();
    ctx.arc(-7.7, headY - 2.2, 0.55, 0, Math.PI * 2);
    ctx.arc(8.5, headY - 1.8, 0.65, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(124,84,56,0.55)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(1, headY + 1);
    ctx.quadraticCurveTo(3, headY + 7, 1, headY + 10);
    ctx.stroke();

    ctx.fillStyle = agent.freckles;
    ctx.beginPath();
    ctx.arc(-5, headY + 8, 0.95, 0, Math.PI * 2);
    ctx.arc(-1, headY + 9, 0.95, 0, Math.PI * 2);
    ctx.arc(3, headY + 8, 0.95, 0, Math.PI * 2);
    ctx.arc(8, headY + 8.5, 0.95, 0, Math.PI * 2);
    ctx.arc(12, headY + 9.5, 0.95, 0, Math.PI * 2);
    ctx.fill();

    if (agent.facialHair === "short-beard") {
      ctx.fillStyle = agent.facialHairColor || agent.hairShadow;
      ctx.beginPath();
      ctx.ellipse(4, headY + 16, 10, 7.2, 0, 0, Math.PI * 2);
      ctx.ellipse(4, headY + 10, 6.2, 2.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(-1, headY + 11);
      ctx.quadraticCurveTo(4, headY + 13, 9, headY + 11);
      ctx.stroke();
    }

    ctx.strokeStyle = outline;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    if (worry) {
      ctx.moveTo(-4, headY + 16);
      ctx.quadraticCurveTo(4, headY + 10, 12, headY + 16);
    } else {
      ctx.moveTo(-3, headY + 15);
      ctx.quadraticCurveTo(4, headY + 19, 12, headY + 14);
    }
    ctx.stroke();

    ctx.restore();
  }

  function drawNinja(x, footY, timeSeconds, grabProgress) {
    const stride = Math.sin(timeSeconds * 10.8) * 10;

    ctx.save();
    ctx.translate(x, footY);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    drawEllipseShadow(0, 10, 34, 12, "rgba(0,0,0,0.24)");

    ctx.strokeStyle = "#070b10";
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(-8, -38);
    ctx.lineTo(-14 - stride * 0.06, -2);
    ctx.moveTo(8, -38);
    ctx.lineTo(14 + stride * 0.06, -2);
    ctx.stroke();

    fillStrokeRoundedRect(-24, -124, 46, 88, 18, "#0a1016", "#151d26", 2);
    ctx.strokeStyle = "#0b1118";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(-18, -86);
    ctx.lineTo(-30 - stride * 0.04, -54);
    ctx.moveTo(16, -84);
    ctx.lineTo(32 + stride * 0.04, -48);
    ctx.stroke();

    ctx.fillStyle = "#090d13";
    ctx.beginPath();
    ctx.arc(0, -144, 22, 0, Math.PI * 2);
    ctx.fill();
    fillStrokeRoundedRect(-15, -150, 30, 12, 6, "#141c26", null, 0);
    ctx.fillStyle = "#c62c38";
    ctx.fillRect(-8, -146, 16, 4);
    ctx.fillStyle = "#e7eef6";
    ctx.fillRect(-9, -144, 18, 3);

    if (grabProgress > 0.6) {
      ctx.strokeStyle = "#1b2531";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-18, -84);
      ctx.lineTo(-42, -74);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawLaserObstacle(obstacle, groundY, timeSeconds) {
    const pulse = 0.72 + Math.sin(timeSeconds * 5 + obstacle.phase) * 0.08;
    const beamColor = `rgba(255, 77, 89, ${pulse})`;
    const emitterFill = "rgba(17, 24, 33, 0.98)";
    const emitterStroke = "rgba(255,255,255,0.09)";

    if (obstacle.type === "head-laser") {
      const topY = groundY - 150;
      const beamY = groundY - 133;
      fillStrokeRoundedRect(obstacle.x, topY, 16, 124, 8, emitterFill, emitterStroke, 2);
      fillStrokeRoundedRect(obstacle.x + obstacle.width - 16, topY, 16, 124, 8, emitterFill, emitterStroke, 2);
      fillStrokeRoundedRect(obstacle.x + 4, beamY - 11, 8, 18, 4, "rgba(68,88,108,0.86)", null, 0);
      fillStrokeRoundedRect(obstacle.x + obstacle.width - 12, beamY - 11, 8, 18, 4, "rgba(68,88,108,0.86)", null, 0);
      drawLaserBeam(obstacle.x + 16, beamY, obstacle.x + obstacle.width - 16, beamY, beamColor, 3.4);
      drawLaserBeam(obstacle.x + 16, beamY + 2, obstacle.x + obstacle.width - 16, beamY + 2, "rgba(255, 170, 175, 0.24)", 1.2);
      ctx.fillStyle = "rgba(255,77,89,0.08)";
      ctx.fillRect(obstacle.x + 16, beamY + 4, obstacle.width - 32, 7);
    } else {
      fillStrokeRoundedRect(obstacle.x, groundY - 22, 14, 22, 7, emitterFill, emitterStroke, 2);
      fillStrokeRoundedRect(obstacle.x + obstacle.width - 14, groundY - 22, 14, 22, 7, emitterFill, emitterStroke, 2);
      for (let beam = 0; beam < 2; beam += 1) {
        const beamY = groundY - 8 - beam * 5;
        drawLaserBeam(obstacle.x + 14, beamY, obstacle.x + obstacle.width - 14, beamY, beamColor, 2.2);
      }
      ctx.fillStyle = "rgba(255,77,89,0.08)";
      ctx.fillRect(obstacle.x + 14, groundY - 13, obstacle.width - 28, 5);
    }
  }

  function drawApproachDoor(run) {
    const approach = getDoorApproach(run);
    if (!approach) {
      return;
    }

    const { x, width, height, scale, clearGap } = approach;
    const y = run.groundY - height - 8;
    const frameX = x - 10 * scale;
    const frameY = y - 10 * scale;
    const frameWidth = width + 20 * scale;
    const frameHeight = height + 20 * scale;

    ctx.save();

    for (let marker = 0; marker < 5; marker += 1) {
      const markerX = x - clearGap + marker * (clearGap / 5);
      fillStrokeRoundedRect(
        markerX,
        run.groundY + 4,
        26 * scale,
        10 * scale,
        3 * scale,
        marker % 2 === 0 ? "rgba(242,200,111,0.26)" : "rgba(255,255,255,0.08)",
        null,
        0
      );
    }

    drawEllipseShadow(x + width * 0.5, run.groundY + 10, 52 * scale, 16 * scale, "rgba(0,0,0,0.26)");
    fillStrokeRoundedRect(frameX, frameY, frameWidth, frameHeight, 12 * scale, "rgba(32,40,49,0.98)", "rgba(205,214,221,0.18)", 3);

    const panelGradient = ctx.createLinearGradient(x, y, x + width, y + height);
    panelGradient.addColorStop(0, "rgba(176,184,192,0.98)");
    panelGradient.addColorStop(0.22, "rgba(128,136,145,0.98)");
    panelGradient.addColorStop(0.58, "rgba(88,96,106,0.99)");
    panelGradient.addColorStop(1, "rgba(60,68,79,0.99)");
    fillStrokeRoundedRect(x, y, width, height, 10 * scale, panelGradient, "rgba(45,53,62,0.98)", 4);
    fillStrokeRoundedRect(x + 14 * scale, y + 14 * scale, width - 28 * scale, height - 28 * scale, 8 * scale, "rgba(255,255,255,0.04)", "rgba(255,255,255,0.1)", 2);
    fillStrokeRoundedRect(x + 28 * scale, y + 28 * scale, width - 56 * scale, height - 56 * scale, 8 * scale, "rgba(21,28,35,0.08)", "rgba(255,255,255,0.08)", 2);

    fillStrokeRoundedRect(x + 38 * scale, y + 28 * scale, 66 * scale, 34 * scale, 6 * scale, "rgba(47,56,66,0.98)", "rgba(27,33,40,0.94)", 2);
    fillStrokeRoundedRect(x + 48 * scale, y + 35 * scale, 46 * scale, 20 * scale, 4 * scale, "rgba(16,26,31,0.98)", "rgba(156,170,182,0.14)", 1.6);
    ctx.fillStyle = "rgba(255,90,90,0.92)";
    ctx.beginPath();
    ctx.arc(x + 44 * scale, y + 45 * scale, 4 * scale, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.26)";
    ctx.fillRect(x + 60 * scale, y + 41 * scale, 26 * scale, 2.8 * scale);
    ctx.fillRect(x + 60 * scale, y + 47 * scale, 20 * scale, 2.8 * scale);

    const wheelX = x + 58 * scale;
    const wheelY = y + 116 * scale;
    ctx.fillStyle = "rgba(192,200,207,0.96)";
    ctx.beginPath();
    ctx.arc(wheelX, wheelY, 24 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 4 * scale;
    ctx.strokeStyle = "rgba(70,78,88,0.98)";
    ctx.stroke();

    ctx.strokeStyle = "rgba(89,97,107,0.98)";
    ctx.lineWidth = 5 * scale;
    for (let spoke = 0; spoke < 3; spoke += 1) {
      const angle = spoke * (Math.PI / 3);
      ctx.beginPath();
      ctx.moveTo(wheelX - Math.cos(angle) * 16 * scale, wheelY - Math.sin(angle) * 16 * scale);
      ctx.lineTo(wheelX + Math.cos(angle) * 16 * scale, wheelY + Math.sin(angle) * 16 * scale);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(66,75,84,0.98)";
    ctx.beginPath();
    ctx.arc(wheelX, wheelY, 7 * scale, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(194,203,210,0.94)";
    ctx.beginPath();
    ctx.arc(x + 32 * scale, y + 120 * scale, 12 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3 * scale;
    ctx.strokeStyle = "rgba(67,76,85,0.98)";
    ctx.stroke();

    for (let bar = 0; bar < 3; bar += 1) {
      fillStrokeRoundedRect(
        x + width - 44 * scale,
        y + (52 + bar * 40) * scale,
        36 * scale,
        10 * scale,
        5 * scale,
        "rgba(173,182,191,0.98)",
        "rgba(70,79,89,0.98)",
        2
      );
    }

    for (let hinge = 0; hinge < 3; hinge += 1) {
      fillStrokeRoundedRect(
        x + width - 10 * scale,
        y + (34 + hinge * 48) * scale,
        12 * scale,
        28 * scale,
        3 * scale,
        "rgba(171,180,189,0.98)",
        "rgba(73,82,91,0.96)",
        2
      );
    }

    for (const [rx, ry] of [
      [10, 10], [width - 10, 10], [10, height - 10], [width - 10, height - 10],
      [10, height * 0.5], [width - 10, height * 0.5], [width * 0.5, 10], [width * 0.5, height - 10],
    ]) {
      ctx.fillStyle = "rgba(222,227,232,0.84)";
      ctx.beginPath();
      ctx.arc(x + rx, y + ry, 4 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2 * scale;
      ctx.strokeStyle = "rgba(65,73,82,0.9)";
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawRunScene(timeSeconds) {
    const run = state.run;
    if (!run) {
      return;
    }
    const character = getRunCharacter(run);

    drawBackground(timeSeconds, run.distance);

    for (const obstacle of run.obstacles) {
      drawLaserObstacle(obstacle, run.groundY, timeSeconds);
    }

    drawApproachDoor(run);

    const captureProgress = run.captureTimer > 0
      ? clamp(1 - run.captureTimer / NINJA_CAPTURE_DURATION, 0, 1)
      : 0;
    const basePlayerX = run.player.x;
    const grabPhase = clamp(captureProgress / 0.34, 0, 1);
    const dragPhase = clamp((captureProgress - 0.34) / 0.66, 0, 1);
    const easedGrab = 1 - Math.pow(1 - grabPhase, 3);
    const easedDrag = dragPhase * dragPhase * (3 - 2 * dragPhase);
    const playerX = run.captureTimer > 0
      ? basePlayerX + easedDrag * (state.viewWidth - basePlayerX + 150)
      : basePlayerX;
    const footY = run.groundY + 2;

    if (run.captureTimer > 0) {
      const ninjaX = lerp(basePlayerX + 230, basePlayerX + 34, easedGrab) + easedDrag * (state.viewWidth - basePlayerX + 180);
      const smokeAlpha = clamp(1 - Math.abs(captureProgress - 0.34) / 0.2, 0, 1);
      if (smokeAlpha > 0) {
        drawSmokePuff(basePlayerX + 14 + easedGrab * 18, footY - 72, 1 + easedGrab * 0.24, smokeAlpha * 0.9, timeSeconds);
      }
      drawNinja(ninjaX, footY, timeSeconds, captureProgress);
    }

    if (!(run.player.invulnerability > 0 && Math.floor(timeSeconds * 12) % 2 === 0)) {
      const expression = run.captureTimer > 0 || run.lives === 1 ? "worry" : "focus";
      drawAgent(character, playerX, footY, run.player.y, run.player.duckBlend, timeSeconds, expression);
    }

    if (run.flashTimer > 0) {
      ctx.fillStyle = `rgba(255, 77, 89, ${run.flashTimer * 0.28})`;
      ctx.fillRect(0, 0, state.viewWidth, state.viewHeight);
    }

    drawSceneVignette();
  }

  function drawSceneVignette() {
    const width = state.viewWidth;
    const height = state.viewHeight;
    const vignette = ctx.createRadialGradient(
      width * 0.5,
      height * 0.38,
      width * 0.12,
      width * 0.5,
      height * 0.38,
      width * 0.78
    );
    vignette.addColorStop(0, "rgba(255,255,255,0)");
    vignette.addColorStop(0.68, "rgba(0,0,0,0.03)");
    vignette.addColorStop(1, "rgba(0,0,0,0.28)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  }

  function drawMenuScene(timeSeconds) {
    drawBackground(timeSeconds * 0.55, timeSeconds * 10);
    const groundY = getGroundY() + 2;
    drawAgent(getSelectedCharacter(), state.viewWidth * 0.22, groundY, 4 + Math.sin(timeSeconds * 1.9) * 3, 0.02, timeSeconds, "focus");

    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.font = `700 ${Math.max(18, state.viewWidth * 0.014)}px Trebuchet MS`;
    ctx.fillText("Space / Up = jump   Down = duck   Enter = quick start", state.viewWidth * 0.08, groundY - 32);
  }

  function drawConfinementCharacter(character, centerX, centerY, timeSeconds, elapsed) {
    const agent = character || CHARACTER_PROFILES[DEFAULT_CHARACTER_ID];
    const tearTravel = clamp((elapsed - 0.55) * 20, 0, 26);
    const breath = Math.sin(timeSeconds * 1.6) * 2.4;
    const jumpsuit = "#d97523";
    const jumpsuitShadow = "#a95416";
    const outline = "rgba(18, 24, 31, 0.92)";

    drawEllipseShadow(centerX, centerY + 210, 170, 34, "rgba(0,0,0,0.36)");

    ctx.save();
    ctx.translate(centerX, centerY);

    fillStrokeRoundedRect(-34, 64, 68, 160, 26, jumpsuitShadow, outline, 3);
    fillStrokeRoundedRect(-78, 22, 156, 138, 42, jumpsuit, outline, 3);
    fillStrokeRoundedRect(-118, 48, 36, 108, 18, jumpsuit, outline, 3);
    fillStrokeRoundedRect(82, 48, 36, 108, 18, jumpsuit, outline, 3);
    fillStrokeRoundedRect(-54, 148, 36, 122, 18, jumpsuit, outline, 3);
    fillStrokeRoundedRect(18, 148, 36, 122, 18, jumpsuit, outline, 3);
    fillStrokeRoundedRect(-16, 34, 32, 136, 12, "rgba(255,255,255,0.18)", null, 0);
    fillStrokeRoundedRect(-18, 18, 36, 24, 10, shadeHex(jumpsuit, -10), outline, 2);

    ctx.fillStyle = agent.skinShadow;
    ctx.fillRect(-12, -8, 24, 20);
    ctx.beginPath();
    ctx.ellipse(-98, 150, 10, 14, -0.1, 0, Math.PI * 2);
    ctx.ellipse(98, 150, 10, 14, 0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = agent.shoe;
    ctx.beginPath();
    ctx.ellipse(-36, 280, 18, 8, -0.16, 0, Math.PI * 2);
    ctx.ellipse(36, 280, 18, 8, 0.16, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = agent.skinShadow;
    ctx.beginPath();
    ctx.ellipse(-58, -42, 13, 20, -0.08, 0, Math.PI * 2);
    ctx.ellipse(58, -42, 13, 20, 0.08, 0, Math.PI * 2);
    ctx.fill();

    const faceGradient = ctx.createLinearGradient(0, -150, 0, 18);
    faceGradient.addColorStop(0, shadeHex(agent.skin, 20));
    faceGradient.addColorStop(1, shadeHex(agent.skin, -10));
    ctx.fillStyle = faceGradient;
    ctx.beginPath();
    ctx.ellipse(0, -54 + breath * 0.08, 74, 88, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = outline;
    ctx.stroke();

    ctx.fillStyle = agent.blush;
    ctx.beginPath();
    ctx.ellipse(-28, -32, 12, 7, 0, 0, Math.PI * 2);
    ctx.ellipse(30, -32, 12, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(0,0,0,0.06)";
    ctx.beginPath();
    ctx.ellipse(0, -112, 34, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-18, -114);
    ctx.quadraticCurveTo(0, -124, 20, -112);
    ctx.stroke();

    ctx.strokeStyle = agent.brow;
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-38, -70);
    ctx.lineTo(-12, -80);
    ctx.moveTo(12, -80);
    ctx.lineTo(38, -70);
    ctx.stroke();

    ctx.fillStyle = "#fcfeff";
    ctx.beginPath();
    ctx.ellipse(-22, -54, 10, 13, -0.08, 0, Math.PI * 2);
    ctx.ellipse(22, -54, 10, 13, 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(17,24,33,0.22)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(-22, -54, 10, 13, -0.08, 0, Math.PI * 2);
    ctx.ellipse(22, -54, 10, 13, 0.08, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = agent.eye;
    ctx.beginPath();
    ctx.arc(-22, -52, 5, 0, Math.PI * 2);
    ctx.arc(22, -52, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#10161d";
    ctx.beginPath();
    ctx.arc(-21.5, -51.5, 2, 0, Math.PI * 2);
    ctx.arc(22.5, -51.5, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(124,84,56,0.45)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -44);
    ctx.quadraticCurveTo(4, -22, 0, -8);
    ctx.stroke();

    ctx.fillStyle = agent.freckles;
    ctx.beginPath();
    ctx.arc(-34, -40, 1.8, 0, Math.PI * 2);
    ctx.arc(-28, -36, 1.6, 0, Math.PI * 2);
    ctx.arc(28, -37, 1.6, 0, Math.PI * 2);
    ctx.arc(35, -41, 1.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#5b2c1c";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-22, 20);
    ctx.quadraticCurveTo(0, -2, 22, 20);
    ctx.stroke();

    ctx.fillStyle = "rgba(117, 210, 255, 0.95)";
    ctx.beginPath();
    ctx.moveTo(34, -24 + tearTravel);
    ctx.quadraticCurveTo(42, -11 + tearTravel, 34, 4 + tearTravel);
    ctx.quadraticCurveTo(26, -11 + tearTravel, 34, -24 + tearTravel);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  function drawConfinementScene(timeSeconds) {
    const cutscene = state.cutscene;
    if (!cutscene || !state.run) {
      return;
    }

    const width = state.viewWidth;
    const height = state.viewHeight;
    const floorY = height * 0.37;
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, "#20252d");
    bg.addColorStop(0.34, "#2c3138");
    bg.addColorStop(0.35, "#575c63");
    bg.addColorStop(1, "#2a2f35");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const light = ctx.createRadialGradient(width * 0.5, height * 0.18, 20, width * 0.5, height * 0.24, width * 0.48);
    light.addColorStop(0, "rgba(255,245,214,0.36)");
    light.addColorStop(1, "rgba(255,245,214,0)");
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "rgba(255,255,255,0.06)";
    for (let bar = 0; bar < 6; bar += 1) {
      ctx.fillRect(width * 0.14 + bar * width * 0.12, 0, 6, floorY);
    }

    ctx.fillStyle = "rgba(0,0,0,0.18)";
    for (let seam = 0; seam < 7; seam += 1) {
      ctx.fillRect(width * 0.08, floorY + seam * height * 0.085, width * 0.84, 3);
    }
    for (let seam = 0; seam < 5; seam += 1) {
      ctx.fillRect(width * (0.16 + seam * 0.16), floorY, 3, height - floorY);
    }

    fillStrokeRoundedRect(width * 0.72, height * 0.2, width * 0.12, height * 0.08, 10, "rgba(33,38,44,0.95)", "rgba(175,184,192,0.16)", 2);
    fillStrokeRoundedRect(width * 0.69, height * 0.52, width * 0.18, height * 0.06, 12, "rgba(57,64,72,0.95)", "rgba(184,192,199,0.14)", 2);
    fillStrokeRoundedRect(width * 0.69, height * 0.56, width * 0.18, height * 0.025, 6, "rgba(130,135,140,0.9)", null, 0);

    if (cutscene.reason === "alarm") {
      const pulse = 0.08 + (Math.sin(timeSeconds * 5) * 0.5 + 0.5) * 0.1;
      ctx.fillStyle = `rgba(255,62,62,${pulse})`;
      ctx.fillRect(0, 0, width, height);
    }

    drawConfinementCharacter(getRunCharacter(state.run), width * 0.5, height * 0.42, timeSeconds, cutscene.elapsed);

    const gameOverElapsed = cutscene.elapsed - CONFINEMENT_SCENE_SECONDS;
    if (gameOverElapsed > 0) {
      const alpha = clamp(gameOverElapsed / 0.5, 0, 1);
      ctx.fillStyle = `rgba(0,0,0,${0.26 + alpha * 0.22})`;
      ctx.fillRect(0, 0, width, height);

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 6;
      ctx.strokeStyle = `rgba(48, 5, 8, ${0.7 * alpha})`;
      ctx.fillStyle = `rgba(255, 232, 232, ${alpha})`;
      ctx.font = `900 ${Math.max(48, width * 0.07)}px Trebuchet MS`;
      ctx.strokeText("GAME OVER", width * 0.5, height * 0.18);
      ctx.fillText("GAME OVER", width * 0.5, height * 0.18);
    }

    drawSceneVignette();
  }

  function updateConfinementCutscene(dt) {
    if (!state.cutscene || state.currentScreen !== "confinement") {
      return;
    }

    state.cutscene.elapsed += dt;
    if (state.cutscene.elapsed >= CONFINEMENT_SCENE_SECONDS + GAME_OVER_HOLD_SECONDS) {
      abandonToMenu();
    }
  }

  function renderFrame(timestamp) {
    const dt = clamp((timestamp - state.lastTime) / 1000, 0.001, 0.04);
    state.lastTime = timestamp;

    ctx.clearRect(0, 0, state.viewWidth, state.viewHeight);

    if (state.currentScreen === "confinement" && state.cutscene) {
      updateConfinementCutscene(dt);
      drawConfinementScene(timestamp / 1000);
    } else if (state.run && (state.currentScreen === "playing" || state.currentScreen === "challenge" || state.currentScreen === "game-over")) {
      updateRun(dt);
      drawRunScene(timestamp / 1000);
      if (state.currentScreen === "challenge") {
        ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
        ctx.fillRect(0, 0, state.viewWidth, state.viewHeight);
      }
    } else {
      drawMenuScene(timestamp / 1000);
    }

    window.requestAnimationFrame(renderFrame);
  }

  function bindEvents() {
    document.addEventListener("click", handleSelectorClick);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("orientationchange", resizeCanvas);
    window.visualViewport?.addEventListener("resize", resizeCanvas);
    window.addEventListener("blur", () => {
      state.keyDuckHeld = false;
      state.touchDuckHeld = false;
      state.jumpQueued = false;
    });

    refs.playMainButton.addEventListener("click", () => {
      startRun({
        mode: "mission",
        subjectId: progress.selectedSubjectId,
        yearGroup: progress.selectedYearGroup,
        characterId: progress.selectedCharacterId,
      });
    });

    refs.playPracticeButton.addEventListener("click", () => {
      startRun({
        mode: "practice",
        subjectId: progress.selectedSubjectId,
        yearGroup: progress.selectedYearGroup,
        characterId: progress.selectedCharacterId,
      });
    });

    refs.retryButton.addEventListener("click", () => {
      if (state.lastRunConfig) {
        startRun(state.lastRunConfig);
      }
    });

    refs.menuButton.addEventListener("click", abandonToMenu);
    refs.challengeForm.addEventListener("click", handleChallengePuzzleClick);
    refs.challengeForm.addEventListener("submit", handleChallengeSubmit);
    refs.challengeContinue.addEventListener("click", handleChallengeContinue);
    refs.challengeSpeak.addEventListener("click", speakCurrentChallenge);

    refs.muteButton.addEventListener("click", () => {
      state.voiceEnabled = !state.voiceEnabled;
      updateStaticUI();
      if (!state.voiceEnabled && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    });

    refs.jumpButton.addEventListener("pointerdown", handleUpArrowButtonPress);
    refs.jumpButton.addEventListener("click", handleUpArrowButtonPress);
    refs.jumpButton.addEventListener("touchstart", handleUpArrowButtonPress, { passive: false });
    refs.duckButton.addEventListener("pointerdown", handleDownArrowButtonPress);
    refs.duckButton.addEventListener("pointerup", handleDownArrowButtonRelease);
    refs.duckButton.addEventListener("pointercancel", handleDownArrowButtonRelease);
    refs.duckButton.addEventListener("pointerleave", handleDownArrowButtonRelease);
    refs.duckButton.addEventListener("touchstart", handleDownArrowButtonPress, { passive: false });
    refs.duckButton.addEventListener("touchend", handleDownArrowButtonRelease, { passive: false });
    refs.duckButton.addEventListener("touchcancel", handleDownArrowButtonRelease, { passive: false });
  }

  function parseLaunchOptions() {
    const params = new URLSearchParams(window.location.search);
    const options = {
      subject: params.get("subject"),
      year: params.get("year"),
      mode: params.get("mode"),
      autostart: params.get("autostart") === "1",
      challenge: params.get("challenge") === "1",
      reset: params.get("reset") === "1",
      voice: params.get("voice"),
      practice: params.get("practice") === "1",
      character: params.get("character"),
    };

    if (options.reset) {
      window.localStorage.removeItem(STORAGE_KEY);
      progress = loadProgress();
    }

    if (options.voice === "off") {
      state.voiceEnabled = false;
    }

    if (subjectMap.has(options.subject)) {
      progress.selectedSubjectId = options.subject;
    }

    if (yearGroupMap.has(options.year)) {
      progress.selectedYearGroup = options.year;
    }

    if (characterMap.has(options.character)) {
      progress.selectedCharacterId = options.character;
    }

    return options;
  }

  function init() {
    state.launchOptions = parseLaunchOptions();
    resizeCanvas();
    refreshAllUI();
    updateHud();
    bindEvents();

    if (state.launchOptions.autostart) {
      startRun({
        mode: state.launchOptions.practice || state.launchOptions.mode === "practice" ? "practice" : "mission",
        subjectId: progress.selectedSubjectId,
        yearGroup: progress.selectedYearGroup,
      });

      if (state.launchOptions.challenge) {
        window.setTimeout(() => {
          if (state.run && !state.challenge && state.currentScreen === "playing") {
            openChallenge();
          }
        }, 160);
      }
    } else {
      showScreen("menu");
    }

    window.requestAnimationFrame(renderFrame);
  }

  init();
})();
