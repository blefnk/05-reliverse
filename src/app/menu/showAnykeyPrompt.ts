import { anykeyPrompt } from "@reliverse/prompts";
import pc from "picocolors";

export async function showAnykeyPrompt() {
  const notification = `👋 Hello, my name is Reliverse!\n│  🤖 I'm your assistant for creating new web projects and making advanced codebase modifications.\n│  ✨ I'm constantly evolving, with even more features on the way!\n│  ============================\n│  ${pc.bold("Press any key to continue...")}`;

  await anykeyPrompt(notification);
}
