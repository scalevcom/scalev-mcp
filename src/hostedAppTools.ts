import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { buildGetRequest } from './catalog';
import { scalevApiBusinessRequest } from './scalevApiClient';
import { currentAuth, runLoggedTool, toolResult } from './toolRuntime';
import { toolAnnotations } from './toolAnnotations';
import type { Env } from './types';

export function hostedPreviewResult(response: unknown) {
  const result = toolResult(response);
  const url = response && typeof response === 'object' && 'url' in response ? response.url : null;
  if (typeof url === 'string') {
    const parsed = new URL(url);
    if (['http:', 'https:'].includes(parsed.protocol)) result.content.push({type:'text',text:`[Open preview](${parsed.href})\n\nThis preview is public to anyone with the link. Include the Open preview link in your reply.`});
  }
  return result;
}

export function registerHostedAppTools(server:McpServer,env:Env):void {
  const business = z.string().optional().describe('Business unique_id from get_me.connected_businesses.');
  for (const tool of [
    {name:'get_hosted_app_preview',operation:'getHostedAppPreview',title:'Get app preview',description:'Returns the stable, unlisted public preview as structured data and an Open preview Markdown link. Include that link in your reply. Does not build or upload code.'},
    {name:'get_hosted_app_deployment',operation:'getHostedAppDeployment',title:'Get app deployment status',description:'Inspect an uploaded deployment. Pending is still processing; ready is serving. This does not build code.'},
    {name:'get_hosted_app_diagnostics',operation:'getHostedAppDiagnostics',title:'Get app deployment diagnostics',description:'Read bounded deployment diagnostics without artifact contents or credentials. A failed latest attempt can coexist with an older serving preview.'},
  ]) {
    server.registerTool(tool.name,{title:tool.title,description:tool.description,inputSchema:{id:z.string().uuid().describe('Hosted app project id.'),business_unique_id:business,...(tool.operation==='getHostedAppPreview'?{}:{deployment_id:z.string().uuid().describe('Deployment id returned by the CLI or API.')})},annotations:toolAnnotations(tool.title,'api_read')},async input=>{
      const auth=currentAuth();
      return runLoggedTool(env,auth,{toolName:tool.name,operationId:tool.operation},async()=>{
        const {request}=buildGetRequest({operation_id:tool.operation,business_unique_id:input.business_unique_id,path_params:{id:input.id,...(input.deployment_id?{deployment_id:input.deployment_id}:{})}});
        const response=await scalevApiBusinessRequest(env,auth,request);
        return tool.operation==='getHostedAppPreview'?hostedPreviewResult(response):toolResult(response);
      });
    });
  }
  server.registerTool('get_hosted_app_cli_instructions',{title:'Get hosted app CLI instructions',description:'Explain how any local coding agent can build and upload apps using Scalev CLI. MCP cannot read local directory paths or upload files. Use catalog-backed tools for project creation and explicit release management.',inputSchema:{},annotations:toolAnnotations('Get hosted app CLI instructions','api_read')},()=>{
    const local=env.MCP_RESOURCE_URI?.startsWith('http://localhost:');
    return toolResult({node_version:'22+',cli_package:'@scalev/cli',commands:['scalev init --template sqlite',`scalev login${local?' --profile local':''}`,`scalev link --project PROJECT_ID${local?' --profile local':''}`,`scalev deploy${local?' --profile local':''}`,`scalev preview${local?' --profile local':''} --json`],mcp_url:env.MCP_RESOURCE_URI,preview_visibility:'Unlisted, public to anyone with the link.',instructions:'Edit and build locally. CLI deploy uploads an immutable artifact to preview. Return its [Open preview](URL) link in chat. Retrieve it later with get_hosted_app_preview without rebuilding. Publish only when explicitly requested, selecting a successful deployment. External code hosting never charges Scalev AI Volt. CLI and remote MCP require separate OAuth consent. Local development CLI is built from Gutenberg packages/scalev-cli/dist/cli.mjs; package publication is a separate release step.'});
  });
}
