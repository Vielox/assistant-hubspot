# MCP LLM assistant on Hubspot using OpenAI API !
This project is a web-based AI assistant prototype built with Next.js and TailwindCSS, using the OpenAI Assistant API and Model Context Protocol (MCP) to interact with HubSpot. The assistant can answer CRM-related questions and perform real-time actions (e.g., contact search, opportunity creation) via the MCP server by Shinzo Labs.
Deployed on Vercel.

After installing Node.js, to create an assistant on OpenAI you can use, from the assistant-chat file the following command : 
<pre><code>node scripts/create-CRM-agent.js OPENAI_API_KEY SMITHERY_API_KEY HUBSPOT_TOKEN</code></pre>

with 
- **OPENAI_API_KEY** : votre clé API OpenAI, disponible sur [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- **SMITHERY_API_KEY** : votre clé API Smithery, disponible sur [https://smithery.ai/account/api-keys](https://smithery.ai/account/api-keys)
- **HUBSPOT_TOKEN** : votre jeton HubSpot, disponible sur [https://app-na3.hubspot.com/connected-apps/341952629/installed](https://app-na3.hubspot.com/connected-apps/341952629/installed)

Ce script créera l’assistant avec tous les outils CRM de Smithery, et affichera l’identifiant de l’assistant : **ASSISTANT_ID**


Once it is done, you can deploy the project on vercel, using the assistant-chat file a root, and filling the environment variables listed above.
Have Fun ! 

Vieloszynski Alexis.
