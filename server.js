import { AzureChatOpenAI, AzureOpenAIEmbeddings } from "@langchain/openai";
import { SystemMessage, HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import express from "express";
import cors from "cors";

const quotes = [];
let currentGame = {};

async function getData(id) {
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

  console.log(lotrData);
  for (let item of lotrData.docs) {
    await getCharacter(item.character, item.dialog);
  }
  console.log(quotes);
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

  const response = await model.invoke([
    ["system", "We're playing a qoute guessing game. You will present a qoute and ask the user to guess who said it. After three wrong tries, reveal the answer. Repeat the qoute"],
    ["system", `The quote is: "${randomQuote.qoute}". The correct answer is: ${randomQuote.name}.`],
    ["ai", `Who said: "${randomQuote.qoute}"? You have three tries!`],
  ]);

  console.log(response.content);
  currentGame = {
    qoute: randomQuote.qoute,
    question: response.content,
    answer: randomQuote.name, 
    triesLeft: 3,
  };
  return currentGame;
}

app.post("/ask", (req, res) => {
  const userGuess = req.body.prompt;

  if (!currentGame) {
    return res.json({ message: "Start a game first by calling /start!" });
  }

  if (userGuess.toLowerCase() === currentGame.answer.toLowerCase()) {
    currentGame = {};
    return res.json({ message: "Correct! 🎉 You guessed it!" });
  } else {
    currentGame.triesLeft--;

    if (currentGame.triesLeft <= 0) {
      const correctAnswer = currentGame.answer;
      currentGame = {};
      return res.json({ message: `Sorry! No more tries left. The correct answer was: ${correctAnswer}` });
    } else {
      return res.json({ message: `Wrong! You have ${currentGame.triesLeft} tries left. Try again! ${currentGame.qoute}` });
    }
  }
});

app.get("/start", async (req, res) => {
  const game = await startGame();
  // Je zou game data (answer + triesLeft) in een memory object kunnen opslaan per gebruiker
  res.json(game);
});



async function startServer() {
  await getData("5cd95395de30eff6ebccde5d");
  app.listen(3000, () => console.log("server staat aan op port 3000"));

}

startServer();