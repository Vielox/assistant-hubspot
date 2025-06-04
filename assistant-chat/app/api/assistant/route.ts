import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createSmitheryUrl } from "@smithery/sdk/shared/config.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

export async function POST(req: Request) {
  const assistantId = process.env.ASSISTANT_ID;

  try {
    const { query, threadId } = await req.json();
    if (!query) {
      return NextResponse.json({ error: 'Missing message' }, { status: 400 });
    }
    //console.log(`Received threadId: ${threadId}`);
    // Use existing thread or create a new one
    let thread;
    if (threadId) {
      thread = { id: threadId };
    } else {
      try {
        thread = await openai.beta.threads.create();
      } catch (err) {
        return NextResponse.json({ error: 'Failed to create thread' }, { status: 500 });
      }
    }
    //console.log(`Using thread ID: ${thread.id}`);
    // Add a message to the thread
    try {
      await openai.beta.threads.messages.create(thread.id, {
        role: 'user',
        content: query,
      });
    } catch (err) {
      return NextResponse.json({ error: 'Failed to add message' }, { status: 500 });
    }

    // Launch a run
    let run;
    try {
      run = await openai.beta.threads.runs.create(thread.id!, {
        assistant_id: assistantId!,
      });
    } catch (err) {
      return NextResponse.json({ error: 'Failed to launch run' }, { status: 500 });
    }

    // Polling and tool call handling
    let runStatus = run;
    while (runStatus.status !== 'completed' && runStatus.status !== 'failed') {
      if (runStatus.status === 'requires_action') {
        const toolCalls = runStatus.required_action?.submit_tool_outputs?.tool_calls || [];
        const toolOutputs = [];

        // Smithery tool execution
        const mcpUrl = "https://server.smithery.ai/@shinzo-labs/hubspot-mcp";
        const smitheryApiKey = process.env.SMITHERY_API_KEY;
        const hubspotApiKey = process.env.HUBSPOT_API_KEY;
        const config = { HUBSPOT_ACCESS_TOKEN: hubspotApiKey };
        const serverUrl = createSmitheryUrl(mcpUrl, { config, apiKey: smitheryApiKey });
        const transport = new StreamableHTTPClientTransport(serverUrl);
        const client = new Client({ name: "Init client", version: "1.0.0" });
        await client.connect(transport);

        for (const call of toolCalls) {
          const toolName = call.function.name;
          const args = JSON.parse(call.function.arguments);

          const result = await client.callTool({ name: toolName, arguments: args });

          toolOutputs.push({
            tool_call_id: call.id,
            output: typeof result === "string" ? result : JSON.stringify(result),
          });
        }

        runStatus = await openai.beta.threads.runs.submitToolOutputs(
          thread.id,
          runStatus.id,
          { tool_outputs: toolOutputs }
        );
      } else {
        await new Promise((r) => setTimeout(r, 3000));
        try {
          runStatus = await openai.beta.threads.runs.retrieve(thread.id, runStatus.id);
        } catch (err) {
          return NextResponse.json({ error: 'Failed to retrieve run status' }, { status: 500 });
        }
      }
    }

    // Get the assistant's response
    let response = '';
    try {
      const messages = await openai.beta.threads.messages.list(thread.id);
      const lastAssistantMsg = messages.data
        .filter((msg) => msg.role === 'assistant')
        .at(0); 

      response = lastAssistantMsg && lastAssistantMsg.content[0]?.type === 'text'
        ? lastAssistantMsg.content[0].text.value
        : '';
    } catch (err) {
      return NextResponse.json({ error: 'Failed to retrieve messages' }, { status: 500 });
    }

    // Always return the threadId so the client can reuse it
    return NextResponse.json({ response, threadId: thread.id });
  } catch (err: any) {
    return NextResponse.json({ error: 'Server error', details: String(err) }, { status: 500 });
  }
}
