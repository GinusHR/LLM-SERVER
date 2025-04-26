import { AzureChatOpenAI, AzureOpenAIEmbeddings } from "@langchain/openai";
import { SystemMessage, HumanMessage, AIMessage, ToolMessage  } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import express from "express";
import cors from "cors";

const qoute = [];

async function getData(id) {
  const response = await fetch(`https://the-one-api.dev/v2/movie/${id}/quote?limit=30`, {
    method: "GET",
    headers: {
      Authorization: "Bearer 2LVVH-2H2EgIhwplhVbW",
    },
  });
  const lotrData = await response.json();

  console.log(lotrData);
  for (let item of lotrData.docs) {
    await getCharacter(item.character, item.dialog);
  }
  console.log(qoute)
}

async function getCharacter(id, data) {
  const response = await fetch(`https://the-one-api.dev/v2/character/${id}/`, {
    method: "GET",
    headers: {
      Authorization: "Bearer 2LVVH-2H2EgIhwplhVbW",
    },
  });

  const lotrName = await response.json()
  console.log(lotrName)
  qoute.push({"qoute": data, "name": lotrName.docs[0].name})
  
}

const 

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const messages = [["system", "We're going to play a qoute game"]];

const model = new AzureChatOpenAI({
  temperature: 0.7,
});



async function createJoke() {
  const result = await model.invoke("Tell me a Javascript joke");
  return result.content;
}

async function sendPrompt(prompt) {

  //chat
  const response = await model.invoke([
    [
      "system",
      "You will get qoutes use these qoutes to begin a game in which the user has to guess who said the qoute. They get three tries. After the third mistake give them the answer. Randomly select a qoute, and then compare the users anwser to the name.",
    ],
    ["user", `The context is ${qoute}, the question is ${prompt}`],
  ]);
  console.log("----------------------");
  console.log(response.content);
  return response.content;
}

app.get("/", async (req, res) => {
  let joke = await createJoke();
  res.json({ message: joke });
});

app.post("/ask", async (req, res) => {
  let prompt = req.body.prompt;
  let result = await sendPrompt(prompt);
  res.json({ message: result });
});

app.listen(3000, () => console.log("server staat aan op port 3000"));

getData("5cd95395de30eff6ebccde5d");
