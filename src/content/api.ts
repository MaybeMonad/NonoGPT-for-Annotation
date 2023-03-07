import {
  EventStreamContentType,
  fetchEventSource,
} from "@microsoft/fetch-event-source";

interface Query {
  userPrompt: string;
  systemPrompt: string;
  onMessage: (message: string) => void;
  // onError: (error: string) => void;
  // onFinish: (reason: string) => void;
}

export async function queryFn(query: Query) {
  class RetriableError extends Error {}
  class FatalError extends Error {}

  class StopStream extends Error {}

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
          throw new StopStream("DONE");
        }

        try {
          const parsedData = JSON.parse(msg.data);
          if (parsedData.choices[0].delta.content) {
            query.onMessage(parsedData.choices[0].delta.content as string);
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
        }
      },
    });
  } catch (err) {
    // console.log(err);
  }
}

export function translate(onReceive: (text: string) => void) {
  return async function (text: string) {
    queryFn({
      userPrompt: `translate from English to Chinese: ${text}`,
      systemPrompt: `You are a translation engine that can only translate text and cannot interpret it.`,
      onMessage(newMsg) {
        onReceive(newMsg);
      },
    });
  };
}

export function summarize(onReceive: (text: string) => void) {
  return async function (text: string) {
    queryFn({
      userPrompt: `translate from English to Chinese: ${text}`,
      systemPrompt: `You are a translation engine that can only translate text and cannot interpret it.`,
      onMessage(newMsg) {
        onReceive(newMsg);
      },
    });
  };
}

const api = {
  translate,
  summarize,
};

export default api;
