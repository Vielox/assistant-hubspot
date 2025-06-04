import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createSmitheryUrl } from "@smithery/sdk/shared/config.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

/** * This route handles the chat requests to the OpenAI assistant.
 * It creates a thread, adds a user message, executes the assistant,
 *  
 */

export async function POST(req: Request) {
  const assistantId = process.env.ASSISTANT_ID;
  // connect to OpenAI API
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  try {
    const { query } = await req.json();
    if (!query) {
      //console.error('Error: Missing query');
      return NextResponse.json({ error: 'Missing message' }, { status: 400 });
    }

    // create a thread
    let thread;
    try {
      thread = await openai.beta.threads.create();
      //console.log('Thread créé:', thread);
    } catch (err) {
      //console.error('Erreur during thread creation:', err);
      return NextResponse.json({ error: 'Failed to create thread' }, { status: 500 });
    }

    // add a message to the thread
    try {
      await openai.beta.threads.messages.create(thread.id, {
        role: 'user',
        content: query,
      });
      //console.log('added message to thread:', query);
    } catch (err) {
      //console.error('Erreur during message adding:', err);
      return NextResponse.json({ error: 'Failed to add message' }, { status: 500 });
    }

    // execute the assistant
    let run;
    try {
      run = await openai.beta.threads.runs.create(thread.id, {
        assistant_id: assistantId!,
      });
      console.log('run lauched:', run);
    } catch (err) {
      console.error('Erreur during run launching:', err);
      return NextResponse.json({ error: 'Failed to launch run' }, { status: 500 });
    }

    // run, if the asssistant needs to call a tool, it will return a status of 'requires_action', else it will handle the response automatically
    let runStatus = run;
    //let i = 0;
    while (runStatus.status !== 'completed' && runStatus.status !== 'failed') {
      //i++;
      //console.log(`Polling run status... (${i})`);
      
      if (runStatus.status === 'requires_action') {
        //console.log(`Current run status : ${runStatus.status}`);
        // Handle tool calls
        const toolCalls = runStatus.required_action?.submit_tool_outputs?.tool_calls || [];
        //console.log('tool called:', toolCalls);
        const toolOutputs = [];

        // connect to the Model Context Protocol (MCP) server
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
          //console.log("Appel d’un outil par OpenAI :", call.function.name, args);

          const result = await client.callTool({ name: toolName, arguments: args });

          toolOutputs.push({
            tool_call_id: call.id,
            output: typeof result === "string" ? result : JSON.stringify(result),
          });
        }

        // Submit tool outputs back to OpenAI assistant
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
          //console.error('Error during run retrieval:', err);
          return NextResponse.json({ error: 'Failed to retrieve run status' }, { status: 500 });
        }
      }
    }

    // get the response from the assistant
    let response = '';
    try {
      const messages = await openai.beta.threads.messages.list(thread.id);
      //console.log('thread messages:', messages);

      response = messages.data
        .filter((msg) => msg.role === 'assistant')
        .map((msg) => msg.content[0]?.type === 'text' ? msg.content[0].text.value : '')
        .join('\n');
    } catch (err) {
      return NextResponse.json({ error: 'Failed to retrieve messages' }, { status: 500 });
    }

    return NextResponse.json({ response });
  } catch (err: any) {

    if (err instanceof OpenAI.APIError) {
      return NextResponse.json({
        error: err.message,
        status: err.status,
        type: err.type,
        param: err.param,
        code: err.code
      }, { status: 500 });
    }

    return NextResponse.json({ error: 'Server error', details: String(err) }, { status: 500 });
  }
}