import type { CoreMessage } from "ai";

import { openai } from "@ai-sdk/openai";
import { inputPrompt } from "@reliverse/prompts";
import { printLineBar, relinka } from "@reliverse/prompts";
import { re } from "@reliverse/relico";
import { streamText } from "ai";
import dotenv from "dotenv";

import type { ReliverseMemory } from "~/utils/schemaMemory.js";

import { updateReliverseMemory } from "./reliverseMemory.js";

dotenv.config();

const messages: CoreMessage[] = [];

/**
 * Ensures we have a valid OpenAI API key in either:
 *  1) process.env
 *  2) memory.openaiKey
 * If not found or invalid, prompts the user to provide one,
 * then stores it in memory.
 */
async function ensureOpenAIKey(memory: ReliverseMemory): Promise<string> {
  let envKeyInvalid = false;
  let memoryKeyInvalid = false;

  // 1) Check .env
  if (process.env["OPENAI_API_KEY"]) {
    try {
      const result = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${process.env["OPENAI_API_KEY"]}` },
      });
      if (result.ok) {
        return process.env["OPENAI_API_KEY"];
      }
      envKeyInvalid = true;
      relinka("warn", "OpenAI key in .env file is invalid, checking memory...");
    } catch {
      envKeyInvalid = true;
      relinka("warn", "OpenAI key in .env file is invalid, checking memory...");
    }
  }

  // 2) Check memory
  if (memory.openaiKey) {
    try {
      const result = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${memory.openaiKey}` },
      });
      if (result.ok) {
        // If we found a valid key in memory but had an invalid one in .env,
        // update .env with the valid key
        process.env["OPENAI_API_KEY"] = memory.openaiKey;
        if (envKeyInvalid) {
          relinka(
            "info",
            "Found valid key in memory, using it instead of invalid .env key",
          );
        }
        return memory.openaiKey;
      }
      memoryKeyInvalid = true;
      relinka("warn", "OpenAI key in memory is invalid");
    } catch {
      memoryKeyInvalid = true;
      relinka("warn", "OpenAI key in memory is invalid");
    }
  }

  // 3) Prompt for a new one
  if (envKeyInvalid || memoryKeyInvalid) {
    relinka(
      "info",
      "Please provide a new OpenAI API key as existing ones are invalid",
    );
  }

  const token = await inputPrompt({
    title:
      "Please enter your OpenAI API key.\n(It will be securely stored on your machine):",
    content: "Get one at https://platform.openai.com/api-keys",
    validate: async (value: string): Promise<string | boolean> => {
      if (!value?.trim()) {
        return "API key is required";
      }
      try {
        const result = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${value}` },
        });
        if (result.ok) {
          return true;
        }
        return "Invalid API key. Please check your key and try again.";
      } catch {
        return "Failed to validate API key. Please check your internet connection.";
      }
    },
  });

  // Store the new token in both memory and process.env
  await updateReliverseMemory({ openaiKey: token });
  process.env["OPENAI_API_KEY"] = token;
  return token;
}

export async function aiChatHandler(memory: ReliverseMemory) {
  // Ensure we have a valid OpenAI API key before proceeding
  await ensureOpenAIKey(memory);

  while (true) {
    //
    // 1) USER PROMPT
    //
    const userInput = (
      await inputPrompt({ title: "You:", symbol: "info" })
    ).trim();
    // Save user message
    messages.push({ role: "user", content: userInput });

    //
    // 2) ASSISTANT RESPONSE
    //
    console.log(`${re.dim("ℹ")}  ${re.bold("Reliverse:")}`);

    // Stream the assistant response with "ai" + "@ai-sdk/openai"
    try {
      const result = streamText({
        model: openai("gpt-3.5-turbo"),
        messages,
      });

      let assistantResponse = "";
      process.stdout.write(re.dim("│  ")); // Initial bar with indent

      for await (const delta of result.textStream) {
        // Handle newlines by adding the bar prefix
        const lines = delta.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i] ?? "";
          if (i > 0) {
            // On each new line, print a fresh bar prefix
            console.log();
            process.stdout.write(re.dim("│  "));
          }
          process.stdout.write(line);
        }
        assistantResponse += delta;
      }

      console.log(); // New line after response is complete
      printLineBar(""); // Blank bar line after response

      // Save assistant message
      messages.push({ role: "assistant", content: assistantResponse });
    } catch (error) {
      console.error(
        "Error:",
        error instanceof Error ? error.message : String(error),
      );
      printLineBar("Failed to get response from OpenAI. Please try again.");
    }

    if (
      userInput.toLowerCase() === "exit" ||
      userInput.toLowerCase() === "bye"
    ) {
      break;
    }
  }
}
