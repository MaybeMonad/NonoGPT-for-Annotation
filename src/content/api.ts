/**
 * Inspired by @yetone
 */

import { fetchSSE } from "~/util";

export interface TranslateQuery {
  text: string;
  onMessage: (message: { content: string; role: string }) => void;
  onError: (error: string) => void;
  onFinish: (reason: string) => void;
}

export interface TranslateResult {
  text?: string;
  from?: string;
  to?: string;
  error?: string;
}

export async function translate(query: TranslateQuery) {
  const apiKey = import.meta.env.VITE_OPENAI_KEY;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  let prompt = `translate from English to Chinese`;

  prompt = `${prompt}:\n\n"${query.text}" =>`;

  const body = {
    model: "gpt-3.5-turbo",
    temperature: 0,
    max_tokens: 1000,
    top_p: 1,
    frequency_penalty: 1,
    presence_penalty: 1,
    messages: [
      {
        role: "system",
        content:
          "You are a translation engine that can only translate text and cannot interpret it.",
      },
      { role: "user", content: prompt },
    ],
    stream: true,
  };

  let isFirst = true;

  await fetchSSE("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    onMessage: (msg) => {
      let response;
      try {
        response = JSON.parse(msg);
      } catch {
        query.onFinish("stop");
        return;
      }
      const { choices } = response;
      if (!choices || choices.length === 0) {
        return { error: "No result" };
      }
      const { delta, finish_reason: finishReason } = choices[0];

      if (finishReason) {
        query.onFinish(finishReason);
        return;
      }

      const { content = "", role } = delta;
      let targetTxt = content;

      if (
        (isFirst && targetTxt.startsWith('"')) ||
        targetTxt.startsWith("「")
      ) {
        targetTxt = targetTxt.slice(1);
      }

      if (!role) {
        isFirst = false;
      }

      query.onMessage({ content: targetTxt, role });
    },
    onError: (err) => {
      const { error } = err;
      query.onError(error.message);
    },
  });
}

const api = {
  translate,
};

export default api;
