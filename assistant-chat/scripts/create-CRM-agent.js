import OpenAI from 'openai';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createSmitheryUrl } from '@smithery/sdk/shared/config.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

/**
 * This script creates an OpenAI assistant that can interact with HubSpot CRM tools via Smithery.
 * It filters tools to only include those starting with "crm" and ensures all array schemas have an items field.
 * 
 * Usage: node create-CRM-agent.js OPENAI_API_KEY SMITHERY_API_KEY HUBSPOT_TOKEN
 */


//This function recursively ensures that all arrays in a JSON schema have an items field, defaulting to { type: 'string' } if missing.

function patchSchema(schema) {
  if (schema && typeof schema === 'object') {
    if (schema.type === 'array' && !schema.items) {
      schema.items = { type: 'string' };
    }
    for (const key in schema) {
      patchSchema(schema[key]);
    }
  }
  return schema;
}

async function main() {
  const [,, openaiKey, smitheryKey, hubspotToken] = process.argv;

  if (!openaiKey || !smitheryKey || !hubspotToken) {
    console.error('Usage: node create-agent-with-tools.js OPENAI_API_KEY SMITHERY_API_KEY HUBSPOT_TOKEN');
    process.exit(1);
  }
  // connect to the Smithery MCP for HubSpot
  const mcpUrl = 'https://server.smithery.ai/@shinzo-labs/hubspot-mcp';
  const config = { HUBSPOT_ACCESS_TOKEN: hubspotToken };
  const serverUrl = createSmitheryUrl(mcpUrl, { config, apiKey: smitheryKey });

  const transport = new StreamableHTTPClientTransport(serverUrl);
  const client = new Client({ name: 'Init client', version: '1.0.0' });
  await client.connect(transport);

  const toolsResult = await client.listTools();
  const allTools = toolsResult.tools || [];

  // filter tools to only include those starting with "crm"
  const filteredTools = allTools.filter(tool => tool.name.startsWith('crm'));

  const formattedTools = filteredTools.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: patchSchema(tool.inputSchema ?? tool.parameters ?? {}),
    },
  }));

  const openai = new OpenAI({ apiKey: openaiKey });
  // create the assistant with the filtered tools and nice instructions
  const assistant = await openai.beta.assistants.create({
    name: 'CRM Hubspot assistant',
    instructions: `You are a CRM assistant interacting with HubSpot via MCP, managing contacts, companies, deals, and tasks.

Respond clearly and concisely.

When using a tool:

Provide all required parameters exactly.

Never omit or leave fields undefined.

Create plausible values if needed.

Never leave fields blank.

If unsure or waiting for a response, inform the user. Act proactively when necessary.`,
    model: 'gpt-4o',
    tools: formattedTools,
  });

  console.log('Assistant created, it\'s ID :', assistant.id);
}

main().catch(err => {
  console.error('Error during the assistant creation :', err);
  process.exit(1);
});
