import { AzureChatOpenAI, AzureOpenAIEmbeddings } from "@langchain/openai";
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { Document } from "@langchain/core/documents";
import express from "express";
import cors from "cors";
import {existsSync} from "fs";
import fs from "fs";
import path from "path";


const quotes = [];
let currentGame = {};
let history = [];

const QUOTES_PATH = path.resolve("./quotes_file/quotes.json");
const FAISS_PATH = "./quotes_file";

function saveQuotesToFile(quotes, filePath) {
  fs.writeFileSync(filePath, JSON.stringify(quotes, null, 2), "utf-8");
}

function loadQuotesFromFile(filePath) {
  if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(data);
  }
  return null;
}

async function getData(id) {
  let localQuotes = loadQuotesFromFile(QUOTES_PATH);
  if (localQuotes) {
    console.log("Quotes geladen uit lokaal bestand.");
    quotes.push(...localQuotes);
    return;
  }

  const response = await fetch(
    `https://the-one-api.dev/v2/movie/${id}/quote?limit=50`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.THE_ONE_API_KEY}`,
      },
    }
  );
  const lotrData = await response.json();

  for (let item of lotrData.docs) {
    await getCharacter(item.character, item.dialog);
  }

 
  saveQuotesToFile(quotes, QUOTES_PATH);

  console.log("Quotes opgehaald en lokaal opgeslagen.");
}


let vectorStore;
async function buildVectorStore(embeddings) {
  const docs = quotes.map((item) => new Document({
    pageContent: item.qoute,
    metadata: { speaker: item.name }
  }));

  vectorStore = await FaissStore.fromDocuments(docs, embeddings);
  await vectorStore.save("./quotes_file");
}


async function getCharacter(id, data) {
  const response = await fetch(`https://the-one-api.dev/v2/character/${id}/`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${process.env.THE_ONE_API_KEY}`,
    },
  });

  const lotrName = await response.json();
  console.log(lotrName);
  quotes.push({ qoute: data, name: lotrName.docs[0].name });
}

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const model = new AzureChatOpenAI({
  temperature: 0.7,
});

function getRandomQoute() {
  const randomIndex = Math.floor(Math.random() * quotes.length);
  return quotes[randomIndex];
}

async function startGame() {
  const randomQuote = getRandomQoute();

  history = [
    [
      "system",
      "We're playing a quote guessing game. You will present a quote and ask the user to guess who said it. After three wrong tries, reveal the answer. Repeat the quote.",
    ],
    [
      "system",
      `The quote is: "${randomQuote.qoute}". The correct answer is: ${randomQuote.name}.`,
    ],
    ["ai", `Who said: "${randomQuote.qoute}"? You have three tries!`],
  ];

  const response = await model.invoke(history);

  console.log(response.content);
  currentGame = {
    qoute: randomQuote.qoute,
    question: response.content,
    answer: randomQuote.name,
    triesLeft: 3,
  };
  return currentGame;
}

app.post("/ask", async (req, res) => {
  const userGuess = req.body.prompt;

  if (!vectorStore || !vectorStore.index) {
    return res.json({
      message: "Vector store niet beschikbaar, probeer opnieuw te starten.",
    });
  }

  if (!currentGame || !vectorStore) {
    return res.json({ message: "Begin eerst een spel" });
  }

  history.push(["user", userGuess]);

  const results = await vectorStore.similaritySearch(userGuess, 1);
  const bestMatch = results[0];
  const guessedName = bestMatch.metadata.speaker.toLowerCase();
  const correctName = currentGame.answer.toLowerCase();

  let reply = "";

  if (guessedName === correctName) {
    reply = `Correct! 🎉 It was ${guessedName}.`;
    currentGame = {};
  } else {
    currentGame.triesLeft--;

    if (currentGame.triesLeft <= 0) {
      reply = `So close! You're out of tries. The right answer was: ${currentGame.answer}`;
      currentGame = {};
    } else {
      reply = `Almost! Your guess was ${userGuess}, but that's not right. You've got ${currentGame.triesLeft} tries left. Try again!\n\nQuote: "${currentGame.qoute}"`;
    }
  }

  history.push(["ai", reply]);

  return res.json({ message: reply });
});

app.get("/start", async (req, res) => {
  const game = await startGame();
  res.json(game);
});

async function startServer() {
  await getData("5cd95395de30eff6ebccde5d");
  
  const embeddings = new AzureOpenAIEmbeddings({
    azureOpenAIApiEmbeddingsDeploymentName: process.env.AZURE_EMBEDDING_DEPLOYMENT_NAME,
    azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY,
    azureOpenAIApiInstanceName: process.env.AZURE_OPENAI_INSTANCE_NAME,
    azureOpenAIApiVersion: process.env.AZURE_OPENAI_API_VERSION,
  });

  if (fs.existsSync(FAISS_PATH)) {
    console.log("Laad bestaande VectorStore...");
    vectorStore = await FaissStore.load(FAISS_PATH, embeddings);
  } else {
    console.log("Genereer nieuwe vector store...");
    await buildVectorStore(embeddings);
    console.log("Nieuwe VectorStore gemaakt")
  }

  app.listen(3000, () => console.log("server staat aan op port 3000"));
}



startServer();
