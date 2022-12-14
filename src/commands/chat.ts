import {
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder,
} from "discord.js";
import { chat } from "../modules/gpt-api.js";
import supabase from "../modules/supabase.js";
import { renderResponse } from "../modules/render-response.js";

export default {
  data: new SlashCommandBuilder()
    .setName("chat")
    .setDescription("Chat with ChatGPT")
    .addStringOption((option) =>
      option
        .setName("message")
        .setDescription("The message for ChatGPT")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("response")
        .setDescription("The type of resoibse message that you want")
        .setRequired(true)
        .addChoices(
          { name: "image", value: "image" },
          { name: "text", value: "text" }
        )
    )
    .addStringOption((option) =>
      option
        .setName("type")
        .setDescription("The type of message for ChatGPT")
        .setRequired(false)
        .addChoices(
          { name: "public", value: "public" },
          { name: "private", value: "private" }
        )
    ),
  async execute(interaction, client) {
    var message = interaction.options.getString("message");
    var type = interaction.options.getString("type");
    var responseType = interaction.options.getString("response");

    var privateConversation = false;
    if (type == "private") {
      privateConversation = true;
    }
    await interaction.reply({
      ephemeral: privateConversation,
      content: `Loading...\nNow that you are waiting you can join us in [dsc.gg/turing](https://dsc.gg/turing)`,
    });
    var result;
    let { data: results, error } = await supabase
      .from("results")
      .select("*")

      // Filters
      .eq("prompt", message.toLowerCase())
      .eq("provider", "chatgpt");
    if (results[0] && results[0].result.text) {
      result = results[0].result.text;
      const { data, error } = await supabase
        .from("results")
        .update({ uses: results[0].uses + 1 })
        .eq("id", results[0].id);
    } else {
      result = await chat(message);
    }

    if (!result.error) {
      const { data, error } = await supabase.from("results").insert([
        {
          provider: "chatgpt",
          prompt: message.toLowerCase(),
          result: { text: result },
          guildId: interaction.guildId,
        },
      ]);
      var channel = interaction.channel;
      if (!interaction.channel) channel = interaction.user;
      if (responseType == "image") {
        await responseWithImage(interaction, message, result);
      } else {
        await responseWithText(interaction, message, result, channel);
      }
    } else {
      if (responseType == "image") {
        await responseWithImage(interaction, message, result.error);
      } else {
        await responseWithText(interaction, message, result.error, channel);
      }
    }
    return;
  },
};

async function responseWithImage(interaction, prompt, result) {
  var response = await renderResponse({
    prompt: prompt,
    response: result,
    username: interaction.user.tag,
    userImageUrl: interaction.user.avatarURL(),
  });
  var image = new AttachmentBuilder(response, { name: "output.jpg" });

  await interaction.editReply({
    content: "",
    files: [image],
  });
}

async function responseWithText(interaction, prompt, result, channel) {
  var completeResponse = `**Human:** ${prompt}\n**ChatGPT:** ${result}`;
  var charsCount = completeResponse.split("").length;
  if (charsCount % 2000 == 0) {
    var loops = Math.ceil(charsCount / 2000);
    for (var i = 0; i < loops; i++) {
      if (i == 0) {
        interaction.editReply(
          completeResponse.split("").slice(0, 2000).join("")
        );
      } else {
        channel.send(
          completeResponse
            .split("")
            .slice(2000 * i, 2000 * i + 2000)
            .join("")
        );
      }
    }
  } else {
    interaction.editReply(completeResponse);
  }
}
