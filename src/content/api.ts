import {
  EventStreamContentType,
  fetchEventSource,
} from "@microsoft/fetch-event-source";

interface Query {
  userPrompt: string;
  systemPrompt: string;
  assistantPrompt: string;
  onMessage: (message: string) => void;
  onError: (error: string) => void;
  onFinish: (receivedText: string) => void;
}

export async function queryFn(query: Query) {
  class RetriableError extends Error {}
  class FatalError extends Error {}
  class StopStream extends Error {}

  let receivedText = "";

  function headers() {
    const apiKey = import.meta.env.VITE_OPENAI_KEY;
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };
  }

  function body() {
    return {
      model: "gpt-3.5-turbo",
      temperature: 0,
      max_tokens: 1000,
      top_p: 1,
      frequency_penalty: 1,
      presence_penalty: 1,
      messages: [
        { role: "system", content: query.systemPrompt },
        { role: "assistant", content: query.assistantPrompt },
        { role: "user", content: query.userPrompt },
      ],
      stream: true,
    };
  }

  try {
    await fetchEventSource("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body()),
      async onopen(response) {
        if (
          response.ok &&
          response.headers.get("content-type") === EventStreamContentType
        ) {
          return;
        } else if (
          response.status >= 400 &&
          response.status < 500 &&
          response.status !== 429
        ) {
          throw new FatalError();
        } else {
          throw new RetriableError();
        }
      },
      onmessage(msg) {
        if (msg.event === "FatalError") {
          throw new FatalError(msg.data);
        }

        if (msg.data === "[DONE]") {
          query.onFinish(receivedText);
          throw new StopStream("DONE");
        }

        try {
          const parsedData = JSON.parse(msg.data);
          const text = parsedData.choices[0].delta.content;
          if (typeof text === "string" && text) {
            receivedText += text;
            query.onMessage(text);
          }
        } catch (err) {
          console.error("JSON parse failed", err);
          throw new FatalError("JSON parse failed");
        }
      },
      onclose() {
        // if the server closes the connection unexpectedly, retry:
        throw new RetriableError();
      },
      onerror(err) {
        if (err instanceof FatalError || err instanceof StopStream) {
          throw err;
        } else {
          // do nothing to automatically retry. You can also
          // return a specific retry interval here.
          // query.onError(err);
        }
      },
    });
  } catch (err) {
    // query.onError("Unknown Error");
  }
}

export function translate(
  onReceive: (text: string, isFirst: boolean) => void,
  onFinish: (text: string) => void,
  onError: (error: string) => void
) {
  let isFirst = true;
  return async function (text: string, to: "zh" | "en" = "zh") {
    queryFn({
      userPrompt: text,
      systemPrompt: `You are a translation engine that can only translate text and cannot interpret it.`,
      assistantPrompt: `Translate this text into ${
        to === "zh" ? "Chinese" : "English"
      }.`,
      onMessage(newMsg) {
        onReceive(newMsg, isFirst);
        if (isFirst) {
          isFirst = false;
        }
      },
      onFinish(totalReceived) {
        onFinish(totalReceived);
      },
      onError,
    });
  };
}

export function summarize(
  onReceive: (text: string, isFirst: boolean) => void,
  onFinish: (text: string) => void,
  onError: (error: string) => void
) {
  let isFirst = true;
  return async function (text: string) {
    queryFn({
      userPrompt: text,
      systemPrompt: `You are a text summarizer, you can only summarize the text, do not interpret it.`,
      assistantPrompt: `Summarize this text in the most concise language in Chinese.`,
      onMessage(newMsg) {
        onReceive(newMsg, isFirst);
        if (isFirst) {
          isFirst = false;
        }
      },
      onFinish(totalReceived) {
        onFinish(totalReceived);
      },
      onError,
    });
  };
}

export function definite(
  onReceive: (text: string, isFirst: boolean) => void,
  onFinish: (text: string) => void,
  onError: (error: string) => void
) {
  let isFirst = true;
  return async function (text: string) {
    queryFn({
      userPrompt: text,
      systemPrompt: `You are a wikipedia, you should only give the definition of the text, do not interpret it.`,
      assistantPrompt: `Give the definition of this text in the most concise language in Chinese.`,
      onMessage(newMsg) {
        onReceive(newMsg, isFirst);
        if (isFirst) {
          isFirst = false;
        }
      },
      onFinish(totalReceived) {
        onFinish(totalReceived);
      },
      onError,
    });
  };
}

const api = {
  translate,
  summarize,
  definite,
};

export default api;
